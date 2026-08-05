/**
 * Sprachlich korrekte Benennung der zaehlbaren Fehlerarten: aus Schluessel,
 * Listen-Label und Anzahl entsteht die Formulierung fuer Formular, Vorschau
 * und Mail — "ein Zeichen fehlt", "2 Zeichen fehlen". Nicht zaehlbare oder
 * unbekannte Kategorien behalten ihr Listen-Label. Reine Funktionen.
 */

interface Sprachformen {
  /** Formulierung fuer genau eine Einheit. */
  eins: string;
  /** Grundform fuer mehrere; die Anzahl wird davorgestellt ("2 Zeichen fehlen"). */
  mehr: string;
}

const FORMEN = new Map<string, Sprachformen>([
  ["zeichen_fehlt", { eins: "ein Zeichen fehlt", mehr: "Zeichen fehlen" }],
  ["zeichen_zu_viel", { eins: "ein Zeichen zu viel", mehr: "Zeichen zu viel" }],
  ["komma_fehlt", { eins: "ein Satzzeichen fehlt", mehr: "Satzzeichen fehlen" }],
  ["komma_zu_viel", { eins: "ein Satzzeichen zu viel", mehr: "Satzzeichen zu viel" }],
  ["wort_fehlt", { eins: "ein Wort fehlt", mehr: "Wörter fehlen" }],
  ["wort_zu_viel", { eins: "ein Wort zu viel", mehr: "Wörter zu viel" }],
  ["buchstabendreher", { eins: "ein Buchstabendreher", mehr: "Buchstabendreher" }],
]);

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
  return anzahl === 1 ? formen.eins : `${anzahl} ${formen.mehr}`;
}
