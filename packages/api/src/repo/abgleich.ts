import { sql } from "drizzle-orm";
import type { Db } from "../db/client.js";
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
}

/**
 * Nur der starke Befund zaehlt: Anker gegriffen, und der Text zwischen ihnen
 * ist genau die Berichtigung. Der Rueckfall (die Berichtigung steht irgendwo
 * im Artikel, Sicherheit 50) belegt nicht, dass *unsere* Fundstelle geaendert
 * wurde -- bei kurzen Vorschlaegen kann er Zufall sein.
 */
const SICHER = 100;

export function ladeAbgleichKandidaten(db: Db): AbgleichZeile[] {
  const zeilen = db.all<AbgleichZeile>(sql`
    SELECT
      c.id, c.ref, o.name AS medium, e.label AS kategorie, c.headline,
      c.article_url AS articleUrl, c.quote_before AS quoteBefore,
      c.suggestion_after AS suggestion, r.excerpt AS auszug, r.received_at AS antwortAm,
      a.checked_at AS geprueftAm, a.match_confidence AS sicherheit
    FROM corrections c
    JOIN outlets o ON o.id = c.outlet_id
    JOIN error_types e ON e.id = c.error_type_id
    /* Je Meldung die juengste Antwort und die juengste Pruefung. */
    JOIN response_events r ON r.id = (
      SELECT id FROM response_events
      WHERE correction_id = c.id AND kind = 'reply'
      ORDER BY received_at DESC, id DESC LIMIT 1
    )
    JOIN article_checks a ON a.id = (
      SELECT id FROM article_checks
      WHERE correction_id = c.id
      ORDER BY checked_at DESC, id DESC LIMIT 1
    )
    WHERE c.outcome = 'acknowledged'
      AND a.quote_state = 'changed_as_suggested'
      AND a.match_confidence >= ${SICHER}
    ORDER BY r.received_at, c.id
  `);
  /* Den Wortlaut prueft eine reine Funktion, nicht SQL -- dieselbe, die
     entscheidet, ob eine Mail mehr ist als eine Eingangsbestaetigung. */
  return zeilen.filter((zeile) => nenntKorrektur(zeile.auszug ?? ""));
}
