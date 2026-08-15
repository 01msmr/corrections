/**
 * Die Masse der Oberflaeche an einer Stelle -- was PALETTE fuer die Farben
 * ist. Aus den gewachsenen Werten verdichtet (16.8.2026); eine neue Stelle
 * nimmt die naechstliegende Stufe.
 */

/** Schriftgrade in rem. An `grund` haengen alle rem-Werte. */
export const GRAD = {
  /** Zaehler, Beschriftungen an Segmenten, Fussnoten. */
  winzig: ".75rem",
  /** Tabellenzellen, Chips, Karteninhalt. */
  klein: ".85rem",
  /** Kennungen, Knopfbeschriftungen in Zeilen, Blaetterreihe. */
  normal: ".95rem",
  /** Fliesstext. */
  grund: "1rem",
  /** Freistehende Knoepfe, Zwischenueberschriften. */
  stark: "1.25rem",
  /** Rubriken und das Ziehzeichen. */
  gross: "1.7rem",
  /** Seitentitel. */
  titel: "2rem",
  /** Der Zeitungstitel im Kopf -- einmalig, deshalb eine eigene Stufe. */
  zeitung: "2.68rem",
} as const;

/** Relative Grade: ein Verhaeltnis zur Zeile, keine Groesse fuer sich. */
export const GRAD_EM = {
  /** Pillen-Faktor: Chip, Pille und beigestelltes Zeichen auf 0,85 der
   *  Umgebung -- im Grad des Satzes sprengte die Marke ihre Zeile. */
  pille: ".85em",
  /** Die Kennung: die Schreibmaschine wirkt sonst kleiner als der Satz. */
  gehoben: "1.05em",
  gross: "1.2em",
} as const;

/** Zeilenhoehen. `keine` ist der Sonderfall eines rein gesetzten Zeichens. */
export const ZEILE = {
  keine: "0",
  /** Chips und Marken: die Zeile ist so hoch wie die Schrift. */
  eng: "1",
  /** Grosse Grade -- Titel brauchen weniger Durchschuss als Fliesstext. */
  titel: "1.15",
  knapp: "1.25",
  /** Tabellen und kurze Zeilen. */
  satz: "1.4",
  /** Fliesstext und Hinweiskaesten. */
  luftig: "1.6",
} as const;

/**
 * Abstaende in rem; der Schluessel nennt den Wert in Hundertstel (`r35` =
 * `.35rem`). Ein Rollenname waere an den meisten Stellen falsch.
 */
export const ABSTAND = {
  r10: ".1rem",
  r15: ".15rem",
  r25: ".25rem",
  r35: ".35rem",
  r50: ".5rem",
  r60: ".6rem",
  r70: ".7rem",
  r80: ".8rem",
  r95: ".95rem",
  r100: "1rem",
  r110: "1.1rem",
  r125: "1.25rem",
  r150: "1.5rem",
  r200: "2rem",
  r225: "2.25rem",
  r250: "2.5rem",
  r275: "2.75rem",
  r300: "3rem",
  r400: "4rem",
  r600: "6rem",
  /** Chip-Polster in Pixeln: soll nicht mit der Grundschrift wachsen. */
  px4: "4px",
  px9: "9px",
} as const;

/** Abstaende, die zur Schrift der Stelle wachsen. */
export const ABSTAND_EM = {
  e20: ".2em",
  e35: ".35em",
  e50: ".5em",
  e60: ".6em",
} as const;

/** Strichstaerken: Rahmen, Trennlinien, betonte Kanten. */
export const STRICH = {
  haar: "1px",
  kraeftig: "2px",
  balken: "4px",
  /** Die breite Marke am linken Rand eines Zitats. */
  markant: "7px",
} as const;

/** Eckenradien. `voll` rundet zur Pille, egal wie hoch das Element ist. */
export const RADIUS = {
  keiner: "0",
  klein: "4px",
  mittel: "6px",
  voll: "999px",
} as const;

/** Dauern. `flink` ist die Regel: begleiten, nicht vorfuehren. */
export const DAUER = {
  flink: ".12s",
  ruhig: ".2s",
  /** Ein- und Ausfahrt des Hinweis-Toasts. */
  fahrt: ".4s",
  /** Das Band im Kopf, das beim Scrollen weicht. */
  lang: "2s",
} as const;

/**
 * Umbruchpunkte, ungerundet: die `.0625rem`-Werte sind die Ein-Pixel-Partner
 * ihrer Grenze. Laufen sie auseinander, klafft ein Pixel ohne Ansicht.
 */
export const UMBRUCH = {
  /** Telefon: aus jeder Zeile wird eine Karte. */
  telefon: "40rem",
  abTablet: "40.0625rem",
  /** Nebenspalte des Erfassungsformulars. */
  schmal: "48rem",
  /** Tablet-Hochformat: die Tabelle bleibt, verliert aber Spalten. */
  tablet: "60rem",
  abBreit: "60.0625rem",
  /** Ressortleiste: darunter tragen die Pillen nur noch Icons. */
  pille: "62rem",
  abPille: "62.0625rem",
  /** Ganz breit: die Zaehlweise haengt neben dem Balken. */
  weit: "78rem",
  /** Container-Anfrage im Medien-Segment, nicht die Seitenbreite. */
  segmentEng: "3.5rem",
} as const;

