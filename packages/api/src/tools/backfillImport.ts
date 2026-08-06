import {
  canonicalizeUrl,
  detectSeverity,
  generateRef,
  type DetectedErrorTypeKey,
} from "@korrektur/shared";
import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { corrections, outlets } from "../db/schema.js";
import { reserveRef } from "../repo/corrections.js";
import { getErrorTypeByKey } from "../repo/errorTypes.js";
import { ensureOutletForHost } from "../repo/outlets.js";

/**
 * Import der Review-Entscheidungen (Spec §11.2): uebernommene Altmeldungen
 * werden zu corrections-Datensaetzen mit source='backfill'. Kein Versand,
 * kein Artikelabruf — der Versand ist historisch belegt (Gesendet-Ordner),
 * die Anker sind nicht rekonstruierbar (anchor_quality='none'). Idempotent
 * ueber die Message-ID: ein zweiter Lauf ueberspringt Vorhandenes.
 *
 * Liegt im api-Paket, damit Schema, Migrationen und Repos nicht dupliziert
 * werden. Reine Logik ohne Dateizugriff — den Einstieg samt Pfaden und
 * Ausgabe traegt `backfillImportCli.ts`. Der Server bekommt dieses Werkzeug
 * mitgeliefert, es laeuft dort aber nur auf Zuruf: weder Passenger noch der
 * Cronjob rufen es auf (§11.5).
 */

export interface ReviewEntscheidung {
  datei: string;
  entscheidung: "uebernommen" | "verworfen";
  felder?: {
    ueberschrift?: string | null;
    artikelUrl?: string | null;
    fehlerartKey?: string | null;
    anzahl?: string | null;
    zeichen?: string | null;
    falsch?: string | null;
    richtig?: string | null;
  };
  messageId?: string | null;
  gesendetAm?: string | null;
  empfaenger?: string | null;
}

export interface ImportErgebnis {
  uebernommen: number;
  uebersprungen: number;
  nichtUebernommen: number;
  fehler: string[];
}

/**
 * Traegt Medien ohne Kontaktadresse die Adresse nach, an die tatsaechlich
 * gesendet wurde: Sie steht in jeder Altmeldung, weil der Kurzbefehl sie
 * beim Versand gesetzt hat. Genommen wird die haeufigste Adresse des
 * Mediums — bei heise.de etwa newstipps@ (fuenfmal) statt webmaster@
 * (einmal). Vorhandene Adressen bleiben unberuehrt; von Hand gepflegte
 * Angaben sind verlaesslicher als abgeleitete.
 */
