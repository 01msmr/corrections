import { MATURITY_SECONDS, SEGMENT_MINDEST_ANTEIL, SEGMENT_MINDEST_ANZAHL, WEICHE_FEHLERARTEN } from "@korrektur/shared";
import { sql } from "drizzle-orm";
import type { Db } from "../db/client.js";

/**
 * Zahlen für die Bilanz-Seite (§9, §10). Die Quoten-Nenner folgen denselben
 * Regeln wie die SQL-Views: zustellbar (`sent` mit Zeitstempel) und reif
 * (Versand liegt ≥ MATURITY_SECONDS zurück). Absolutzahlen bleiben davon
 * unberührt — sie beschreiben, was erfasst wurde, nicht das Verhalten einer
 * Redaktion (§9.1).
 */

export interface Beteiligter {
  name: string;
  anzahl: number;
}

export interface Verteilungswert {
  name: string;
  anzahl: number;
  /** Nur bei den Fehlerarten: Medien-Anteile fuer die Segment-Darstellung. */
  beteiligte?: Beteiligter[];
}

/** Sichtbarer Name des Sammelpostens — auch die Ansicht erkennt ihn daran. */
export const UEBRIGE_NAME = "übrige";

/**
 * Medien-Segmente eines Balkens: eigenes Segment nur ab SEGMENT_MINDEST_ANTEIL
 * am Balken UND SEGMENT_MINDEST_ANZAHL Stueck; der Rest sammelt sich in
 * "uebrige". Alphabetisch, nicht nach Groesse — die Breite traegt die Menge,
 * eine Reihenfolge nach Groesse waere ein kleines Ranking je Balken (§2.2).
 * Qualifiziert sich kein Medium, bleibt der Balken einfarbig (leeres Array).
 */
export function segmentiere(gesamt: number, medien: Beteiligter[]): Beteiligter[] {
  const schwelle = Math.max(gesamt * SEGMENT_MINDEST_ANTEIL, SEGMENT_MINDEST_ANZAHL);
  const eigene = medien
    .filter((medium) => medium.anzahl >= schwelle)
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
  if (eigene.length === 0) return [];

  const rest = gesamt - eigene.reduce((summe, medium) => summe + medium.anzahl, 0);
  return rest > 0 ? [...eigene, { name: UEBRIGE_NAME, anzahl: rest }] : eigene;
}

export interface Monatswert {
  /** "2026-05" */
  monat: string;
  anzahl: number;
}

export interface Quotenstand {
  zaehler: number;
  nenner: number;
}

export interface Bilanz {
  meldungen: number;
  medien: number;
  /** Epoch-Sekunden der ältesten und jüngsten Meldung, null bei leerem Bestand. */
  von: number | null;
  bis: number | null;
  /** Meldungen, die die Reifegrenze überschritten haben und zustellbar sind. */
  reifUndZustellbar: number;
  korrektur: Quotenstand;
  antwort: Quotenstand;
  fehlerarten: Verteilungswert[];
  schwere: Verteilungswert[];
  medienListe: Verteilungswert[];
  verlauf: Monatswert[];
}

const SCHWERE_NAMEN: Record<number, string> = {
  1: "leicht",
  2: "mittel",
  3: "schwer",
};

