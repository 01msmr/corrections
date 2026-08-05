import { PALETTE, PALETTE_DUNKEL } from "@korrektur/shared";
import type { FC, PropsWithChildren } from "hono/jsx";

/** Fuer Farben in data-URIs: "#a3323b" -> "%23a3323b". */
const uri = (hex: string): string => hex.replace("#", "%23");

/**
 * Motiv ist das Korrekturlesen, nicht die Zeitung: Manuskriptspalte mit aktivem
 * Rand, Korrekturzeichen statt Nummerierung, Rotstift nur fuer die Fundstelle.
 * Die Auszeichnungsschrift ist bewusst dicktengleich — Korrektur arbeitet auf
 * Zeichenebene, und das feste Raster behauptet genau das.
 *
 * Alles aus System-Stacks: kein Webfont, kein Nachladen, keine Bewegung. Das
 * Werkzeug wird mehrmals taeglich fuer zwanzig Sekunden benutzt.
 */
const STYLES = `
  :root {
    color-scheme: light dark;
    --papier: ${PALETTE.papier};
    --tinte: ${PALETTE.tinte};
    --korrektur: ${PALETTE.korrektur};
    --vorschlag: ${PALETTE.vorschlag};
    --rand: ${PALETTE.rand};
    --linie: ${PALETTE.linie};
    --feld: ${PALETTE.feld};

    /* Courier New zuerst: die Schreibmaschinenschrift traegt das Motiv. Sie
       laeuft hell und braucht groessere Grade und fette Schnitte -- die Werte
       weiter unten sind darauf abgestimmt. */
    --mono: "Courier New", Courier, ui-monospace, SFMono-Regular, Menlo, monospace;
    --sans: system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --papier: ${PALETTE_DUNKEL.papier}; --tinte: ${PALETTE_DUNKEL.tinte};
      --korrektur: ${PALETTE_DUNKEL.korrektur}; --vorschlag: ${PALETTE_DUNKEL.vorschlag};
      --rand: ${PALETTE_DUNKEL.rand}; --linie: ${PALETTE_DUNKEL.linie};
      --feld: ${PALETTE_DUNKEL.feld};
    }
  }

  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 0 0 4rem;
    background: var(--papier); color: var(--tinte);
    font: 16px/1.6 var(--sans);
  }
  /* Der Kopf laeuft ueber die volle Breite, damit sein Schatten keine Kanten
     nach links und rechts wirft; ausgerichtet wird der Inhalt darin auf
     dieselbe Spalte wie der Rest der Seite. */
  .blatt, .kopfinhalt { max-width: 44rem; margin: 0 auto; padding: 0 1.25rem; }
  /* Faellt die Ueberschrift weg, weil sie den Navigationspunkt wiederholt, muss
     ihr Raum ersetzt werden -- sonst beginnt das Formular direkt unter dem
     Balken. Seiten mit Ueberschrift bringen ihn selbst mit. */
  .blatt.ohne-titel { padding-top: 2.25rem; }
  /* Die Startseite laeuft wie ein Blatt: ab Tabletbreite zwei gleich breite
     Spalten mit feiner Spaltenlinie, linksbuendig -- Blocksatz ohne
     Silbentrennung reisst Loecher. Vorspann und Rubriken spannen ueber beide
     Spalten, die Rubrik sitzt damit mittig auf der vollen Breite. */
  .prosa { max-width: 62rem; margin: 0 auto; text-align: left; }
  .prosa .einstieg { font-size: 1.2rem; line-height: 1.55; }
  .prosa h2:not(.rubrik) { margin-top: 1.6rem; }
  @media (min-width: 48rem) {
    .prosa { columns: 2; column-gap: 2.75rem; column-rule: 1px solid var(--linie); }
    .prosa .einstieg, .prosa h2.rubrik { column-span: all; }
  }

  /* Der Kopf ist ein Zeitungskopf: der Titel zentriert wie ein Zeitungstitel,
     darunter die Datumszeile zwischen einer kraeftigen und einer feinen Linie,
     dann die Ressort-Navigation. Der Titel scrollt weg wie bei einer Zeitung;
     stehen bleibt nur die Navigationsleiste. */
  header { background: var(--papier); }
  .markenzeile { display: block; text-align: center; padding: 1.6rem 0 .7rem; }
  /* Das Band ist der Trenner zwischen Titel und Ressortleiste: Untertitel
     hell auf Tinte, im Dunkelmodus entsprechend umgekehrt. */
  .datumszeile { background: var(--tinte); }
  .datumszeile .kopfinhalt {
    position: relative; display: block; text-align: center;
    padding-top: .4rem; padding-bottom: .4rem;
  }
  .untertitel { font: 700 .85rem/1.5 var(--mono); letter-spacing: .14em;
    text-transform: uppercase; color: var(--papier); }
  .datum { position: absolute; right: 1.25rem; top: 50%; transform: translateY(-50%);
    font: .78rem/1.4 var(--mono); letter-spacing: .04em; color: var(--rand); }
  .datumszeile .datum { color: var(--linie); }
  /* Nur die Ressortleiste bleibt beim Scrollen stehen. Der Schatten kommt erst,
     wenn der Titel darueber aus dem Bild ist -- ueber eine Scroll-Zeitachse,
     also ohne Skript; wo der Browser sie nicht kennt, klebt die Leiste ohne
     Schatten. */
  .navzeile {
    position: sticky; top: 0; z-index: 5;
    margin-bottom: 2.5rem;
    background: var(--papier);
    animation: kopfschatten linear both;
    animation-timeline: scroll(root);
    animation-range: 4rem 8rem;
  }
  @keyframes kopfschatten {
    from { box-shadow: 0 4px 12px -10px rgba(0, 0, 0, 0); }
    to { box-shadow: 0 4px 14px -8px rgba(0, 0, 0, .3); }
  }
  .kopfinhalt {
    display: flex; flex-wrap: wrap; gap: .75rem 1.5rem;
    align-items: baseline; justify-content: space-between;
  }
  .markenzeile.kopfinhalt { display: block; }
  /* Der Zeitungstitel laeuft nicht in der Schreibmaschine, sondern in einer
     Didone -- der Schriftgattung klassischer Titelkoepfe. Didot und Bodoni
     liegen auf Apple-Systemen, Georgia faengt den Rest ab. */
  .marke { font: 700 2.6rem/1.1 "Didot", "Bodoni 72", Didot, Georgia, "Times New Roman", serif;
    letter-spacing: .05em; text-transform: uppercase;
    color: inherit; text-decoration: none; }
  /* Die Schrift bleibt in Tinte; ausgezeichnet wird ueber eine Unterstreichung
     im selben Rot wie der Tilgungsstrich und in derselben Staerke. */
  .marke:hover, .marke:focus-visible { text-decoration: underline;
    text-decoration-color: var(--korrektur); text-decoration-thickness: 2px;
    text-underline-offset: .28em; }
  /* Der Wortmarke ist ein Fehler eingebaut, der zugleich getilgt wird: man liest
     „Korrekturen“ und sieht dabei, was die Anwendung tut. Fuer Vorlesesoftware
     traegt das aria-label am Link den richtigen Namen. */
  /* Der Buchstabe bleibt Text in Tinte -- rot ist nur der Strich, so wie auf
     Papier: der Fehler ist gesetzt, die Korrektur kommt von Hand dazu. */
  /* display: inline, nicht inline-block: ein Inline-Block bildet einen eigenen
     Dekorationsbereich, wodurch die Unterstreichung beim Ueberfahren am "h"
     abgerissen waere. */
  .marke .tilgung { position: relative; color: var(--tinte); }
  /* Kein text-decoration und kein gerader Balken: ein Filzstiftstrich ist leicht
     gebogen, laeuft ueber den Buchstaben hinaus und wird zum Ende hin flacher.
     Deshalb eine gezeichnete Kurve als Data-URI statt einer gedrehten Linie. */
  .marke .tilgung::after {
    content: ""; position: absolute;
    left: -.22em; right: -.22em; top: -.15em; bottom: -.15em;
    background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='46' height='26' viewBox='0 0 46 26' preserveAspectRatio='none'%3E%3Cpath d='M2.4 20.6C13.2 16.4 26.4 10.2 41.8 3.2c1.1-.5 1.9.6 1 1.3-2 1.5-4.6 3-8 4.8C25.6 14.4 13.4 20.4 4.4 24c-1.3.5-2.6-1.6-2-3.4z' fill='${uri(PALETTE.korrektur)}'/%3E%3C/svg%3E") center / 100% 100% no-repeat;
  }
  nav { display: flex; gap: 0; flex-wrap: wrap; align-items: baseline;
    justify-content: center; width: 100%; }
  nav a { font: 700 .95rem/1 var(--mono); letter-spacing: .03em;
    color: var(--rand); text-decoration: none; padding: .6rem .95rem .5rem;
    border-bottom: 2px solid transparent; }
  nav a:hover, nav a:focus-visible { color: var(--tinte); border-bottom-color: var(--korrektur); }
  /* Die aktuelle Seite ist rot hinterlegt statt groesser gesetzt: die Leiste
     behaelt so auf jeder Seite dieselbe Hoehe und springt beim Wechsel nicht. */
  nav a[aria-current="page"] { background: var(--korrektur); color: var(--papier); }

  h1 { font: 700 1.9rem/1.25 var(--mono); margin: 0 0 1.25rem; letter-spacing: .01em; }
  h2 { font: 1.15rem/1.3 var(--mono); letter-spacing: .01em;
    color: var(--tinte); margin: 2.5rem 0 .75rem; }
  /* Rubrik-Trenner wie im Blatt: der Name mittig, Linien zu beiden Seiten. */
  h2.rubrik { display: flex; align-items: center; gap: .9rem;
    font-weight: 700; letter-spacing: .14em; text-transform: uppercase;
    color: var(--korrektur); font-size: 1.25rem; margin-top: 3rem; }
  h2.rubrik:first-child { margin-top: 0; }
  h2.rubrik::before, h2.rubrik::after { content: ""; flex: 1;
    border-top: 1px solid var(--linie); }
  a { color: inherit; text-underline-offset: .2em; }

  /* Das Korrekturzeichen sitzt unmittelbar vor der Beschriftung, nicht in einer
     eigenen Randspalte: es gehoert zu dem, was darunter zu tun ist. */
  /* Emoji: sie bringen ihre Farbe selbst mit, deshalb hier weder color noch
     Schriftwahl. Auf Apple-Systemen ist das rote Kreuz kraeftig, der Haken
     dunkel und handgezeichnet, der Bleistift gelb. */
  .zeichen { font-size: 1.15em; line-height: 0; margin-right: .35em;
    vertical-align: 0; }
  .zeichen-url::before { content: "🔗"; }
  .zeichen-titel::before { content: "📰"; }
  .zeichen-falsch::before { content: "❌"; }
  .zeichen-richtig::before { content: "✔️"; }
  .zeichen-notiz::before { content: "✏️"; }

  /* Beschriftungen im selben Stil wie die Navigation: dicktengleich, ohne
     Versalien, im Randton. Beides ist Auszeichnungsebene, nicht Inhalt --
     dass sie gleich aussieht, macht das sichtbar. */
  label { display: flex; flex-wrap: wrap; align-items: baseline;
    justify-content: space-between; gap: .2rem 1rem; margin: 0 0 .4rem;
    font: 1.05rem/1.3 var(--mono); letter-spacing: .01em; color: var(--tinte); }
  .feld { margin-bottom: 1.5rem; }
  /* Wie ein gedrucktes Formular: keine weissen Kaesten auf dem Blatt, sondern
     Linien im Blatt. Einzeilige Angaben stehen auf einer Grundlinie; nur
     mehrzeilige Felder bekommen den duennen Rahmen, den auch gedruckte
     Bemerkungsfelder haben. Beim Fokus uebernimmt der Rotstift die Linie. */
  input, textarea, select {
    width: 100%; font: inherit;
    background: transparent; color: inherit;
    border: none; border-bottom: 1px solid var(--rand); border-radius: 0;
    padding: .4rem .15rem;
  }
  textarea { border: 1px solid var(--rand); padding: .5rem .6rem; }
  /* Gesperrt sieht gesperrt aus: ausgegraut, gestrichelte Grundlinie, und der
     Zeiger sagt es zusaetzlich. -webkit-text-fill-color, weil Safari die
     Schriftfarbe gesperrter Felder sonst selbst abdunkelt. */
  input:disabled {
    color: var(--rand); -webkit-text-fill-color: var(--rand); opacity: 1;
    border-bottom-style: dashed; cursor: not-allowed;
  }
  select { cursor: pointer; }
  input:focus-visible, select:focus-visible, textarea:focus-visible {
    outline: none; border-color: var(--korrektur);
  }
  input:focus-visible, select:focus-visible { box-shadow: 0 1px 0 var(--korrektur); }
  textarea:focus-visible { box-shadow: inset 0 0 0 1px var(--korrektur); }

  .arbeitsflaeche { display: grid; }
  .abschluss { padding-top: 1.25rem; }
  .abschluss .feld { margin-bottom: 0; }
  .abschluss button { width: 100%; margin-top: 0; min-height: 3.6rem; }
  /* Zitat und Vorschlag im festen Raster: ein Leerzeichen zu viel oder ein
     Buchstabendreher ist nur so zu sehen. */
  #quoteBefore, #suggestionAfter { font: 1.05rem/1.6 var(--mono); min-height: 5.5rem; }
  #quoteBefore { border-left: 7px solid var(--korrektur); }
  #suggestionAfter { border-left: 7px solid var(--vorschlag); }
  textarea { min-height: 4.5rem; resize: vertical; }

  /* Der Systempfeil ist auf jeder Plattform eine andere Form und passt zu keiner.
     Stattdessen derselbe Winkel wie das Einfuegezeichen am Rand, nur nach unten
     gedreht und mit runden Enden -- gezeichnet als Data-URI, damit nichts
     nachgeladen wird. */
  select {
    -webkit-appearance: none; appearance: none; padding-right: 2.2rem;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='13' height='9' viewBox='0 0 13 9'%3E%3Cpath d='M1.6 1.7 6.5 6.8l4.9-5.1' fill='none' stroke='${uri(PALETTE.rand)}' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right .8rem center;
    background-size: .8rem auto;
  }
  select:hover, select:focus-visible {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='13' height='9' viewBox='0 0 13 9'%3E%3Cpath d='M1.6 1.7 6.5 6.8l4.9-5.1' fill='none' stroke='${uri(PALETTE.korrektur)}' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  }
  optgroup { font: 600 .75rem var(--mono); letter-spacing: .06em; color: var(--rand); }
  optgroup option { font: 400 1rem var(--sans); letter-spacing: 0; color: var(--tinte); }
  :focus-visible { outline: 2px solid var(--korrektur); outline-offset: 1px; }


  /* Kursiv, weil die Zusaetze erlaeutern und nicht benennen: sie gehoeren zu
     einer anderen Sprechebene als die Beschriftung links daneben. */
  .zaehler { font: italic 400 .72rem/1.4 var(--sans); letter-spacing: 0;
    text-transform: none; color: var(--rand); }

  button {
    /* Beschriftung unten rechts: dort endet der Blick nach dem Ausfuellen, und
       im hohen Knopf saehe zentrierter Text verloren aus. */
    display: flex; align-items: flex-end; justify-content: flex-end;
    margin-top: .5rem; padding: .8rem .7rem .7rem 1.2rem; cursor: pointer;
    font: 700 1.25rem/1 var(--mono); letter-spacing: .03em;
    /* Markant durch die Kontur, nicht durch die Flaeche: ein gefuellter Block
       erdrueckte das Blatt. Die Schrift steht in Tinte und bleibt voll lesbar;
       beim Ueberfahren fuellt der Rotstift. */
    background: transparent; color: var(--tinte);
    /* 8px statt 6px: der 2px-Rahmen liegt aussen, dadurch wirkt der Bogen bei
       gleichem Wert enger als bei den Feldern mit ihrem 1px-Rahmen. */
    border: 2px solid var(--tinte); border-radius: 8px;
  }
  button:hover, button:focus-visible { background: var(--tinte);
    border-color: var(--tinte); color: var(--papier); }
  /* Beim Druecken nimmt der Knopf die Darstellung eines Formularfelds an --
     gleiche Farbe, gleicher Rahmen, gleicher Innenschatten, gleicher Radius.
     Er sinkt damit auf die Ebene der Felder statt darueber zu liegen. */
  button:active {
    color: var(--rand);
    background: var(--feld);
    border: 1px solid var(--linie); border-radius: 6px;
  }
  /* Das Zeilenschaltungszeichen sagt, dass der Knopf auch mit der Eingabetaste
     ausgeloest wird. aria-hidden, weil das fuer Vorlesesoftware ohnehin gilt. */
  /* Text und Zeichen teilen sich eine Zeilenbox, damit das ⏎ auf der Grundlinie
     der Beschriftung sitzt und nicht darunter haengt. */
  .knopftext { display: inline; }
  .taste { margin-left: .32em; font-size: 1.2em; opacity: .7; }

  .hinweis { padding: .85rem 1rem; margin: 0 0 1.5rem;
    background: var(--feld); border: 1px solid var(--linie);
    border-left: 7px solid var(--rand); border-radius: 6px; }
  .hinweis p { margin: 0 0 .5rem; }
  .hinweis p:last-child { margin-bottom: 0; }

  /* Die Kennung ist das, wonach spaeter gesucht wird — also im Raster und fett. */
  .kennung { font: 700 1.05em var(--mono); letter-spacing: .04em; }

  table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
  th { font: 1rem/1.3 var(--mono); letter-spacing: .01em; color: var(--tinte); }
  th, td { text-align: left; padding: .3rem .5rem; border-bottom: 1px solid var(--linie);
    vertical-align: middle; }
  form.inline { display: inline; }
  /* Die Mailvorschau zeigt das fertige HTML der Mail in einem Rahmen; darueber
     stehen Empfaenger und Betreff wie im Kopf eines Mailprogramms. */
  .mailkopf { font: .9rem/1.6 var(--mono); color: var(--tinte);
    border: 1px solid var(--linie); border-bottom: none; padding: .6rem .9rem;
    background: var(--feld); }
  .mailkopf .zaehler { display: inline; margin-right: .5rem; }
  .mailvorschau { border: 1px solid var(--linie); margin: 0 0 1.5rem; overflow-x: auto; }
  /* Die ganze Zeile ist das Klickziel -- beim Zeigen fuellt sie sich einen Hauch
     dunkler, nicht invers. Formulare und Griff sind davon ausgenommen. */
  tr[data-href] { cursor: pointer; }
  /* Objektnamen in den Zeilen: Schreibmaschine fett statt Unterstreichung --
     die ganze Zeile ist ohnehin das Klickziel, der Link braucht keine eigene
     Auszeichnung mehr. */
  td a { font: 700 .95rem/1.4 var(--mono); letter-spacing: .01em;
    color: var(--tinte); text-decoration: none; }
  tr[data-href]:hover td { background: color-mix(in oklab, var(--tinte) 6%, var(--papier)); }
  /* Knoepfe in Tabellenzeilen sind Werkzeug, nicht Ziel der Seite: nuechtern,
     rechteckig, ueber die volle Zeilenhoehe -- der Rotstift kommt beim Zeigen.
     height:100% braucht die 1px-Hoehe an der Zelle, sonst loest es sich nicht auf. */
  td.aktion { padding: 0; width: 1%; height: 1px; }
  td.aktion form { display: block; height: 100%; }
  table button {
    display: flex; align-items: center; margin: 0; padding: 0 .7rem; min-height: 0;
    height: 100%; width: 100%;
    font: .75rem/1.4 var(--mono); letter-spacing: .02em; text-transform: none;
    background: transparent; color: var(--rand);
    border: none; border-left: 1px solid var(--linie); border-radius: 0;
  }
  table button:hover, table button:focus-visible {
    background: var(--korrektur); border-color: var(--korrektur); color: var(--papier);
  }
  /* Gezogen wird nur am Griff vor der Zeile; der Trennstrich der Zeile beginnt
     erst dahinter. */
  .griff[draggable="true"] { cursor: grab; border-bottom-color: transparent; }
  tr.zieht { opacity: .4; }
  /* Einfuegemarke: eine karminrote Linie an der Kante, an der die gezogene
     Zeile beim Loslassen einsortiert wuerde. Als Innenschatten auf den Zellen,
     weil border-collapse Zeilenraender verschluckt. */
  tr.ziel-oben td { box-shadow: inset 0 2px 0 var(--korrektur); }
  tr.ziel-unten td { box-shadow: inset 0 -2px 0 var(--korrektur); }
  .griff { color: var(--rand); user-select: none; width: 1.5rem; }

  @media (prefers-color-scheme: dark) {
    select {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='13' height='9' viewBox='0 0 13 9'%3E%3Cpath d='M1.6 1.7 6.5 6.8l4.9-5.1' fill='none' stroke='${uri(PALETTE_DUNKEL.rand)}' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    }
  }

  /* Ab Tabletbreite bekommt die Seite mehr Raum, und die beiden Fassungen
     ruecken nebeneinander. Darunter bleibt es einspaltig -- untereinander sind
     zwei kurze Textfelder besser lesbar als zwei sehr schmale. */
  @media (min-width: 62rem) {
    .blatt, .kopfinhalt { max-width: 72rem; }
    /* Hauptspalte traegt Artikel und Korrektur, Nebenspalte die Einordnung.
       Die Aufteilung folgt der Arbeit, nicht dem verfuegbaren Platz. */
    .arbeitsflaeche { grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 0 2.25rem; }
    /* Gleiche Feldhoehen in beiden Spalten: Beschriftungen und Abstaende sind
       ohnehin identisch, damit liegen die Zeilen exakt uebereinander. */
    #quoteBefore, #suggestionAfter, #comment { min-height: 9rem; }
    /* Die Nebenspalte fuellt die Zeilenhoehe; der Knopf wird ans untere Ende
       geschoben und schliesst damit buendig mit dem letzten Textfeld links ab. */
    .nebenspalte { display: flex; flex-direction: column; }
    /* Der Knopf ist so hoch wie das Feld links daneben und schliesst unten
       buendig ab -- damit liegt auch die letzte Zeile in beiden Spalten
       exakt uebereinander. */
    .nebenspalte .abschluss { margin-top: auto; }
    .hauptspalte > .feld:last-child { margin-bottom: 0; }
    .nebenspalte .abschluss button { min-height: 9rem; }
  }

  /* Schmale Schirme: kompakter Kopf wie die mobile Ausgabe einer Zeitung --
     kleinerer Titel, das Datum rueckt unter den Untertitel, die Ressortleiste
     wird zur seitlich scrollbaren Zeile. */
  @media (max-width: 40rem) {
    .markenzeile { padding: 1rem 0 .5rem; }
    .marke { font-size: 1.7rem; }
    .untertitel { font-size: .68rem; letter-spacing: .1em; }
    .datum { position: static; transform: none; display: block; margin-top: .1rem; }
    nav { flex-wrap: nowrap; overflow-x: auto; justify-content: flex-start;
      -webkit-overflow-scrolling: touch; }
    nav a { white-space: nowrap; font-size: .72rem; padding: .55rem .7rem .45rem; }
  }

  @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
`;

