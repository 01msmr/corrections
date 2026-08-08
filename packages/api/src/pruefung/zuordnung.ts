import { detectErrorTypeKey } from "@korrektur/shared";

/**
 * Zuordnung der LanguageTool-Befunde auf unsere Kategorien (Spec
 * 2026-08-08). Rein, ohne IO — der Netzabruf liegt in languagetool.ts.
 *
 * Grundsatz: Was `detectErrorTypeKey` aus dem Paar falsch/richtig selbst
 * erkennt, gilt; die Tabelle unten greift nur, wo die Erkennung nichts
 * hergibt. So bleibt die Kategorienlogik an einer Stelle.
 */

/** Der Ausschnitt der LanguageTool-Antwort, den die Zuordnung braucht. */
export interface LtBefund {
  message: string;
  /** Lage der Fundstelle im **gesamten** eingereichten Text. */
  offset: number;
  length: number;
  replacements: { value: string }[];
  rule: { id: string; issueType: string; category: { id: string } };
}

export interface Fund {
  /** "hart" wird als Kandidat angeboten, "stil" nur nachrangig gezeigt. */
  art: "hart" | "stil";
  /** Fundstelle, wie sie im Artikel steht. */
  falsch: string;
  /** Erster Vorschlag von LanguageTool. */
  richtig: string;
  /** Ganzer Satz, in dem die Stelle steckt. */
  satz: string;
  /** Lage der Fundstelle **im Satz** — fuer die Hervorhebung. */
  start: number;
  laenge: number;
  /** Vorauswahl der Kategorie; null, wenn nichts sicher zuzuordnen ist. */
  fehlerartKey: string | null;
  /** Begruendung von LanguageTool, fuer die Anzeige. */
  hinweis: string;
  /** Regel-Kennung, damit ein Befund nachvollziehbar bleibt. */
  regel: string;
  /** Wie oft dieselbe Stelle im Artikel vorkommt (siehe ordneAlleZu). */
  anzahl: number;
}

/**
 * Regeln und Kategorien, die ohne Zutun der Erkennung eindeutig sind
 * (Spec: Zuordnungstabelle). Die erste zutreffende Zeile gewinnt.
 */
const ZUORDNUNG: { trifft: (b: LtBefund) => boolean; key: string }[] = [
  {
    trifft: (b) => b.rule.issueType === "whitespace" || b.rule.id.startsWith("WHITESPACE"),
    key: "leerzeichen_zu_viel",
  },
  {
    trifft: (b) =>
      b.rule.category.id === "HILFESTELLUNG_KOMMASETZUNG" || b.rule.id.startsWith("KOMMA"),
    key: "komma_fehlt",
  },
  { trifft: (b) => b.rule.issueType === "typographical", key: "zeichen_zu_viel" },
  { trifft: (b) => b.rule.issueType === "misspelling", key: "sonstiges" },
];

/** Ein Nachbartausch — genau das, was wir "Buchstabendreher" nennen. */
export function istBuchstabendreher(falsch: string, richtig: string): boolean {
  if (falsch.length !== richtig.length) return false;
  const abweichend: number[] = [];
  for (let i = 0; i < falsch.length; i++) {
    if (falsch[i] !== richtig[i]) abweichend.push(i);
    if (abweichend.length > 2) return false;
  }
  if (abweichend.length !== 2) return false;
  const [a, b] = abweichend as [number, number];
  return b === a + 1 && falsch[a] === richtig[b] && falsch[b] === richtig[a];
}

/**
 * Sucht den Satz, in dem die Fundstelle liegt. `sentenceRanges` kommt von
 * LanguageTool und zaehlt im selben Text wie `offset` — damit ist die Lage
 * exakt statt gesucht. Ohne passenden Bereich faellt die Zuordnung auf den
 * ganzen Text zurueck.
 */
function satzFuer(
  text: string,
  bereiche: [number, number][],
  offset: number,
): { satz: string; start: number } {
  const treffer = bereiche.find(([von, bis]) => offset >= von && offset < bis);
  if (!treffer) return { satz: text, start: offset };
  const [von, bis] = treffer;
  return { satz: text.slice(von, bis), start: offset - von };
}

/**
 * Wandelt einen LanguageTool-Befund in einen Fund um. null, wenn nichts
 * anzubieten ist: ohne Vorschlag laesst sich kein Feld vorbelegen, und ein
 * Vorschlag, der nichts aendert, ist kein Fehler.
 */
export function ordneZu(
  befund: LtBefund,
  text: string,
  bereiche: [number, number][],
): Fund | null {
  const vorschlag = befund.replacements[0]?.value;
  if (vorschlag === undefined) return null;

  const falsch = text.slice(befund.offset, befund.offset + befund.length);
  if (falsch.length === 0 || falsch === vorschlag) return null;

  const { satz, start } = satzFuer(text, bereiche, befund.offset);
  const erkannt = detectErrorTypeKey(falsch, vorschlag);
  const ausTabelle = ZUORDNUNG.find((zeile) => zeile.trifft(befund))?.key ?? null;

  return {
    art: befund.rule.issueType === "style" ? "stil" : "hart",
    falsch,
    richtig: vorschlag,
    satz,
    start,
    laenge: befund.length,
    /* Der Dreher geht der groben Rechtschreib-Zeile der Tabelle vor. */
    fehlerartKey: istBuchstabendreher(falsch, vorschlag)
      ? "buchstabendreher"
      : (erkannt ?? ausTabelle),
    hinweis: befund.message,
    regel: befund.rule.id,
    anzahl: 1,
  };
}

/**
 * Alle Befunde einer Antwort: harte zuerst, Stil danach, und gleiche Stellen
 * zusammengefasst. Ein Wort, das im Artikel sechsmal gleich falsch steht,
 * ist eine Fundstelle mit Anzahl sechs — sechs Zeilen waeren blosses
 * Rauschen. Behalten wird der erste Fund samt seinem Satz.
 */
export function ordneAlleZu(
  befunde: LtBefund[],
  text: string,
  bereiche: [number, number][],
): Fund[] {
  const nachStelle = new Map<string, Fund>();
  for (const befund of befunde) {
    const fund = ordneZu(befund, text, bereiche);
    if (!fund) continue;
    const schluessel = `${fund.falsch}\u0000${fund.richtig}`;
    const bekannt = nachStelle.get(schluessel);
    if (bekannt) bekannt.anzahl += 1;
    else nachStelle.set(schluessel, fund);
  }
  const funde = [...nachStelle.values()];
  return [
    ...funde.filter((fund) => fund.art === "hart"),
    ...funde.filter((fund) => fund.art === "stil"),
  ];
}