export function ergaenzeKontaktadressen(db: Db): number {
  const ohneAdresse = db
    .select({ id: outlets.id, contactEmails: outlets.contactEmails })
    .from(outlets)
    .all()
    .filter((zeile) => zeile.contactEmails.length === 0);

  let ergaenzt = 0;
  for (const outlet of ohneAdresse) {
    const haeufigkeit = new Map<string, number>();
    for (const zeile of db
      .select({ mail: corrections.recipientEmail })
      .from(corrections)
      .where(eq(corrections.outletId, outlet.id))
      .all()) {
      if (zeile.mail) haeufigkeit.set(zeile.mail, (haeufigkeit.get(zeile.mail) ?? 0) + 1);
    }
    const beste = [...haeufigkeit.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    if (!beste) continue;

    db.update(outlets).set({ contactEmails: [beste[0]] }).where(eq(outlets.id, outlet.id)).run();
    ergaenzt += 1;
  }
  return ergaenzt;
}

/**
 * Liest die JSONL-Datei der Review. Eine kaputte Zeile bringt den Lauf nicht
 * zu Fall — sie wird gemeldet, der Rest wird importiert. Rein, damit sowohl
 * das Kommandozeilen-Werkzeug als auch die Adminseite dieselbe Lesart haben.
 */
export function leseEntscheidungen(inhalt: string): {
  eintraege: ReviewEntscheidung[];
  fehler: string[];
} {
  const eintraege: ReviewEntscheidung[] = [];
  const fehler: string[] = [];
  const zeilen = inhalt.split("\n");
  zeilen.forEach((zeile, index) => {
    const getrimmt = zeile.trim();
    if (getrimmt.length === 0) return;
    try {
      eintraege.push(JSON.parse(getrimmt) as ReviewEntscheidung);
    } catch {
      fehler.push(`Zeile ${index + 1}: kein gültiges JSON`);
    }
  });
  return { eintraege, fehler };
}

/** Schluessel, fuer die die Schwere-Heuristik definiert ist (Typwaechter). */
const DETECT_KEYS = new Set([
  "zeichen_fehlt", "zeichen_zu_viel", "buchstabendreher", "komma_fehlt", "komma_zu_viel",
  "wort_fehlt", "wort_zu_viel", "falsche_zahl", "falsches_datum", "falscher_name",
  "falsche_wortwahl", "satzbau",
]);

function istDetectKey(key: string): key is DetectedErrorTypeKey {
  return DETECT_KEYS.has(key);
}

export function importiereEntscheidungen(
  db: Db,
  eintraege: ReviewEntscheidung[],
  now: number,
): ImportErgebnis {
  const ergebnis: ImportErgebnis = { uebernommen: 0, uebersprungen: 0, nichtUebernommen: 0, fehler: [] };

  for (const eintrag of eintraege) {
    if (eintrag.entscheidung !== "uebernommen") {
      ergebnis.nichtUebernommen += 1;
      continue;
    }
    const { felder, messageId, empfaenger } = eintrag;
    const artikelUrl = felder?.artikelUrl ?? null;
    const fehlerartKey = felder?.fehlerartKey ?? null;
    const falsch = felder?.falsch ?? null;
    const richtig = felder?.richtig ?? null;
    if (!messageId || !empfaenger || !artikelUrl || !fehlerartKey || !falsch || !richtig) {
      ergebnis.fehler.push(`${eintrag.datei}: Pflichtfeld fehlt`);
      continue;
    }

    const idempotencyKey = `backfill:${messageId}`.slice(0, 128);
    const vorhanden = db
      .select({ id: corrections.id })
      .from(corrections)
      .where(eq(corrections.idempotencyKey, idempotencyKey))
      .get();
    if (vorhanden) {
      ergebnis.uebersprungen += 1;
      continue;
    }

    const canon = canonicalizeUrl(artikelUrl);
    if (!canon) {
      ergebnis.fehler.push(`${eintrag.datei}: URL nicht verwertbar`);
      continue;
    }
    const errorType = getErrorTypeByKey(db, fehlerartKey);
    if (!errorType) {
      ergebnis.fehler.push(`${eintrag.datei}: unbekannte Fehlerart ${fehlerartKey}`);
      continue;
    }

    const gesendet = eintrag.gesendetAm ? Date.parse(eintrag.gesendetAm) : Number.NaN;
    const sentAt = Number.isNaN(gesendet) ? now : Math.floor(gesendet / 1000);
    const anzahlRoh = Number(felder?.anzahl ?? "");
    const errorCount = Number.isInteger(anzahlRoh) && anzahlRoh >= 1 ? anzahlRoh : null;
    const severity =
      (istDetectKey(fehlerartKey) ? detectSeverity(falsch, richtig, fehlerartKey) : null) ?? 2;

    const { outlet } = ensureOutletForHost(db, canon.host, sentAt);
    reserveRef(generateRef, (ref) => {
      db.insert(corrections)
        .values({
          id: createId(),
          ref,
          idempotencyKey,
          createdAt: sentAt,
          dispatchMode: "smtp",
          articleUrl: artikelUrl,
          articleUrlCanon: canon.canonical,
          outletId: outlet.id,
          headline: felder?.ueberschrift ?? null,
          errorTypeId: errorType.id,
          errorCount,
          errorChar: felder?.zeichen ?? null,
          severity,
          quoteBefore: falsch,
          suggestionAfter: richtig,
          anchorQuality: "none",
          recipientEmail: empfaenger,
          messageId,
          dispatchStatus: "sent",
          sentAt,
          /* Der Gesendet-Ordner belegt den Versand; damit zaehlt die Meldung
             zur SMTP-Population der Antwortquote (§9.3, §11.3). */
          sendConfirmedBy: "smtp",
          verification: "none",
          source: "backfill",
          needsReview: false,
        })
        .run();
    });
    ergebnis.uebernommen += 1;
  }

  return ergebnis;
}