export type Bereich = "neu" | "redaktionen" | "fehlerarten" | "ueber";

/**
 * Beschriftung der Navigationspunkte. Traegt die Seite denselben Titel wie ihr
 * aktiver Punkt, entfaellt die Ueberschrift: sie stuende sonst zweimal
 * untereinander. Bei abweichendem Titel — "Hinweis erfasst", "Redaktion: X" —
 * bleibt sie stehen, weil sie dort etwas Eigenes sagt.
 */
const BEREICH_TITEL: Record<Bereich, string> = {
  neu: "Neue Korrektur",
  redaktionen: "Titel",
  fehlerarten: "Kategorien",
  ueber: "In eigener Sache",
};

/** Formatierung nur in der Ansicht (Projektregel); die Zeile erneuert sich je Aufruf. */
function datumszeile(): string {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

export const Layout: FC<PropsWithChildren<{ title: string; aktiv?: Bereich | undefined }>> = ({
  title,
  aktiv,
  children,
}) => {
  const ohneTitel = aktiv !== undefined && BEREICH_TITEL[aktiv] === title;
  return (
  <html lang="de">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="robots" content="noindex" />
      <title>{title}</title>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
    </head>
    <body>
      <header>
        <div class="kopfinhalt markenzeile">
          <a class="marke" href="/" aria-label="Korrekturen" draggable={false}>
            Korrektu<span class="tilgung">h</span>ren
          </a>
        </div>
        <div class="datumszeile">
          <div class="kopfinhalt">
            <span class="untertitel">Blatt zur Textpflege • Unabhängig • Überparteilich</span>
            <span class="datum">{datumszeile()}</span>
          </div>
        </div>
      </header>
      <div class="navzeile">
        <div class="kopfinhalt">
          <nav>
            <a href="/" aria-current={aktiv === "ueber" ? "page" : undefined} draggable={false}>
              In eigener Sache
            </a>
            <a href="/neu" aria-current={aktiv === "neu" ? "page" : undefined} draggable={false}>
              Neue Korrektur
            </a>
            <a href="/admin/redaktionen" aria-current={aktiv === "redaktionen" ? "page" : undefined} draggable={false}>
              Titel
            </a>
            <a href="/admin/fehlerarten" aria-current={aktiv === "fehlerarten" ? "page" : undefined} draggable={false}>
              Kategorien
            </a>
          </nav>
        </div>
      </div>
      <div class={ohneTitel ? "blatt ohne-titel" : "blatt"}>
        {ohneTitel ? null : <h1>{title}</h1>}
        {children}
      </div>
      <script
        dangerouslySetInnerHTML={{
          __html: `
  for (const zeile of document.querySelectorAll("tr[data-href]")) {
    zeile.addEventListener("click", (e) => {
      if (e.target.closest("a, button, form, .griff")) return;
      location.href = zeile.dataset.href;
    });
  }`,
        }}
      />
    </body>
  </html>
  );
};