/**
 * Schattenformen; Farbe aus PALETTE, Deckkraft aus DECKKRAFT. Gespiegelte
 * Zwillinge stehen einmal, das Vorzeichen setzt die Stelle.
 */
export const SCHATTEN = {
  /** Kasten, der ueber dem Satz schwebt: Klappliste und Hinweiskasten. */
  schwebe: "0 10px 22px -8px",
  /** Feste Leiste (Filterzeile oben, Blaetterreihe unten). */
  leiste: "10px 16px -14px",
  /** Schale in Bewegung: nah am Rand und schon fortgescrollt. */
  schaleNah: "34px 26px 40px",
  schaleFern: "48px 16px 40px",
  /** Der Hinweis-Toast. */
  toast: "0 6px 18px",
  /** Bleisatz-Klotz: ruhend, unter dem Zeiger angehoben, gedrueckt. */
  klotz: "9px 10px 10px -6px",
  klotzGehoben: "12px 13px 14px -7px",
  klotzVertieft: "inset 9px 10px 12px -5px",
} as const;

/** Sperrung. Die Schreibmaschine vertraegt Weite. */
export const SPERRUNG = {
  keine: "0",
  fein: ".02em",
  leicht: ".04em",
  weit: ".1em",
  /** Rubriken: gesperrt wie eine Zwischenzeile im Blei. */
  gesperrt: ".14em",
} as const;

/** Schriftschnitte. Mehr als diese drei kennt die Oberflaeche nicht. */
export const GEWICHT = {
  normal: "400",
  halbfett: "600",
  fett: "700",
} as const;

/** Stapelebenen -- eine z-Angabe bedeutet nur im Verhaeltnis zu den anderen etwas. */
export const EBENE = {
  /** Klebende Teile im Blatt: Filterzeile, feste Spalten einer Tabelle. */
  imBlatt: "1",
  /** Feste Leisten der Listenschale und die Fusszeile. */
  leiste: "4",
  /** Der klebende Kopf und der Hinweiskasten an seinem Zeichen. */
  kopf: "5",
  /** Der Hinweis-Toast, ueber Kopf und Leisten. */
  toast: "6",
  /** Die aufgeklappte Navigationsliste -- sie verdeckt alles. */
  klappliste: "7",
} as const;

/** Beschleunigungskurven der Toast-Fahrt. */
export const KURVE = {
  ein: "cubic-bezier(.215, .61, .355, 1)",
  aus: "cubic-bezier(.645, 0, .785, .39)",
} as const;

/** Hub der Bleisatz-Kloetze in Pixeln; `klotzKanten` zeichnet die Kanten. */
export const HUB = {
  ruhe: 5,
  gehoben: 7,
} as const;

/** Scrollwege der Kopf- und Fussanimationen (`animation-range`). */
export const SCROLLWEG = {
  marke: "2.5rem 4.5rem",
  kopf: "4rem 8rem",
  band: "1rem 5rem",
  fuss: "calc(100% - 4rem) 100%",
} as const;

/** Einmalige Masse: Breiten und Hoehen einer bestimmten Sache. Ungerundet. */
export const MASS = {
  /** Satzspiegel der Prosaseiten. */
  satzspiegel: "44rem",
  /** Ein Satzspiegel fuer alles: Kopf, Blatt und Fusszeile teilen ihn. */
  arbeitsbreite: "73.75rem",
  /** Hinweiskasten am Fragezeichen, gedeckelt auf die Fensterbreite. */
  hinweisbreite: "22rem",
  hinweisdeckel: "78vw",
  /** QR-Bild des Kurzbefehls: in der Zeile und aufgeklappt. */
  qrKlein: "8.5rem",
  qrGross: "20rem",
  /** Grundbreite des Textes neben dem QR-Bild; darunter bricht die Zeile um. */
  qrneben: "14rem",
  /** Eingabefelder: Anzahl, Textfeld, Zitat, aufgeklapptes Feld. */
  feldKlein: "4.5rem",
  feldMittel: "5.5rem",
  feldGross: "9rem",
  /** Der Abschlussknopf des Formulars. */
  knopfhoehe: "3.6rem",
  /** Suchfeld der Filterzeile: breit, im Fluss, als Untergrenze. */
  suchbreite: "12rem",
  suchbreiteFluss: "5rem",
  suchbreiteSchmal: "4.5rem",
  /** Select der schmalen Filterzeile. */
  filterselect: "6.5rem",
  /** Domainspalte der Medientabelle. */
  domainbreite: "13rem",
  /** Bilanz: Medienname, Menge, Spur, Kachelraster. */
  balkenname: "12rem",
  balkennameMin: "6rem",
  balkenmenge: "2.5rem",
  balkenspur: "1.58rem",
  kachel: "15rem",
  /** Verlaufsdiagramm: Hoehe und Saeulenbreite. */
  verlaufhoehe: "9rem",
  saeuleMin: "2.4rem",
  saeuleMax: "4rem",
  /** Das Band im Kopf, bevor es beim Scrollen weicht. */
  bandhoehe: "1.85rem",
  /** Rueckfall, solange das Seitenskript den Kopf noch nicht gemessen hat. */
  kopfhoehe: "4.6rem",
  /** Luft, die die Listenschale links und rechts stehen laesst. */
  schalenluft: "2.5rem",
  /** Weg des Toasts von oben herein. */
  toastweg: "24rem",
  /** Icon in einem Zeilenknopf. */
  zeilenicon: "1.15rem",
} as const;
