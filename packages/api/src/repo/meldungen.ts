import { sql } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { corrections } from "../db/schema.js";

/**
 * Die Meldungshistorie (Plan 2026-08-13): nummerierte, filterbare Liste
 * aller Meldungen und der erste Schreiber des Ausgangs.
 *
 * Die laufende Nummer zaehlt chronologisch ueber den **Gesamtbestand**
 * (Versandzeit, ersatzweise Erfassungszeit) und bleibt beim Filtern stabil:
 * Filter erzeugen Luecken, keine Umnummerierung — sonst waere "Nr. 812"
 * nichts wert.
 *
 * Nicht oeffentlich: Aufrufer ist allein der Admin-Router, der sich selbst
 * hinter die Auth stellt (Verteidigung in der Tiefe, siehe Route).
 */

export type Ausgang = (typeof corrections.$inferSelect)["outcome"];

/** Die Werte, die das Formular anbietet — no_response ist nur noch lesbar. */
export const AUSGAENGE = [
  "open",
  "acknowledged",
  "corrected",
  "corrected_other",
  "rejected",
] as const satisfies readonly Ausgang[];

export function istAusgang(wert: string): wert is (typeof AUSGAENGE)[number] {
  return (AUSGAENGE as readonly string[]).includes(wert);
}

export interface MeldungsFilter {
  outletId?: string | undefined;
  errorTypeId?: string | undefined;
  ausgang?: Ausgang | undefined;
  /** Sucht in Kennung, Ueberschrift und Adresse. */
  suche?: string | undefined;
}

export interface MeldungsZeile {
  nummer: number;
  id: string;
  ref: string;
  zeitpunkt: number;
  medium: string;
  headline: string | null;
  articleUrl: string;
  kategorie: string;
  /** Schluessel der Kategorie — die Liste erkennt daran die weichen. */
  kategorieKey: string;
  severity: number;
  outcome: Ausgang;
  respondedAt: number | null;
}

export const SEITENGROESSE = 100;

/** LIKE-Sonderzeichen entwerten; der Suchbegriff ist Text, kein Muster. */
function likeMuster(suche: string): string {
  return `%${suche.replace(/[%_\\]/g, (z) => `\\${z}`)}%`;
}

/* Filter und Nummernvergabe muessen sich einig sein: die Nummer entsteht
   ueber dem ungefilterten Bestand, gefiltert wird erst aussen. */
const NUMMERIERT = sql`
  SELECT c.*, ROW_NUMBER() OVER (ORDER BY COALESCE(c.sent_at, c.created_at), c.id) AS nummer
  FROM corrections c
`;

function filterKlausel(filter: MeldungsFilter): ReturnType<typeof sql> {
  const bedingungen = [sql`1 = 1`];
  if (filter.outletId) bedingungen.push(sql`n.outlet_id = ${filter.outletId}`);
  if (filter.errorTypeId) bedingungen.push(sql`n.error_type_id = ${filter.errorTypeId}`);
  if (filter.ausgang) bedingungen.push(sql`n.outcome = ${filter.ausgang}`);
  if (filter.suche?.trim()) {
    const muster = likeMuster(filter.suche.trim());
    bedingungen.push(
      sql`(n.ref LIKE ${muster} ESCAPE '\\' OR n.headline LIKE ${muster} ESCAPE '\\' OR n.article_url LIKE ${muster} ESCAPE '\\')`,
    );
  }
  return sql.join(bedingungen, sql` AND `);
}

export function listeMeldungen(
  db: Db,
  filter: MeldungsFilter = {},
  seite = 1,
): MeldungsZeile[] {
  const offset = (Math.max(1, seite) - 1) * SEITENGROESSE;
  return db.all<MeldungsZeile>(sql`
    SELECT
      n.nummer,
      n.id,
      n.ref,
      COALESCE(n.sent_at, n.created_at) AS zeitpunkt,
      o.name AS medium,
      n.headline,
      n.article_url AS articleUrl,
      e.label AS kategorie,
      e.key AS kategorieKey,
      n.severity,
      n.outcome,
      n.responded_at AS respondedAt
    FROM (${NUMMERIERT}) n
    JOIN outlets o ON o.id = n.outlet_id
    JOIN error_types e ON e.id = n.error_type_id
    WHERE ${filterKlausel(filter)}
    ORDER BY n.nummer DESC
    LIMIT ${SEITENGROESSE} OFFSET ${offset}
  `);
}

export function zaehleMeldungen(db: Db, filter: MeldungsFilter = {}): number {
  return (
    db.get<{ anzahl: number }>(sql`
      SELECT COUNT(*) AS anzahl
      FROM (${NUMMERIERT}) n
      WHERE ${filterKlausel(filter)}
    `)?.anzahl ?? 0
  );
}

export interface MeldungsEreignis {
  zeitpunkt: number;
  /** "reply" | "autoreply" | "bounce" aus response_events, sonst der quote_state der Pruefung. */
  art: string;
  hinweis: string | null;
}

export interface MeldungsDetail {
  nummer: number;
  meldung: typeof corrections.$inferSelect;
  medium: string;
  kategorie: string;
  ereignisse: MeldungsEreignis[];
}

export function leseMeldung(db: Db, id: string): MeldungsDetail | null {
  const kopf = db.get<{ nummer: number; medium: string; kategorie: string }>(sql`
    SELECT n.nummer, o.name AS medium, e.label AS kategorie
    FROM (${NUMMERIERT}) n
    JOIN outlets o ON o.id = n.outlet_id
    JOIN error_types e ON e.id = n.error_type_id
    WHERE n.id = ${id}
  `);
  if (!kopf) return null;

  const meldung = db
    .select()
    .from(corrections)
    .where(sql`${corrections.id} = ${id}`)
    .get();
  if (!meldung) return null;

  const ereignisse = db.all<MeldungsEreignis>(sql`
    SELECT received_at AS zeitpunkt, kind AS art, excerpt AS hinweis
    FROM response_events WHERE correction_id = ${id}
    UNION ALL
    SELECT checked_at AS zeitpunkt, quote_state AS art,
      CASE WHEN http_status IS NULL THEN NULL ELSE 'HTTP ' || http_status END AS hinweis
    FROM article_checks WHERE correction_id = ${id}
    ORDER BY zeitpunkt
  `);

  return { nummer: kopf.nummer, meldung, medium: kopf.medium, kategorie: kopf.kategorie, ereignisse };
}

export interface AusgangsAngaben {
  outcome: (typeof AUSGAENGE)[number];
  /** Datum der echten Antwort (Eingangsbestaetigungen zaehlen nicht). */
  respondedAt: number | null;
  correctedAt: number | null;
  /** Der tatsaechliche Wortlaut, wenn anders korrigiert wurde. */
  correctedText?: string | null;
}

/** Schreibt den Ausgang; `false`, wenn es die Meldung nicht gibt. */
export function setzeAusgang(db: Db, id: string, angaben: AusgangsAngaben): boolean {
  const ergebnis = db
    .update(corrections)
    .set({
      outcome: angaben.outcome,
      respondedAt: angaben.respondedAt,
      correctedAt: angaben.correctedAt,
      ...(angaben.correctedText === undefined ? {} : { correctedText: angaben.correctedText }),
      /* Das Korrekturdatum kommt nur von Hand (Spec 8.3) -- wer es setzt,
         bestaetigt damit. Ohne diese Zeile blieb `verification` auf "none"
         und die Korrekturquote zaehlte nichts. */
      verification: angaben.correctedAt === null ? "none" : "manual",
    })
    .where(sql`${corrections.id} = ${id}`)
    .run();
  return ergebnis.changes > 0;
}
