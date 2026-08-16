import { sql } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { ROBOTS_VERMERK } from "@korrektur/shared";
import { nenntKorrektur } from "../inbox/bestaetigung.js";

/**
 * Kandidaten fuer den Ausgangs-Abgleich: Meldungen auf "Antwort erhalten",
 * bei denen zwei unabhaengige Belege zusammenkommen -- die Redaktion nennt in
 * ihrer Antwort eine Korrektur, und die Artikel-Pruefung sieht die Fundstelle
 * wie vorgeschlagen geaendert.
 *
 * Gesetzt wird der Ausgang trotzdem von Hand (§9): ein Beleg ist Evidenz,
 * keine Entscheidung.
 */

export interface AbgleichZeile {
  id: string;
  ref: string;
  medium: string;
  kategorie: string;
  headline: string | null;
  articleUrl: string;
  quoteBefore: string;
  suggestion: string;
  auszug: string;
  antwortAm: number;
  geprueftAm: number;
  sicherheit: number;
  ankerlage: Ankerlage;
}

/** Anker gegriffen und der Text zwischen ihnen genau die Berichtigung. */
const SICHER = 100;

/**
 * Worauf der Befund beruht -- das entscheidet, wie schwer er wiegt:
 *
 * - `anker`: Anker gegriffen, die gemeldete Stelle traegt jetzt die
 *   Berichtigung. Nichts weiter zu pruefen.
 * - `altbestand`: Die Meldung hat gar keine Anker (aus alten Mails
 *   uebernommen, `anchor_quality = 'none'`). Der Rueckfall ist dort nicht
 *   die schwaechere, sondern die einzig moegliche Methode.
 * - `gerissen`: Anker waren da und haben nicht gegriffen -- der Artikel hat
 *   sich im Umfeld geaendert. Ein Blick hinein lohnt.
 */
export type Ankerlage = "anker" | "altbestand" | "gerissen";

/** Eine beantwortete Meldung samt juengstem Befund -- die Rohmenge. */
interface RohZeile extends AbgleichZeile {
  befund: string | null;
  ankerguete: string;
  beobachtet: string | null;
}

/**
 * Alle Meldungen auf "Antwort erhalten" mit ihrer juengsten Antwort und ihrem
 * juengsten Pruefbefund. Eine Abfrage fuer beide Verwender: die Warteschlange
 * filtert daraus, die Lage zaehlt darueber.
 */
function ladeRohzeilen(db: Db): RohZeile[] {
  return db.all<RohZeile>(sql`
    SELECT
      c.id, c.ref, o.name AS medium, e.label AS kategorie, c.headline,
      c.article_url AS articleUrl, c.quote_before AS quoteBefore,
      c.suggestion_after AS suggestion, r.excerpt AS auszug, r.received_at AS antwortAm,
      a.checked_at AS geprueftAm, a.match_confidence AS sicherheit,
      a.quote_state AS befund, c.anchor_quality AS ankerguete,
      a.observed_text AS beobachtet
    FROM corrections c
    JOIN outlets o ON o.id = c.outlet_id
    JOIN error_types e ON e.id = c.error_type_id
    /* Je Meldung die juengste Antwort und die juengste Pruefung. */
    JOIN response_events r ON r.id = (
      SELECT id FROM response_events
      WHERE correction_id = c.id AND kind = 'reply'
      ORDER BY received_at DESC, id DESC LIMIT 1
    )
    LEFT JOIN article_checks a ON a.id = (
      SELECT id FROM article_checks
      WHERE correction_id = c.id
      ORDER BY checked_at DESC, id DESC LIMIT 1
    )
    WHERE c.outcome = 'acknowledged'
    ORDER BY r.received_at, c.id
  `);
}

function ankerlage(zeile: RohZeile): Ankerlage {
  if ((zeile.sicherheit ?? 0) >= SICHER) return "anker";
  return zeile.ankerguete === "none" ? "altbestand" : "gerissen";
}

export function ladeAbgleichKandidaten(db: Db): AbgleichZeile[] {
  const reihenfolge: Record<Ankerlage, number> = { anker: 0, altbestand: 1, gerissen: 2 };
  return ladeRohzeilen(db)
    .filter(
      (zeile) =>
        /* Den Wortlaut prueft eine reine Funktion, nicht SQL -- dieselbe, die
           entscheidet, ob eine Mail mehr ist als eine Eingangsbestaetigung. */
        nenntKorrektur(zeile.auszug ?? "") && zeile.befund === "changed_as_suggested",
    )
    .map((zeile) => ({ ...zeile, ankerlage: ankerlage(zeile) }))
    /* Das Eindeutige zuerst; was einen Blick braucht, kommt danach. */
    .sort((a, b) => reihenfolge[a.ankerlage] - reihenfolge[b.ankerlage] || a.antwortAm - b.antwortAm);
}

/**
 * Warum die Warteschlange leer ist. Steht auf der Seite selbst, statt in
 * einem Werkzeug: die Frage stellt sich genau dort, wo nichts zu tun ist.
 */
export interface AbgleichLage {
  beantwortet: number;
  nenntKorrektur: number;
  ohnePruefung: number;
  starkGeaendert: number;
  schwachGeaendert: number;
  andererBefund: number;
  /* Die Aufschluesselung von andererBefund: dahinter stecken sehr
     verschiedene Lagen -- eine unveraenderte Stelle ist ein Widerspruch zur
     Redaktion, eine verschwundene oft nur eine Bezahlschranke. */
  unveraendert: number;
  andersGeaendert: number;
  verschwunden: number;
  unerreichbar: number;
  /* Zwei sehr verschiedene Gruende: ein Ausschluss ist die Entscheidung der
     Redaktion und funktioniert wie vorgesehen, ein gescheiterter Abruf ist
     unser Problem. */
  robotsAusschluss: number;
  abrufGescheitert: number;
}

export function ladeAbgleichLage(db: Db): AbgleichLage {
  const zeilen = ladeRohzeilen(db);
  const mitAussage = zeilen.filter((z) => nenntKorrektur(z.auszug ?? ""));
  const geaendert = mitAussage.filter((z) => z.befund === "changed_as_suggested");
  return {
    beantwortet: zeilen.length,
    nenntKorrektur: mitAussage.length,
    ohnePruefung: mitAussage.filter((z) => z.befund === null).length,
    starkGeaendert: geaendert.filter((z) => ankerlage(z) === "anker").length,
    schwachGeaendert: geaendert.filter((z) => ankerlage(z) !== "anker").length,
    andererBefund: mitAussage.filter(
      (z) => z.befund !== null && z.befund !== "changed_as_suggested",
    ).length,
    unveraendert: mitAussage.filter((z) => z.befund === "unchanged").length,
    andersGeaendert: mitAussage.filter((z) => z.befund === "changed_otherwise").length,
    verschwunden: mitAussage.filter((z) => z.befund === "passage_gone").length,
    unerreichbar: mitAussage.filter((z) => z.befund === "unreachable").length,
    robotsAusschluss: mitAussage.filter(
      (z) => z.befund === "unreachable" && z.beobachtet === ROBOTS_VERMERK,
    ).length,
    abrufGescheitert: mitAussage.filter(
      (z) => z.befund === "unreachable" && z.beobachtet !== ROBOTS_VERMERK,
    ).length,
  };
}
