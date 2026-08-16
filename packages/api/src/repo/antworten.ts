import { createId } from "@paralleldrive/cuid2";
import { eq, sql } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { corrections, responseEvents } from "../db/schema.js";
import { AUSZUG_MAX_LENGTH } from "@korrektur/shared";
import { normBetreff, type AntwortKandidat } from "../inbox/antworten.js";
import { lesbarerText } from "../inbox/dekodieren.js";

/**
 * Schreibseite der Antwort-Zuordnung (P3). Die Erkennung ist rein und liegt
 * in inbox/antworten.ts; hier stehen Laden der Kandidaten und das
 * idempotente Vermerken.
 */

export function ladeAntwortKandidaten(db: Db): AntwortKandidat[] {
  const zeilen = db.all<{
    id: string;
    ref: string;
    messageId: string | null;
    headline: string | null;
    domains: string | null;
  }>(sql`
    SELECT c.id, c.ref, c.message_id AS messageId, c.headline,
      (SELECT GROUP_CONCAT(d.domain, ' ') FROM outlet_domains d WHERE d.outlet_id = c.outlet_id) AS domains
    FROM corrections c
  `);
  return zeilen.map((z) => ({
    id: z.id,
    ref: z.ref,
    messageId: z.messageId ? z.messageId.replace(/[<>]/g, "").trim() || null : null,
    headlineNorm: z.headline ? normBetreff(z.headline) || null : null,
    domains: (z.domains ?? "")
      .split(" ")
      .map((d) => d.toLowerCase().trim())
      .filter((d) => d.length > 0),
  }));
}

export interface AntwortVermerk {
  receivedAt: number;
  rawMessageId: string | null;
  fromAddr: string | null;
  excerpt: string | null;
}

/**
 * Haelt eine Antwort als Ereignis fest — idempotent ueber die Message-ID
 * der Antwort, damit derselbe Postfach-Durchlauf sie nicht doppelt vermerkt.
 * Steht die Meldung auf "ohne Rueckmeldung", wird sie zu "Antwort erhalten"
 * mit dem Mail-Datum; ein bereits gesetzter Ausgang bleibt unangetastet —
 * was aus der Antwort folgt, entscheidet der Betreiber im Detail.
 */
export function vermerkeAntwort(db: Db, correctionId: string, mail: AntwortVermerk): boolean {
  if (mail.rawMessageId) {
    const bekannt = db.get<{ anzahl: number }>(sql`
      SELECT COUNT(*) AS anzahl FROM response_events
      WHERE raw_message_id = ${mail.rawMessageId}
    `);
    if ((bekannt?.anzahl ?? 0) > 0) return false;
  }

  db.insert(responseEvents)
    .values({
      id: createId(),
      correctionId,
      kind: "reply",
      receivedAt: mail.receivedAt,
      rawMessageId: mail.rawMessageId,
      fromAddr: mail.fromAddr,
      excerpt: mail.excerpt,
    })
    .run();

  db.update(corrections)
    .set({ outcome: "acknowledged", respondedAt: mail.receivedAt })
    .where(
      sql`${corrections.id} = ${correctionId} AND ${corrections.outcome} IN ('open', 'no_response')`,
    )
    .run();

  return true;
}

/** Ein Ereignis, wie es vor dem Loeschen weggeschrieben wird. */
export interface BestaetigungsZeile {
  id: string;
  correctionId: string;
  ref: string;
  receivedAt: number;
  rawMessageId: string | null;
  fromAddr: string | null;
  excerpt: string | null;
  outcomeVorher: string;
  respondedAtVorher: number | null;
}

/** Ereignisse, deren Auszug auf eine Eingangsbestaetigung passt. */
function bestaetigungsEreignisse(db: Db, passt: (text: string) => boolean): BestaetigungsZeile[] {
  return db
    .all<BestaetigungsZeile>(sql`
      SELECT e.id, e.correction_id AS correctionId, c.ref,
             e.received_at AS receivedAt, e.raw_message_id AS rawMessageId,
             e.from_addr AS fromAddr, e.excerpt,
             c.outcome AS outcomeVorher, c.responded_at AS respondedAtVorher
      FROM response_events e JOIN corrections c ON c.id = e.correction_id
    `)
    .filter((zeile) => zeile.excerpt !== null && passt(zeile.excerpt));
}

