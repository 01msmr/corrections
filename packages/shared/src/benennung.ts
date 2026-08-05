/**
 * Sprachlich korrekte Benennung der zaehlbaren Fehlerarten: aus Schluessel,
 * Listen-Label und Anzahl entsteht die Formulierung fuer Formular, Vorschau
 * und Mail — "ein Zeichen fehlt", "2 Zeichen fehlen". Nicht zaehlbare oder
 * unbekannte Kategorien behalten ihr Listen-Label. Reine Funktionen.
 */

interface Sprachformen {
  /** Singularform hinter der Ziffer: "1 Wort zu viel". */
  eins: string;
  /** Pluralform hinter der Ziffer: "2 Wörter zu viel". */
  mehr: string;
}

const FORMEN = new Map<string, Sprachformen>([
  ["zeichen_fehlt", { eins: "Zeichen fehlt", mehr: "Zeichen fehlen" }],
  ["zeichen_zu_viel", { eins: "Zeichen zu viel", mehr: "Zeichen zu viel" }],
  ["komma_fehlt", { eins: "Satzzeichen fehlt", mehr: "Satzzeichen fehlen" }],
  ["komma_zu_viel", { eins: "Satzzeichen zu viel", mehr: "Satzzeichen zu viel" }],
  ["wort_fehlt", { eins: "Wort fehlt", mehr: "Wörter fehlen" }],
  ["wort_zu_viel", { eins: "Wort zu viel", mehr: "Wörter zu viel" }],
  ["buchstabendreher", { eins: "Buchstabendreher", mehr: "Buchstabendreher" }],
]);

/* Ausgeschrieben bis zwoelf, wie es die Typografie haelt; darueber Ziffern.
   Index 1 ist "ein" (nicht "eins"), weil das Zahlwort vor dem Nomen steht. */
export const ZAHLWOERTER = [
  "", "ein", "zwei", "drei", "vier", "fünf", "sechs",
  "sieben", "acht", "neun", "zehn", "elf", "zwölf",
] as const;

export function zahlwort(anzahl: number): string {
  return ZAHLWOERTER[anzahl] ?? String(anzahl);
}

export function istZaehlbareFehlerart(key: string): boolean {
  return FORMEN.has(key);
}

/**
 * Namen der konkreten Satzzeichen, mit Artikel in der Einzahl ("eine
 * Klammer") und eigener Mehrzahl. Unbekannte Zeichen fallen auf die
 * generische Satzzeichen-Form zurueck.
 */
const SATZZEICHEN_NAMEN = new Map<string, { eins: string; mehr: string }>([
  [",", { eins: "ein Komma", mehr: "Kommata" }],
  [".", { eins: "ein Punkt", mehr: "Punkte" }],
  [";", { eins: "ein Semikolon", mehr: "Semikola" }],
  [":", { eins: "ein Doppelpunkt", mehr: "Doppelpunkte" }],
  ["!", { eins: "ein Ausrufezeichen", mehr: "Ausrufezeichen" }],
  ["?", { eins: "ein Fragezeichen", mehr: "Fragezeichen" }],
  ["–", { eins: "ein Gedankenstrich", mehr: "Gedankenstriche" }],
  ["—", { eins: "ein Gedankenstrich", mehr: "Gedankenstriche" }],
  ["-", { eins: "ein Bindestrich", mehr: "Bindestriche" }],
  ["(", { eins: "eine Klammer", mehr: "Klammern" }],
  [")", { eins: "eine Klammer", mehr: "Klammern" }],
  ["„", { eins: "ein Anführungszeichen", mehr: "Anführungszeichen" }],
  ["“", { eins: "ein Anführungszeichen", mehr: "Anführungszeichen" }],
  ["»", { eins: "ein Anführungszeichen", mehr: "Anführungszeichen" }],
  ["«", { eins: "ein Anführungszeichen", mehr: "Anführungszeichen" }],
]);

export function benenneFehlerart(
  key: string,
  label: string,
  anzahl: number | null | undefined,
  zeichen?: string | null,
): string {
  const formen = FORMEN.get(key);
  if (!formen || anzahl === null || anzahl === undefined || anzahl < 1) return label;

  /* Ist bei Satzzeichen-Fehlern das konkrete Zeichen bekannt, wird es beim
     Namen genannt: "ein Komma zu viel", "zwei Punkte fehlen". */
  const zeichenName = zeichen ? SATZZEICHEN_NAMEN.get(zeichen) : undefined;
  if (zeichenName && (key === "komma_fehlt" || key === "komma_zu_viel")) {
    const nachsatz = key === "komma_fehlt" ? (anzahl === 1 ? "fehlt" : "fehlen") : "zu viel";
    return anzahl === 1
      ? `${zeichenName.eins} ${nachsatz}`
      : `${zahlwort(anzahl)} ${zeichenName.mehr} ${nachsatz}`;
  }

  return `${zahlwort(anzahl)} ${anzahl === 1 ? formen.eins : formen.mehr}`;
}