export function ladeBilanz(
  db: Db,
  jetzt: number,
  optionen: { mitWeichen?: boolean } = {},
): Bilanz {
  const reifeGrenze = jetzt - MATURITY_SECONDS;
  /* Weiche Kategorien (teils Auslegungssache) bleiben in der Voreinstellung
     aus ALLEN Zahlen der Seite heraus -- eine Seite, eine Zaehlweise. Das
     Fragment laeuft als AND-Bedingung in jede Abfrage. */
  const weicheListe = WEICHE_FEHLERARTEN.map((key) => `'${key}'`).join(", ");
  const ohneWeiche = optionen.mitWeichen
    ? sql``
    : sql.raw(`AND error_type_id NOT IN (SELECT id FROM error_types WHERE key IN (${weicheListe}))`);

  const eckdaten = db
    .get<{ meldungen: number; medien: number; von: number | null; bis: number | null }>(sql`
      SELECT COUNT(*) AS meldungen,
             COUNT(DISTINCT outlet_id) AS medien,
             MIN(sent_at) AS von,
             MAX(sent_at) AS bis
      FROM corrections
      WHERE 1=1 ${ohneWeiche}
    `);

  /*
   * Entscheidend fuer die Ehrlichkeit der Seite: Eine Meldung, deren Artikel
   * nie geprueft wurde, ist nicht "nicht korrigiert" — sie ist ungeprueft und
   * gehoert damit gar nicht in den Nenner (§9.3 "pruefbar"). Ohne diese
   * Einschraenkung behauptete die Seite bei frischem Bestand eine
   * Korrekturquote von 0 %, obwohl niemand nachgesehen hat.
   *
   * Dasselbe gilt fuer Antworten: Solange kein Postfach-Abgleich lief (kein
   * Eintrag in imap_cursor), ist "keine Antwort erfasst" eine Aussage ueber
   * uns, nicht ueber die Redaktionen.
   */
  const basis = db.get<{ reif: number; geprueft: number; korrigiert: number; smtp: number; beantwortet: number }>(sql`
      SELECT
        COUNT(*) AS reif,
        SUM(CASE WHEN EXISTS (
          SELECT 1 FROM article_checks a WHERE a.correction_id = corrections.id
        ) THEN 1 ELSE 0 END) AS geprueft,
        SUM(CASE WHEN corrected_at IS NOT NULL AND verification = 'manual' THEN 1 ELSE 0 END) AS korrigiert,
        SUM(CASE WHEN dispatch_mode = 'smtp' THEN 1 ELSE 0 END) AS smtp,
        SUM(CASE WHEN dispatch_mode = 'smtp' AND EXISTS (
          SELECT 1 FROM response_events r WHERE r.correction_id = corrections.id AND r.kind = 'reply'
        ) THEN 1 ELSE 0 END) AS beantwortet
      FROM corrections
      WHERE dispatch_status = 'sent' AND sent_at IS NOT NULL AND sent_at <= ${reifeGrenze} ${ohneWeiche}
    `);

  const abgleichLief = (db.get<{ anzahl: number }>(sql`SELECT COUNT(*) AS anzahl FROM imap_cursor`)?.anzahl ?? 0) > 0;

  const fehlerarten = db.all<Verteilungswert>(sql`
      SELECT e.label AS name, COUNT(*) AS anzahl
      FROM corrections c JOIN error_types e ON e.id = c.error_type_id
      WHERE 1=1 ${ohneWeiche}
      GROUP BY e.label
      ORDER BY anzahl DESC, name ASC
    `);

  /* Je Fehlerart die Medien-Anteile fuer die Segment-Darstellung. */
  const fehlerartenMedien = db.all<{ name: string; medium: string; anzahl: number }>(sql`
      SELECT e.label AS name, o.name AS medium, COUNT(*) AS anzahl
      FROM corrections c
        JOIN error_types e ON e.id = c.error_type_id
        JOIN outlets o ON o.id = c.outlet_id
      WHERE 1=1 ${ohneWeiche}
      GROUP BY e.label, o.name
    `);
  const medienJeFehlerart = new Map<string, Beteiligter[]>();
  for (const zeile of fehlerartenMedien) {
    const liste = medienJeFehlerart.get(zeile.name) ?? [];
    liste.push({ name: zeile.medium, anzahl: zeile.anzahl });
    medienJeFehlerart.set(zeile.name, liste);
  }

  const schwereRoh = db.all<{ severity: number; anzahl: number }>(sql`
      SELECT severity, COUNT(*) AS anzahl FROM corrections WHERE 1=1 ${ohneWeiche} GROUP BY severity ORDER BY severity ASC
    `);

  /* Medien alphabetisch: die Zahl misst das Leseverhalten des Betreibers,
     eine Vorsortierung danach wäre ein Ranking (§2.2, §9.1). Umsortieren
     kann die Ansicht, wer es ausdrücklich anklickt. */
  const medienListe = db.all<Verteilungswert>(sql`
      SELECT o.name AS name, COUNT(*) AS anzahl
      FROM corrections c JOIN outlets o ON o.id = c.outlet_id
      WHERE 1=1 ${ohneWeiche}
      GROUP BY o.name
      ORDER BY o.name COLLATE NOCASE ASC
    `);

  const verlaufRoh = db.all<Monatswert>(sql`
      SELECT strftime('%Y-%m', sent_at, 'unixepoch') AS monat, COUNT(*) AS anzahl
      FROM corrections
      WHERE sent_at IS NOT NULL ${ohneWeiche}
      GROUP BY monat
      ORDER BY monat ASC
    `);

  return {
    meldungen: eckdaten?.meldungen ?? 0,
    medien: eckdaten?.medien ?? 0,
    von: eckdaten?.von ?? null,
    bis: eckdaten?.bis ?? null,
    reifUndZustellbar: basis?.reif ?? 0,
    korrektur: { zaehler: basis?.korrigiert ?? 0, nenner: basis?.geprueft ?? 0 },
    antwort: {
      zaehler: basis?.beantwortet ?? 0,
      nenner: abgleichLief ? (basis?.smtp ?? 0) : 0,
    },
    fehlerarten: fehlerarten.map((wert) => ({
      ...wert,
      beteiligte: segmentiere(wert.anzahl, medienJeFehlerart.get(wert.name) ?? []),
    })),
    schwere: schwereRoh.map((zeile) => ({
      name: SCHWERE_NAMEN[zeile.severity] ?? String(zeile.severity),
      anzahl: zeile.anzahl,
    })),
    medienListe,
    verlauf: lueckenFuellen(verlaufRoh),
  };
}

/**
 * Monate ohne Meldung als Null ergänzen. Ohne das stünden Juni und der
 * übernächste Mai direkt nebeneinander, und die Zeitachse behauptete einen
 * gleichmäßigen Verlauf, den es nicht gab.
 */
function lueckenFuellen(werte: Monatswert[]): Monatswert[] {
  const erster = werte[0];
  const letzter = werte[werte.length - 1];
  if (!erster || !letzter) return werte;

  const vorhanden = new Map(werte.map((wert) => [wert.monat, wert.anzahl]));
  const [startJahr, startMonat] = erster.monat.split("-").map(Number);
  const [endJahr, endMonat] = letzter.monat.split("-").map(Number);
  if (!startJahr || !startMonat || !endJahr || !endMonat) return werte;

  const reihe: Monatswert[] = [];
  for (let jahr = startJahr, monat = startMonat; ; ) {
    const schluessel = `${jahr}-${String(monat).padStart(2, "0")}`;
    reihe.push({ monat: schluessel, anzahl: vorhanden.get(schluessel) ?? 0 });
    if (jahr === endJahr && monat === endMonat) break;
    monat += 1;
    if (monat > 12) {
      monat = 1;
      jahr += 1;
    }
    // Schutz vor endloser Schleife bei unerwarteten Daten.
    if (reihe.length > 600) break;
  }
  return reihe;
}