/** Zaehlt sie, ohne etwas zu aendern. */
/** Ein Ereignis, dessen Auszug aus dem Postfach nachgeladen werden kann. */
export interface NachladeZeile {
  id: string;
  rawMessageId: string;
  laenge: number;
}

/**
 * Antworten mit Message-ID, deren Auszug kuerzer ist als das heutige Mass --
 * bei ihnen kann im Postfach noch mehr Text stehen.
 */
export function ereignisseZumNachladen(db: Db): NachladeZeile[] {
  return db.all<NachladeZeile>(sql`
    SELECT id, raw_message_id AS rawMessageId, LENGTH(COALESCE(excerpt, '')) AS laenge
    FROM response_events
    WHERE raw_message_id IS NOT NULL AND LENGTH(COALESCE(excerpt, '')) < ${AUSZUG_MAX_LENGTH}
    ORDER BY received_at
  `);
}

/** Schreibt den nachgeladenen Auszug; false, wenn er nichts Neues bringt. */
export function setzeAuszug(db: Db, ereignisId: string, auszug: string): boolean {
  const gekuerzt = auszug.slice(0, AUSZUG_MAX_LENGTH).trim();
  const alt = db.get<{ excerpt: string | null }>(sql`
    SELECT excerpt FROM response_events WHERE id = ${ereignisId}
  `);
  if (!alt || gekuerzt.length === 0 || gekuerzt === (alt.excerpt ?? "")) return false;
  db.update(responseEvents).set({ excerpt: gekuerzt }).where(eq(responseEvents.id, ereignisId)).run();
  return true;
}

/** Dieselben Treffer zum Sichten, bevor jemand sie loescht. */
export function listeBestaetigungen(
  db: Db,
  passt: (text: string) => boolean,
): BestaetigungsZeile[] {
  return bestaetigungsEreignisse(db, passt);
}

export function zaehleBestaetigungen(
  db: Db,
  passt: (text: string) => boolean,
): { ereignisse: number; meldungen: number } {
  const treffer = bestaetigungsEreignisse(db, passt);
  return {
    ereignisse: treffer.length,
    meldungen: new Set(treffer.map((t) => t.correctionId)).size,
  };
}

/**
 * Nimmt sie zurueck: Ereignis loeschen, und wenn danach keine Antwort mehr
 * zur Meldung steht, wieder auf "ohne Rueckmeldung". Ein von Hand gesetzter
 * Ausgang (korrigiert, abgelehnt) bleibt unangetastet.
 */
export function nimmBestaetigungenZurueck(
  db: Db,
  passt: (text: string) => boolean,
): { geloescht: number; wiederOffen: number; zeilen: BestaetigungsZeile[] } {
  const treffer = bestaetigungsEreignisse(db, passt);
  let wiederOffen = 0;

  for (const ereignis of treffer) {
    db.run(sql`DELETE FROM response_events WHERE id = ${ereignis.id}`);
  }

  for (const meldungId of new Set(treffer.map((t) => t.correctionId))) {
    const rest = db.get<{ anzahl: number }>(
      sql`SELECT COUNT(*) AS anzahl FROM response_events WHERE correction_id = ${meldungId}`,
    );
    if ((rest?.anzahl ?? 0) > 0) continue;
    const geaendert = db.run(
      sql`UPDATE corrections SET outcome = 'open', responded_at = NULL
          WHERE id = ${meldungId} AND outcome = 'acknowledged'`,
    );
    if (geaendert.changes > 0) wiederOffen += 1;
  }

  return { geloescht: treffer.length, wiederOffen, zeilen: treffer };
}

/**
 * Macht die Auszuege der ersten Laeufe lesbar: dort stehen noch Grenzmarken,
 * Kopfzeilen und base64. Das Postfach muss dafuer nicht gelesen werden.
 * Liefert die Zahl der geaenderten Ereignisse.
 */
export function macheAuszuegeLesbar(db: Db): number {
  const zeilen = db.all<{ id: string; excerpt: string | null }>(
    sql`SELECT id, excerpt FROM response_events WHERE excerpt IS NOT NULL`,
  );
  let geaendert = 0;
  for (const zeile of zeilen) {
    if (zeile.excerpt === null) continue;
    const lesbar = lesbarerText(zeile.excerpt).slice(0, 300).trim();
    if (lesbar.length === 0 || lesbar === zeile.excerpt) continue;
    db.run(sql`UPDATE response_events SET excerpt = ${lesbar} WHERE id = ${zeile.id}`);
    geaendert += 1;
  }
  return geaendert;
}
