/** Eine Meldung zählt erst nach dieser Frist in einen Quoten-Nenner (§9.3). */
export const MATURITY_DAYS = 14;
export const MATURITY_SECONDS = MATURITY_DAYS * 24 * 60 * 60;

/** Unterhalb dieser Fallzahl wird keine Quote angezeigt, nur Rohzahlen (§9.4). */
export const MIN_N_FOR_RATE = 10;

/** z-Wert für das 95-%-Wilson-Intervall (§9.4). */
export const CONFIDENCE_Z = 1.959964;

/** Obergrenze für zitierte Fundstellen, Zitatrecht (§12). */
export const QUOTE_MAX_LENGTH = 200;

/** Zeichen vor und nach der Fundstelle je Kontext-Anker (§8.1). */
export const ANCHOR_LENGTH = 48;

/**
 * Die Farbwelt der Anwendung, an genau einer Stelle. Oberflaeche (CSS-Variablen
 * in layout.tsx) und Mail (Inline-Stile in compose.ts) fragen dieselben Werte
 * ab -- die Mail kennt nur die helle Fassung, weil ihr Papierton fest steht.
 */
export const PALETTE = {
  papier: "#f7f7f4",
  tinte: "#1b1f23",
  korrektur: "#bb2233",
  vorschlag: "#2f6f4e",
  rand: "#6b7480",
  linie: "#dcddd8",
  feld: "#fffffe",
  /** Schattenfarbe als RGB-Komponenten, damit die Deckkraft an der
   *  Verwendungsstelle bestimmt wird: `rgb(var(--schatten) / .35)`. */
  schatten: "0 0 0",
  /** Gegenstueck zu `schatten`: reines Weiss zum Mischen fester Grauwerte,
   *  die sich nicht mit dem Modus drehen sollen. */
  licht: "255 255 255",
} as const;

export const PALETTE_DUNKEL = {
  papier: "#16181b",
  tinte: "#e8e6e1",
  korrektur: "#e07b86",
  vorschlag: "#7bc39a",
  rand: "#949ba6",
  linie: "#2e3237",
  feld: "#1d2024",
  schatten: "0 0 0",
  licht: "255 255 255",
} as const;
