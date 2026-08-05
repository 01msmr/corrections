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
  /** Anzahl aus dem Alt-Label ("zwei Zeichen fehlen" → 2), wenn zaehlbar. */
  fehlerartAnzahl: number | null;
  /** Konkretes Satzzeichen aus dem Alt-Label ("ein Komma fehlt" → ","). */
  fehlerartZeichen: string | null;
  falsch: string | null;
  richtig: string | null;
  konfidenz: Konfidenz;
}

/**
 * Alt-Label → heutiger Schluessel samt der im Label genannten Anzahl, nur
 * fuer die haeufigen, eindeutigen Formulierungen (~95 % des Korpus).
 * Kombinationen und Freitexte bleiben bewusst ungemappt — die Review-Queue
 * entscheidet.
 */
const FEHLERART_NACH_LABEL = new Map<
  string,
  { key: string; anzahl: number | null; zeichen?: string }
>([
  ["ein zeichen fehlt", { key: "zeichen_fehlt", anzahl: 1 }],
  ["zwei zeichen fehlen", { key: "zeichen_fehlt", anzahl: 2 }],
  ["2 zeichen fehlen", { key: "zeichen_fehlt", anzahl: 2 }],
  ["ein leerzeichen fehlt", { key: "zeichen_fehlt", anzahl: 1 }],
  ["zwei leerzeichen fehlen", { key: "zeichen_fehlt", anzahl: 2 }],
  ["eine worttrennung [leerzeichen] fehlt", { key: "zeichen_fehlt", anzahl: 1 }],
  ["ein zeichen zu viel", { key: "zeichen_zu_viel", anzahl: 1 }],
  ["zwei zeichen zu viel", { key: "zeichen_zu_viel", anzahl: 2 }],
  ["ein leerzeichen zu viel", { key: "zeichen_zu_viel", anzahl: 1 }],
  ["ein buchstabendreher", { key: "buchstabendreher", anzahl: 1 }],
  ["zwei buchstabendreher", { key: "buchstabendreher", anzahl: 2 }],
  ["ein komma fehlt", { key: "komma_fehlt", anzahl: 1, zeichen: "," }],
  ["zwei kommata fehlen", { key: "komma_fehlt", anzahl: 2, zeichen: "," }],
  ["zwei kommas fehlen", { key: "komma_fehlt", anzahl: 2, zeichen: "," }],
  ["ein satzzeichen fehlt", { key: "komma_fehlt", anzahl: 1 }],
  ["ein komma zu viel", { key: "komma_zu_viel", anzahl: 1, zeichen: "," }],
  ["zwei kommata zu viel", { key: "komma_zu_viel", anzahl: 2, zeichen: "," }],
  ["ein wort fehlt", { key: "wort_fehlt", anzahl: 1 }],
  ["zwei worte fehlen", { key: "wort_fehlt", anzahl: 2 }],
  ["drei worte fehlen", { key: "wort_fehlt", anzahl: 3 }],
  ["ein wort zu viel", { key: "wort_zu_viel", anzahl: 1 }],
  ["zwei worte zu viel", { key: "wort_zu_viel", anzahl: 2 }],
  ["drei worte zu viel", { key: "wort_zu_viel", anzahl: 3 }],
  ["falsche wortwahl", { key: "falsche_wortwahl", anzahl: null }],
  ["schlechte wortwahl", { key: "falsche_wortwahl", anzahl: null }],
  ["schlechter satzbau", { key: "satzbau", anzahl: null }],
  ["falscher satzbau", { key: "satzbau", anzahl: null }],
  ["sehr schlechter satzbau", { key: "satzbau", anzahl: null }],
  ["satzbau", { key: "satzbau", anzahl: null }],
  ["inhaltsfehler", { key: "inhaltsfehler", anzahl: null }],
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

  const zuordnung =
    fehlerartRoh !== null ? (FEHLERART_NACH_LABEL.get(fehlerartRoh.toLowerCase()) ?? null) : null;
  const fehlerartKey = zuordnung?.key ?? null;
  const fehlerartAnzahl = zuordnung?.anzahl ?? null;
  const fehlerartZeichen = zuordnung?.zeichen ?? null;

  const kern = artikelUrl !== null && falsch !== null && richtig !== null;
  const konfidenz: Konfidenz = !kern ? "verworfen" : fehlerartKey !== null ? "sicher" : "pruefen";

  return {
    ueberschrift,
    artikelUrl,
    fehlerartRoh,
    fehlerartKey,
    fehlerartAnzahl,
    fehlerartZeichen,
    falsch,
    richtig,
    konfidenz,
  };
}
