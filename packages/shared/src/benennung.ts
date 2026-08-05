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

export function benenneFehlerart(
  key: string,
  label: string,
  anzahl: number | null | undefined,
): string {
  const formen = FORMEN.get(key);
  if (!formen || anzahl === null || anzahl === undefined || anzahl < 1) return label;
  return `${zahlwort(anzahl)} ${anzahl === 1 ? formen.eins : formen.mehr}`;
}
