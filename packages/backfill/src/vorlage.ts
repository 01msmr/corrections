/**
 * Vorlagenspezifischer Parser fuer die Kurzbefehl-Mails (Spec §11.1): keine
 * Allzweck-Heuristik, sondern die feste Struktur der einen Vorlage. Reine
 * Funktion ohne IO; die MIME-Schicht liefert Betreff und entpackten
 * text/plain-Teil an. Was nicht sicher erkannt wird, wird verworfen oder
 * zur Pruefung markiert statt geraten (§11.4).
 */

export type Konfidenz = "sicher" | "pruefen" | "verworfen";

export interface VorlagenErgebnis {
  ueberschrift: string | null;
  artikelUrl: string | null;
  fehlerartRoh: string | null;
  /** Heutiger Fehlerart-Schluessel, wenn das Alt-Label eindeutig zuzuordnen ist. */
  fehlerartKey: string | null;
  falsch: string | null;
  richtig: string | null;
  konfidenz: Konfidenz;
}

/**
 * Alt-Label → heutiger Schluessel, nur fuer die haeufigen, eindeutigen
 * Formulierungen (~95 % des Korpus). Kombinationen und Freitexte bleiben
 * bewusst ungemappt — die Review-Queue entscheidet.
 */
const FEHLERART_NACH_LABEL = new Map<string, string>([
  ["ein zeichen fehlt", "zeichen_fehlt"],
  ["zwei zeichen fehlen", "zeichen_fehlt"],
  ["2 zeichen fehlen", "zeichen_fehlt"],
  ["ein leerzeichen fehlt", "zeichen_fehlt"],
  ["zwei leerzeichen fehlen", "zeichen_fehlt"],
  ["eine worttrennung [leerzeichen] fehlt", "zeichen_fehlt"],
  ["ein zeichen zu viel", "zeichen_zu_viel"],
  ["zwei zeichen zu viel", "zeichen_zu_viel"],
  ["ein leerzeichen zu viel", "zeichen_zu_viel"],
  ["ein buchstabendreher", "buchstabendreher"],
  ["zwei buchstabendreher", "buchstabendreher"],
  ["ein komma fehlt", "komma_fehlt"],
  ["zwei kommata fehlen", "komma_fehlt"],
  ["zwei kommas fehlen", "komma_fehlt"],
  ["ein satzzeichen fehlt", "komma_fehlt"],
  ["ein komma zu viel", "komma_zu_viel"],
  ["zwei kommata zu viel", "komma_zu_viel"],
  ["ein wort fehlt", "wort_fehlt"],
  ["zwei worte fehlen", "wort_fehlt"],
  ["drei worte fehlen", "wort_fehlt"],
  ["ein wort zu viel", "wort_zu_viel"],
  ["zwei worte zu viel", "wort_zu_viel"],
  ["drei worte zu viel", "wort_zu_viel"],
  ["falsche wortwahl", "falsche_wortwahl"],
  ["schlechte wortwahl", "falsche_wortwahl"],
  ["schlechter satzbau", "satzbau"],
  ["falscher satzbau", "satzbau"],
  ["sehr schlechter satzbau", "satzbau"],
  ["satzbau", "satzbau"],
  ["inhaltsfehler", "inhaltsfehler"],
]);

/** Inhalt des ersten „…“-Paars, sonst null. Innere Anfuehrungen bleiben
 *  erhalten, weil bis zum letzten schliessenden Zeichen gelesen wird. */
function zitat(text: string): string | null {
  const start = text.indexOf("„");
  const ende = text.lastIndexOf("“");
  if (start === -1 || ende <= start) return null;
  const inhalt = text.slice(start + 1, ende).trim();
  return inhalt.length > 0 ? inhalt : null;
}

const FALSCH_MARKER = /Falsch ist \(([^)]*)\)\s*:/;
/* "Richtig wäre m. M. n.:" in allen belegten Spielarten: das Verb wechselt
   ("Besser", "Richtiger", "Viel angemessener", …), der Einschub vor dem
   Doppelpunkt auch. Getragen wird der Marker von "wäre …:" als eigener
   Zeile; Anfuehrungszeichen sind ausgeschlossen, damit keine Zeile aus dem
   zitierten Text als Marker gelesen wird. */
const RICHTIG_MARKER = /(?:^|\n)[^\n„“]{0,60}wäre[^\n:„“]{0,60}:[^\S\n]*\n/;
const TRENNER = /_{4,}/;

export function parseVorlage(betreff: string, text: string): VorlagenErgebnis {
  const falschMarker = FALSCH_MARKER.exec(text);
  const richtigMarker = RICHTIG_MARKER.exec(text);

  const kopf = falschMarker ? text.slice(0, falschMarker.index) : text;

  const urlTreffer = /siehe:\s*(\S+)/.exec(kopf);
  const artikelUrl = urlTreffer?.[1] ? urlTreffer[1].replace(/[,.)]+$/, "") : null;

  // Ueberschrift: das Zitat im Kopf vor der URL-Zeile; ersatzweise der
  // Betreff ohne den festen Vorspann der Vorlage.
  const kopfVorUrl = urlTreffer ? kopf.slice(0, urlTreffer.index) : kopf;
  const ueberschrift =
    zitat(kopfVorUrl) ?? (betreff.startsWith("Textfehler im Artikel: ")
      ? betreff.slice("Textfehler im Artikel: ".length).trim()
      : null);

  let fehlerartRoh: string | null = null;
  let falsch: string | null = null;
  let richtig: string | null = null;

  if (falschMarker && richtigMarker && richtigMarker.index > falschMarker.index) {
    fehlerartRoh = falschMarker[1]?.trim() ?? null;
    const falschTeil = text.slice(falschMarker.index + falschMarker[0].length, richtigMarker.index);
    falsch = zitat(falschTeil);

    const nachRichtig = text.slice(richtigMarker.index + richtigMarker[0].length);
    const trenner = TRENNER.exec(nachRichtig);
    richtig = zitat(trenner ? nachRichtig.slice(0, trenner.index) : nachRichtig);
  }

  const fehlerartKey =
    fehlerartRoh !== null ? (FEHLERART_NACH_LABEL.get(fehlerartRoh.toLowerCase()) ?? null) : null;

  const kern = artikelUrl !== null && falsch !== null && richtig !== null;
  const konfidenz: Konfidenz = !kern ? "verworfen" : fehlerartKey !== null ? "sicher" : "pruefen";

  return { ueberschrift, artikelUrl, fehlerartRoh, fehlerartKey, falsch, richtig, konfidenz };
}
