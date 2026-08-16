/**
 * Eine Meldung zählt erst nach dieser Frist in einen Quoten-Nenner (§9.3).
 * Drei Wochen statt zwei (16.8.2026): Redaktionen antworten oft erst nach
 * einer Woche, und eine zu kurze Frist misst die eigene Ungeduld.
 */
export const MATURITY_DAYS = 21;
export const MATURITY_SECONDS = MATURITY_DAYS * 24 * 60 * 60;

/** Unterhalb dieser Fallzahl wird keine Quote angezeigt, nur Rohzahlen (§9.4). */
export const MIN_N_FOR_RATE = 10;

/** Weiche Kategorien: teils Auslegungssache, deshalb blendet die Bilanz sie
 *  in der Voreinstellung aus (Umschalter ?alle=1). Erweiterbar. */
export const WEICHE_FEHLERARTEN = ["schlechter_satzbau"] as const;

/**
 * So viel Antworttext wird zur Meldung abgelegt. 300 Zeichen waren zu knapp:
 * bei mehrteiligen Mails gingen Anrede und Dankessatz davon ab, der Satz zur
 * Sache stand nicht mehr drin -- und ohne ihn ist eine erledigte Korrektur
 * nicht von einer Eingangsbestaetigung zu unterscheiden.
 */
export const AUSZUG_MAX_LENGTH = 1500;

/** Anfang jedes Betreffs, den wir versenden -- und schon der des alten
 *  Kurzbefehls. Die Antwort-Zuordnung streicht ihn wieder weg. */
export const SUBJECT_PREFIX = "Textfehler im Artikel";

/** Sagt die Mail etwas zur Sache, ist sie keine Eingangsbestaetigung --
 *  auch wenn ein Muster unten trifft. Der Leserservice setzt denselben
 *  Hoeflichkeitssatz ueber beide Sorten. */
export const SACHAUSSAGE_MUSTER = [
  "korrigiert",
  "geändert",
  "geaendert",
  "angepasst",
  "behoben",
  "richtiggestellt",
] as const;

/** Betreff-/Textmuster von Eingangsbestaetigungen (klein geschrieben,
 *  Teilstring-Vergleich). Bewusst eng — lieber eine Bestaetigung liegen
 *  lassen als eine echte Antwort verschieben. */
export const BESTAETIGUNGS_MUSTER = [
  "gerne sichten wir",
  /* SPIEGEL, neuere Fassung: "Gern sichten und bearbeiten wir Ihren Hinweis." */
  "sichten und bearbeiten wir",
  "im falle einer rückfrage melden wir uns",
  /* SPIEGEL, aeltere Fassung: "vielen Dank für Ihr Interesse am SPIEGEL." */
  "interesse am spiegel",
  "wir kümmern uns so schnell wie möglich",
  "gern bearbeiten wir ihre anfrage",
  "eingangsbestätigung",
  "empfangsbestätigung",
] as const;

/** Medien-Segmente in "Was auffaellt": eigenes Segment nur ab diesem Anteil am Balken … */
export const SEGMENT_MINDEST_ANTEIL = 0.15;
/** … und nur ab dieser absoluten Anzahl — kleine Balken bleiben einfarbig. */
export const SEGMENT_MINDEST_ANZAHL = 3;

/** z-Wert für das 95-%-Wilson-Intervall (§9.4). */
export const CONFIDENCE_Z = 1.959964;

/**
 * Obergrenze für zitierte Fundstellen.
 *
 * Die Grenze ist selbst gesetzt, nicht gesetzlich: das Zitat geht an die
 * Redaktion, die den Text geschrieben hat, und in die nicht-öffentliche
 * Historie -- eine öffentliche Wiedergabe im Sinne des § 51 UrhG ist das
 * nicht. Sie steht trotzdem, weil eine Fundstelle eine Stelle sein soll und
 * kein Absatz: 280 Zeichen fassen auch lange Sätze.
 *
 * Sollte je eine öffentliche Liste dazukommen, ist das der Moment, die Zahl
 * neu zu prüfen -- `PublicCorrection` führt `quoteBefore`.
 */
export const QUOTE_MAX_LENGTH = 280;

/** Vermerk einer Pruefung, die die robots.txt untersagt hat -- der Ausschluss
 *  ist die Entscheidung der Redaktion, kein gescheiterter Abruf. */
export const ROBOTS_VERMERK = "durch robots.txt ausgeschlossen";

/** Zeichen vor und nach der Fundstelle je Kontext-Anker (§8.1). */
export const ANCHOR_LENGTH = 48;

/**
 * Obergrenze für einen mitgelieferten Artikeltext (Lesezeichen, Einfügen).
 * Grosszügig: die Rechtschreibprüfung nimmt ohnehin nur die ersten 18 000
 * Zeichen, das Verankern braucht aber die ganze Länge. Die Grenze hält nur
 * ausufernde Übertragungen ab — ein Artikel bleibt weit darunter.
 */
export const ARTIKEL_MAX_LENGTH = 200_000;

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

/**
 * Der Tilgungsstrich der Wortmarke: ein Filzstiftstrich, leicht gebogen,
 * zur Spitze hin flacher. Eine Quelle fuer alle Verwender -- den Titelkopf
 * (layout.tsx), die Mail (compose.ts) und die App-Icons
 * (tools/iconsErzeugen.py liest diese Datei).
 */
export const TILGUNG_STRICH = {
  breite: 46,
  hoehe: 26,
  pfad: "M2.4 20.6C13.2 16.4 26.4 10.2 41.8 3.2c1.1-.5 1.9.6 1 1.3-2 1.5-4.6 3-8 4.8C25.6 14.4 13.4 20.4 4.4 24c-1.3.5-2.6-1.6-2-3.4z",
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

/**
 * Abstufungen der Palette: wie viel einer Farbe stehen bleibt, wenn sie zu
 * einer zweiten hin verrechnet wird (`color-mix`). Gemischt wird aus PALETTE.
 */
export const ANTEIL = {
  /** Grund der Zwischenueberschriften: knapp zwei Drittel Schwarz. */
  balkengrund: "65%",
  /** Zaehlweise-Pille im Balken: Grund, Schrift, angefasste Haelfte. */
  balkenpille: "70%",
  balkenpilleSchrift: "70%",
  balkenpilleHover: "45%",
  /** Weiche Kategorien (WEICHE_FEHLERARTEN) auf 0,6 Farbintensitaet. */
  weicheKategorie: "60%",
  /** Ressortleiste unter dem Zeiger: eine Spur dunkler als die Linie. */
  ressortHover: "90%",
  /** Markierte Wortstelle im Rechtschreib-Treffer: ein Hauch Karmin. */
  trefferMarke: "20%",
  /** Automatisch befuelltes Feld: Grund und aufgehellte Schrift. */
  erkanntesFeld: "10%",
  erkannteSchrift: "60%",
  /** Meldungskarte (schmal): hebt sich vom Papier ab, ohne reinweiss zu sein. */
  karte: "80%",
  /** Blaetterreihe, die Seite ohne Ziel. */
  seitenrandGrund: "20%",
  seitenrandSchrift: "55%",
  /** Gesperrte Fundstelle: lesbar, aber erkennbar uebernommen. */
  gesperrtRahmen: "60%",
  gesperrtSchrift: "60%",
  /** Spur hinter dem Balken, deutlich heller als das Linien-Grau. */
  balkenspur: "60%",
  /** Medien-Segmente, von links nach rechts ansteigend heller. */
  segmentZwei: "80%",
  segmentDrei: "65%",
  segmentWeitere: "45%",
  /** Schraffur der "uebrigen": zwei Toene im Wechsel. */
  schraffurHell: "50%",
  schraffurDunkel: "25%",
  /** Mengenmarke im Segment: Papier, das den Grund durchscheinen laesst. */
  teilzahl: "85%",
  /** Fusszeile: zwischen Randgrau und Tinte. */
  fusszeile: "70%",
  /** Rotstift-Unterstrich der Fussadresse, gegen Durchsichtig gemischt. */
  fussUnterstrich: "40%",
  /** Trennlinie unter den Spaltenkoepfen: leiser als die Kante darueber. */
  trennlinie: "60%",
  /** Zeile unter dem Zeiger: gerade so viel, dass sie sich abhebt. */
  zeileUnterZeiger: "5%",
} as const;

/** Deckkraft: Schatten und zurueckgenommene Bedienzeichen. */
export const DECKKRAFT = {
  /** Kopf und Fuss der Schale, wenn die Seite unter ihnen durchlaeuft. */
  schale: 0.55,
  /** Auf der Meldungsliste leiser: die Filterzeile traegt schon eine Kante. */
  schaleLeise: 0.15,
  /** Aufgeklappte Navigationsliste. */
  klappliste: 0.35,
  /** Bleisatz-Klotz: ruhend, angehoben, vertieft. */
  klotz: 0.35,
  klotzGehoben: 0.45,
  klotzVertieft: 0.45,
  /** Feste Leisten der Meldungsliste: Filterzeile und Blaetterreihe. */
  leiste: 0.45,
  /** Hinweiskasten am Fragezeichen: liegt ueber dem Satz und braucht Kante. */
  hinweiskasten: 0.9,
  /** Der Hinweis-Toast. */
  toast: 0.45,
  /** Rechtschreib-Treffer, der nur den Stil betrifft. */
  stiltreffer: 0.7,
  /** Tastenkuerzel neben der Beschriftung. */
  taste: 0.7,
  /** Die gezogene Zeile, solange sie am Zeiger haengt. */
  gezogeneZeile: 0.45,
  /** Ziehgriff in Ruhe; unter dem Zeiger steht er voll. */
  ziehgriff: 0.35,
} as const;

/**
 * Die beiden helleren Schweregrad-Chips: vom Korrekturrot im Farbton gedreht.
 * "schwer" fehlt -- es bleibt das Korrekturrot selbst.
 */
export const SCHWEREGRAD_TON = {
  /** mittel: dreht nach Orange. */
  mittel: { drehung: 42, saettigung: "95%", helligkeit: "58%" },
  /** leicht: weiter nach Gelb. */
  leicht: { drehung: 58, saettigung: "95%", helligkeit: "55%" },
} as const;
