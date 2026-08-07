import { PALETTE, PALETTE_DUNKEL } from "@korrektur/shared";
import type { FC, PropsWithChildren } from "hono/jsx";

/** Fuer Farben in data-URIs: "#rrggbb" -> "%23rrggbb". */
const uri = (hex: string): string => hex.replace("#", "%23");

/* Die beiden gezeichneten Sinnbilder, je Farbe genau einmal erzeugt: der
   Auswahlpfeil der Selects und der Zauberstab der Automatik. Daten-URIs wie
   ueberall im Blatt -- kein Webfont, nichts wird nachgeladen. */
const pfeil = (farbe: string): string =>
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='13' height='9' viewBox='0 0 13 9'%3E%3Cpath d='M1.6 1.7 6.5 6.8l4.9-5.1' fill='none' stroke='${uri(farbe)}' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`;
/* Der isometrische Koerper der Knoepfe: n harte 1px-Stufen, aus denen die
   Kantenflaeche des Klotzes entsteht. Aussen (erhaben) laufen sie nach unten
   rechts hinter den Koerper, innen (eingedrueckt) als abgedunkelte
   Seitenwaende der Aushoehlung nach oben links hinein. */
const klotzKanten = (stufen: number, innen = false): string =>
  Array.from(
    { length: stufen },
    (_, i) => `${innen ? "inset " : ""}${i + 1}px ${i + 1}px 0 var(--klotzkante)`,
  ).join(", ");

const zauberstab = (farbe: string): string =>
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cpath d='M10.8 5.2 2.8 13.2' fill='none' stroke='${uri(farbe)}' stroke-width='2' stroke-linecap='round'/%3E%3Cpath d='M12.9 1l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z' fill='${uri(farbe)}'/%3E%3Cpath d='M4.6 1l.45 1.15 1.15.45-1.15.45-.45 1.15-.45-1.15-1.15-.45 1.15-.45z' fill='${uri(farbe)}'/%3E%3Cpath d='M13.6 7.3l.45 1.15 1.15.45-1.15.45-.45 1.15-.45-1.15-1.15-.45 1.15-.45z' fill='${uri(farbe)}'/%3E%3C/svg%3E")`;

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
    --schatten: ${PALETTE.schatten};
    --licht: ${PALETTE.licht};
    /* Grund der Zwischenueberschriften: 66 % Schwarz, 34 % Weiss — in sRGB
       gemischt, damit die Prozente die erwarteten Anteile sind (#333);
       oklab mischt perzeptuell und geriete deutlich dunkler. */
    --balkengrund: color-mix(in srgb, rgb(var(--schatten)) 66%, rgb(var(--licht)));
    --balkenschrift: var(--papier);
    /* Schattenfarbe der Klotz-Kanten: hell laeuft sie in Tinte, dunkel als
       echter Schatten -- die helle Dunkel-Tinte wuerde die Kante beleuchten. */
    --klotzkante: var(--tinte);

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
      --schatten: ${PALETTE_DUNKEL.schatten};
      --licht: ${PALETTE_DUNKEL.licht};
      /* Invertiert: derselbe Balken (#333) laege auf dem dunklen Blatt bei
         Kontrast 1.4 und waere praktisch unsichtbar. Gleiche Anteile,
         andere Richtung — 66 % Weiss statt 66 % Schwarz. */
      --balkengrund: color-mix(in srgb, rgb(var(--licht)) 66%, rgb(var(--schatten)));
      --balkenschrift: var(--papier);
      /* Dunkel liegt der Koerper im echten Schatten, nicht in Tinte. */
      --klotzkante: rgb(var(--schatten));
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
  .blatt.ohne-titel { padding-top: 1rem; }
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
  /* Oben knapper als es die Zahl vermuten laesst: die Didone bringt viel
     eigenes Fleisch ueber den Versalien mit, erst .7rem zentriert optisch. */
  .markenzeile { display: block; text-align: center; padding: .7rem 0; }
  /* Das Band ist der Trenner zwischen Titel und Ressortleiste: Untertitel
     hell auf Tinte, im Dunkelmodus entsprechend umgekehrt. */
  .datumszeile { background: var(--tinte); }
  .datumszeile .kopfinhalt {
    position: relative; display: block; text-align: center;
    /* Ungleich, damit es gleich aussieht: die Courier sitzt tief in ihrer
       Zeilenbox, erst der knappere Deckel zentriert den Untertitel im Band. */
    padding-top: .15rem; padding-bottom: .4rem;
  }
  .untertitel { font: 700 .85rem/1.5 var(--mono); letter-spacing: .14em;
    text-transform: uppercase; color: var(--papier); }
  .datum { position: absolute; right: 1.25rem; top: 50%; transform: translateY(-50%);
    font: .78rem/1.4 var(--mono); letter-spacing: .04em; color: var(--rand); }
  /* Das Datum hellt beim Ueberfahren auf Papierweiss auf: schnell an (0.25s),
     langsam wieder zurueck (2s) — es soll aufmerken, nicht blinken. Die
     unterschiedlichen Dauern stehen deshalb an Grund- und Hover-Zustand. */
  .datumszeile .datum { color: var(--linie); transition: color 2s ease-out; }
  .datumszeile .datum:hover { color: var(--papier); transition-duration: .25s; }
  /* Untertitelband und Ressortleiste bleiben beim Scrollen gemeinsam stehen;
     nur der Titel scrollt weg wie bei einer Zeitung. Der Schatten kommt erst,
     wenn der Titel darueber aus dem Bild ist -- ueber eine Scroll-Zeitachse,
     also ohne Skript; wo der Browser sie nicht kennt, klebt der Kopf ohne
     Schatten. Der Block steht ausserhalb des headers, weil sticky nicht
     ueber die Grenzen des Elternkastens hinaus kleben kann. */
  .klebekopf {
    position: sticky; top: 0; z-index: 5;
    margin-bottom: 2.5rem;
    animation: kopfschatten linear both;
    animation-timeline: scroll(root);
    animation-range: 4rem 8rem;
  }
  .navzeile { background: var(--papier); }
  @keyframes kopfschatten {
    from { box-shadow: 0 4px 12px -10px rgb(var(--schatten) / 0); }
    to { box-shadow: 0 4px 14px -8px rgb(var(--schatten) / .3); }
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
  /* Verwaltungsressorts ganz rechts; die normale Navi zentriert sich im
     verbleibenden Raum (Auto-Margen links und rechts vom Trio). */
  nav > a:first-child { margin-left: auto; }
  /* Als Pille: hellgrauer Grund, aussen halbrund; overflow schneidet die
     Hover-Flaechen der Haelften auf die Rundung zu. */
  .randressorts { display: flex; align-items: baseline; margin-left: auto;
    background: var(--linie); border-radius: 999px; overflow: hidden;
    align-self: center; }
  .randressorts a { border-bottom: none; color: var(--tinte);
    padding: .45rem .95rem; }
  .randressorts a + a { border-left: 1px solid
    color-mix(in srgb, var(--linie) 70%, rgb(var(--schatten))); }
  .randressorts a:hover, .randressorts a:focus-visible {
    background: color-mix(in srgb, var(--linie) 82%, rgb(var(--schatten)));
    color: var(--tinte); }
  .randressorts a[aria-current="page"] {
    background: var(--balkengrund); color: var(--papier); }
  nav a { font: 700 .95rem/1 var(--mono); letter-spacing: .03em;
    color: var(--rand); text-decoration: none; padding: .6rem .95rem .5rem;
    border-bottom: 2px solid transparent; }
  nav a:hover, nav a:focus-visible { color: var(--tinte); border-bottom-color: var(--korrektur); }
  /* Die aktuelle Seite ist rot hinterlegt statt groesser gesetzt: die Leiste
     behaelt so auf jeder Seite dieselbe Hoehe und springt beim Wechsel nicht. */
  nav a[aria-current="page"] { background: var(--korrektur); color: var(--papier); }

  h1 { font: 700 1.9rem/1.25 var(--mono); margin: 0 0 1.25rem; letter-spacing: .01em; }
  /* 1.2rem statt 1.15: ab 18.66px fett gilt Text als gross, und dort genuegt
     dem Balken ein Kontrast von 3 statt 4.5 — 0.8px, die die helle Schrift
     auf dem grauen Grund regelkonform machen. */
  h2 { font: 700 1.2rem/1.3 var(--mono); letter-spacing: .01em;
    color: var(--tinte); margin: 2.5rem 0 .75rem; }
  /* Abschnitts-Balken (Verwaltungslisten und Rubriken) ueber die volle
     Spaltenbreite: hell auf Karmin wie die aktive Ressortmarke, mit leiser
     Rundung. Fliesstext-Zwischentitel bleiben still in Tinte. */
  h2.balken, h2.rubrik {
    /* Neutrales Dunkelgrau statt Karmin: der Balken gliedert, er zeichnet
       nicht aus. Gemischt aus Schwarz und Weiss — im Dunkelmodus mit
       geringerem Schwarzanteil, sonst saenke er in den dunklen Grund. */
    color: var(--balkenschrift);
    background: var(--balkengrund);
    border-radius: 4px;
    /* Optisch mittig statt rechnerisch: Zentriert wird zwischen Versaloberkante
       und Grundlinie, denn so nimmt das Auge den Textkoerper wahr — ob zufaellig
       ein „g" vorkommt, darf die Lage nicht verschieben. Die Zeilenbox reserviert
       unten Platz fuer Unterlaengen, deshalb 0.68px mehr oben (.24 statt .2rem)
       und ebenso weniger unten; die Balkenhoehe bleibt gleich. */
    padding: .24rem .7rem .16rem; }
  /* Rubriken bleiben die groesste Sprechstufe: zentriert und gesperrt. */
  h2.rubrik { text-align: center; letter-spacing: .14em;
    text-transform: uppercase; font-size: 1.25rem; margin-top: 3rem; }
  h2.rubrik:first-child { margin-top: 0; }
  a { color: inherit; text-underline-offset: .2em; }

  /* Das Korrekturzeichen sitzt unmittelbar vor der Beschriftung, nicht in einer
     eigenen Randspalte: es gehoert zu dem, was darunter zu tun ist. */
  /* Emoji: sie bringen ihre Farbe selbst mit, deshalb hier weder color noch
     Schriftwahl. Auf Apple-Systemen ist das rote Kreuz kraeftig, der Haken
     dunkel und handgezeichnet, der Bleistift gelb. */
  .zeichen { font-size: 1.15em; line-height: 0; margin-right: .35em;
    vertical-align: 0; }
  /* Ausgeklammert, nicht gestrichen: URL, Titel und Notiz kommen ohne
     Zeichen aus, die Glyphen bleiben aber fuer eine Rueckkehr notiert.
  .zeichen-url::before { content: "🔗"; }
  .zeichen-titel::before { content: "📰"; }
  .zeichen-notiz::before { content: "✏️"; }
  */
  .zeichen-falsch::before { content: "❌"; }
  .zeichen-richtig::before { content: "✔️"; }

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
    /* Block statt inline-block: die Grundlinien-Phantomluecke unter den
       Feldern wuerde sonst jede Zeile um ein paar Pixel hoeher machen als
       das sichtbare Feld -- und alles daneben saesse um genau diese Pixel
       zu tief. */
    display: block;
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
    background-image: ${pfeil(PALETTE.rand)};
    background-repeat: no-repeat; background-position: right .8rem center;
    background-size: .8rem auto;
  }
  select:hover, select:focus-visible {
    background-image: ${pfeil(PALETTE.korrektur)};
  }
  optgroup { font: 600 .75rem var(--mono); letter-spacing: .06em; color: var(--rand); }
  optgroup option { font: 400 1rem var(--sans); letter-spacing: 0; color: var(--tinte); }
  :focus-visible { outline: 2px solid var(--korrektur); outline-offset: 1px; }


  /* Kursiv, weil die Zusaetze erlaeutern und nicht benennen: sie gehoeren zu
     einer anderen Sprechebene als die Beschriftung links daneben. */
  .zaehler { font: italic 400 .72rem/1.4 var(--sans); letter-spacing: 0;
    text-transform: none; color: var(--rand); }
  /* Automatisch befuellte Felder tragen ihren Hinweis als Stempel: hell auf
     Karmin, eckig wie die Ressortmarke, kursiv wie die uebrigen Zusaetze.
     Die Aussage steht im Text selbst, die Farbe traegt sie also nie allein. */
  .zaehler.erkannt { color: var(--papier); background: var(--korrektur);
    padding: .05rem .25rem; }
  /* Das zugehoerige Feld nimmt einen Hauch der Stempelfarbe an, als haette
     das Stempelkissen aufs Papier abgefaerbt: der Wert kam aus der Automatik,
     nicht von Hand. Der Ton ist aus der Palette gemischt, kein eigener Wert. */
  .feld:has(.zaehler.erkannt) :is(input, select, textarea) {
    background-color: color-mix(in oklab, var(--korrektur) 12%, var(--feld));
    /* Aufgehellt und kursiv, nicht voll und aufrecht: der Vorschlag ist erst
       Vermutung, kein Urteil -- die Kursive ist die Stimme der Automatik. */
    color: color-mix(in oklab, var(--korrektur) 60%, var(--feld));
    font-style: italic; }
  /* Vor dem automatisch befuellten Feld steht der Zauberstab -- das vertraute
     Sinnbild fuers Auto-Ausfuellen, gezeichnet in der Stempelfarbe. Er sitzt
     links neben dem Feld am Blattrand, wie eine Marginalie des Korrektors. */
  .feld:has(.zaehler.erkannt) { position: relative; }
  .feld:has(.zaehler.erkannt)::after {
    content: ""; position: absolute; left: -1.4em; bottom: .55em;
    width: 1em; height: 1em;
    background: ${zauberstab(PALETTE.korrektur)} center / contain no-repeat;
  }
  .feld:has(.zaehler.erkannt) select { background-image: ${pfeil(PALETTE.korrektur)}; }
  /* Anzahl und Kategorie in einer Zeile: das schmale Zahlfeld steht vor der
     Auswahl, zusammen gelesen "2 | Zeichen fehlen". Das display:block der
     Felder wuerde das hidden-Attribut ueberstimmen, deshalb explizit. */
  .kategoriezeile { display: flex; gap: .6rem; }
  .kategoriezeile #errorCount { width: 4.5rem; flex: none; }
  .kategoriezeile select { flex: 1; min-width: 0; }
  #errorCount[hidden] { display: none; }

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
    /* Jeder freistehende Knopf ist ein Bleisatz-Klotz: eckig, beleuchtete
       Deckflaeche mittelgrau, die Kanten dunkler als sichtbar ausgezogener
       isometrischer Koerper, aus dem erst der weiche Schlagschatten faellt.
       Einzige Ausnahme sind die Zeilenknoepfe in Tabellen (siehe unten). */
    background: var(--rand); color: var(--papier);
    /* Die Deckflaeche ist reine Fuellung ohne Kontur; der transparente Rahmen
       haelt nur die Geometrie der frueheren Kontur. */
    border: 2px solid transparent; border-radius: 0;
    transition: transform .09s ease, box-shadow .09s ease;
    /* Die Grundflaeche (z=0) liegt exakt auf der Layoutposition, im Raster
       der Formularfelder (x wie y). In Ruhe schwebt die Deckflaeche um die
       Kantentiefe darueber, die Kanten fuehren auf die Grundflaeche zurueck,
       aus der der weiche Schlagschatten faellt. */
    transform: translate(-5px, -5px);
    box-shadow: ${klotzKanten(5)}, 9px 10px 10px -6px rgb(var(--schatten) / .35);
  }
  /* Beim Zeigen hebt sich der Klotz weiter aus dem Blatt; die Grundflaeche
     bleibt im Raster verankert. */
  button:hover, button:focus-visible {
    transform: translate(-7px, -7px);
    box-shadow: ${klotzKanten(7)}, 12px 13px 14px -7px rgb(var(--schatten) / .4);
  }
  /* Beim Druecken kippt der Koerper ins Negativ: die Flaeche sinkt um die
     Kantentiefe unter die Grundflaeche. Die Aushoehlung zeigt dieselben
     isometrischen Seitenwaende wie der erhabene Koerper -- abgedunkelt, weil
     sie im eigenen Schatten liegen --, dazu der weiche Schattenfall auf die
     vertiefte Flaeche. Die Flaechenfarbe selbst bleibt unveraendert. */
  button:active {
    transform: none;
    /* Die Fuellung endet an der Innenkante des (transparenten) Rahmens: um
       die Vertiefung herum scheint das Blatt durch, kein grauer Saum. */
    background-clip: padding-box;
    box-shadow: ${klotzKanten(5, true)}, inset 9px 10px 12px -5px rgb(var(--schatten) / .4);
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
  /* Bilanz: Kennzahlen als Kaesten mit duenner Kante, keine Flaechen und
     keine Ampelfarben -- ein Wert ist ein Wert, kein Urteil (§2.2). */
  .eckdaten { display: grid; gap: 1rem; margin: 0 0 1.25rem;
    grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr)); }
  .kennzahl { display: flex; flex-direction: column; gap: .15rem;
    border: 1px solid var(--linie); padding: .8rem .9rem; background: var(--feld); }
  .kennzahl-titel { font: 700 .72rem/1.4 var(--mono); letter-spacing: .1em;
    text-transform: uppercase; color: var(--rand); }
  .kennzahl-wert { font: 700 2rem/1.15 var(--mono); color: var(--tinte); }
  .kennzahl-wert.klein { font-size: 1.15rem; line-height: 1.4; }
  /* Fehlende Aussage sieht aus wie fehlende Aussage: leise, nicht als Null. */
  .kennzahl-leer { font: italic 400 1.15rem/1.4 var(--sans); color: var(--rand); }
  .kennzahl-fuss { font: .78rem/1.4 var(--mono); color: var(--tinte); }
  .kennzahl-erklaerung { font: italic 400 .72rem/1.45 var(--sans); color: var(--rand);
    margin-top: .35rem; }

  /* Waagerechte Balken: Name links, Spur, Zahl rechts auf fester Breite,
     damit die Ziffern untereinander stehen. */
  .verteilung { display: flex; flex-direction: column; gap: .3rem; margin-bottom: 1.5rem; }
  .balkenzeile { display: grid; grid-template-columns: minmax(6rem, 12rem) 1fr 2.5rem;
    align-items: center; gap: .75rem; }
  .balkenname { font: .9rem/1.4 var(--sans); }
  .balkenspur { display: block; height: 1.05rem; background: var(--linie); }
  .balkenfuellung { display: flex; height: 100%; background: var(--korrektur); }
  /* Medien-Segmente: von links nach rechts ansteigend heller (gemischt aus der
     Palette, keine eigenen Farbwerte), "uebrige" stets am hellsten. Dazwischen
     eine duenne Trennlinie in Papierweiss. */
  .balkenteil { display: flex; align-items: center; height: 100%; background: var(--korrektur);
    color: var(--papier); container-type: inline-size; overflow: hidden; }
  .balkenteil:nth-child(2) { background: color-mix(in srgb, var(--korrektur) 82%, var(--papier)); }
  .balkenteil:nth-child(3) { background: color-mix(in srgb, var(--korrektur) 64%, var(--papier)); }
  .balkenteil:nth-child(n + 4) { background: color-mix(in srgb, var(--korrektur) 46%, var(--papier)); }
  /* "uebrige" traegt keinen Namen — eine diagonale Schraffur genuegt. */
  /* Schraffur: 2px/2px im 150-Grad-Winkel, Karmin 50 % auf 25 %. */
  .balkenteil.uebrige { background: repeating-linear-gradient(150deg,
    color-mix(in srgb, var(--korrektur) 50%, var(--papier)) 0 2px,
    color-mix(in srgb, var(--korrektur) 25%, var(--papier)) 2px 4px); }
  .balkenteil + .balkenteil { border-left: 1px solid var(--papier); }
  .balkenteilname { font: 700 .7rem/1 var(--sans); padding: 0 .3rem;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  /* In zu schmalen Segmenten faellt der Name weg — der Tooltip bleibt. */
  @container (max-width: 3.5rem) { .balkenteilname { display: none; } }
  .balkenwert { font: 700 .85rem/1.4 var(--mono); text-align: right; }

  /* Verlauf: senkrechte Balken auf gemeinsamer Grundlinie, seitlich
     scrollbar -- eine Zeitreihe waechst mit den Monaten. */
  .verlauf { display: flex; align-items: flex-end; gap: .4rem; height: 9rem;
    margin-bottom: 1.5rem; overflow-x: auto; padding-bottom: .2rem; }
  /* max-width, damit wenige Monate keine plakativen Bloecke werden. */
  .verlaufsspalte { display: flex; flex-direction: column; align-items: center;
    justify-content: flex-end; height: 100%; min-width: 2.4rem; max-width: 4rem; flex: 1; }
  .verlaufsbalken { display: block; width: 100%; background: var(--korrektur);
    min-height: 2px; }
  .verlaufswert { font: 700 .72rem/1.4 var(--mono); color: var(--tinte); }
  .verlaufsmonat { font: .68rem/1.4 var(--mono); color: var(--rand); margin-top: .25rem;
    white-space: nowrap; }

  /* Fliesstext der Methodik schmal halten: lange Zeilen liest niemand. */
  .prosa-schmal { max-width: 40rem; }
  .prosa-schmal p { margin: 0 0 .8rem; }

  /* Die Korrekturfahne zeigt den Wortunterschied der beiden Fassungen:
     Getilgtes durchgestrichen in Karmin, Eingefuegtes unterstrichen in Gruen.
     Beide tragen Strich und Farbe -- keines der Mittel steht allein. */
  .fahne { font: 1.05rem/1.6 var(--mono); margin: 0 0 1rem; }
  .fahne del { color: var(--korrektur); text-decoration: line-through;
    text-decoration-thickness: 2px; }
  .fahne ins { color: var(--vorschlag); text-decoration: underline;
    text-decoration-thickness: 2px; }
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
    box-shadow: none; transition: none; transform: none;
  }
  table button:hover, table button:focus-visible {
    background: var(--korrektur); border-color: var(--korrektur); color: var(--papier);
    transform: none; box-shadow: none;
  }
  /* Der allgemeine Druckzustand laesst Knoepfe sinken -- fuer die flachen
     Zeilenknoepfe gilt das nicht, sie bleiben beim Druecken (und waehrend
     die Rueckfrage offen ist) in Form und Lage. */
  table button:active {
    background: var(--korrektur); color: var(--papier);
    border: none; border-left: 1px solid var(--korrektur); border-radius: 0;
    transform: none; box-shadow: none;
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

  /* Sortierbare Spaltenkoepfe: der Pfeil steht erst da, wenn nach dieser
     Spalte sortiert wurde -- vorher zeigt nur der Zeiger, dass sich klicken
     lohnt. Ohne JavaScript bleibt die Serverreihenfolge (alphabetisch). */
  /* Bilanz-Medienliste: Namen und Zahlen fett (Wunsch vom 7.8.2026). */
  table.medienliste td { font-weight: 700; }
  table.sortierbar th[role="button"] { cursor: pointer; user-select: none; }
  table.sortierbar th[role="button"]:hover,
  table.sortierbar th[role="button"]:focus-visible { color: var(--korrektur); }
  /* Der Platz fuer den Pfeil steht von Anfang an: sonst wuerde die Spalte beim
     ersten Klick um seine Breite springen. Das leere Zeichen haelt ihn frei. */
  table.sortierbar th[role="button"]::after {
    content: "▲"; display: inline-block; width: 1em; margin-left: .2em;
    font-size: .8em; visibility: hidden;
  }
  table.sortierbar th[aria-sort="ascending"]::after { content: "▲"; visibility: visible; }
  table.sortierbar th[aria-sort="descending"]::after { content: "▼"; visibility: visible; }

  @media (prefers-color-scheme: dark) {
    select {
      background-image: ${pfeil(PALETTE_DUNKEL.rand)};
    }
    .feld:has(.zaehler.erkannt)::after {
      background-image: ${zauberstab(PALETTE_DUNKEL.korrektur)};
    }
    .feld:has(.zaehler.erkannt) select { background-image: ${pfeil(PALETTE_DUNKEL.korrektur)}; }
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
    /* Verwaltungsformulare (Zeilenraster): die Spalten-Wrapper loesen sich im
       Raster auf, jedes Feldpaar teilt sich eine echte Rasterzeile -- so
       stehen die Zeilen beider Spalten exakt nebeneinander, auch wenn rechts
       ein Hinweis umbricht oder ein Feld hoeher ist. */
    .zeilenraster .hauptspalte, .zeilenraster .nebenspalte { display: contents; }
    .zeilenraster { grid-auto-flow: row dense; align-items: start; }
    .zeilenraster .hauptspalte > .feld { grid-column: 1; }
    .zeilenraster .nebenspalte > .feld { grid-column: 2; }
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
    /* In der Scrollzeile reihen sich alle Ressorts wieder ein. */
    nav > a:first-child { margin-left: 0; }
    .randressorts { display: contents; }
  }

  @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
`;

export type Bereich = "neu" | "redaktionen" | "fehlerarten" | "bilanz" | "backfill" | "ueber";

/**
 * Beschriftung der Navigationspunkte. Traegt die Seite denselben Titel wie ihr
 * aktiver Punkt, entfaellt die Ueberschrift: sie stuende sonst zweimal
 * untereinander. Bei abweichendem Titel — "Hinweis erfasst", "Redaktion: X" —
 * bleibt sie stehen, weil sie dort etwas Eigenes sagt.
 */
const BEREICH_TITEL: Record<Bereich, string> = {
  neu: "Neue Korrektur",
  redaktionen: "Medien",
  fehlerarten: "Kategorien",
  bilanz: "Bilanz",
  backfill: "Altbestand",
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
      </header>
      <div class="klebekopf">
        <div class="datumszeile">
          <div class="kopfinhalt">
            <span class="untertitel">Blatt zur Textpflege • Unabhängig • Überparteilich</span>
            <span class="datum">{datumszeile()}</span>
          </div>
        </div>
        <div class="navzeile">
          <div class="kopfinhalt">
            <nav>
            <a href="/" aria-current={aktiv === "ueber" ? "page" : undefined} draggable={false}>
              In eigener Sache
            </a>
            <a href="/neu" aria-current={aktiv === "neu" ? "page" : undefined} draggable={false}>
              Neue Korrektur
            </a>
            <a href="/bilanz" aria-current={aktiv === "bilanz" ? "page" : undefined} draggable={false}>
              Bilanz
            </a>
            {/* Verwaltungsressorts: rechtsbuendig am Rand der Inhaltsspalte,
                Hover nur im Grau der Zwischenueberschriften. */}
            <span class="randressorts">
              <a href="/admin/redaktionen" aria-current={aktiv === "redaktionen" ? "page" : undefined} draggable={false}>
                Medien
              </a>
              <a href="/admin/fehlerarten" aria-current={aktiv === "fehlerarten" ? "page" : undefined} draggable={false}>
                Kategorien
              </a>
            </span>
            </nav>
          </div>
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
  }

  /* Sortieren im Browser: die Serverantwort bleibt alphabetisch, umsortiert
     wird nur die Ansicht. Zahlenspalten numerisch, Text nach deutscher
     Sortierfolge; leere Zellen und Aktionsspalten bleiben aussen vor. */
  for (const tabelle of document.querySelectorAll("table.sortierbar")) {
    const kopf = tabelle.tHead && tabelle.tHead.rows[0];
    const koerper = tabelle.tBodies[0];
    if (!kopf || !koerper) continue;

    Array.from(kopf.cells).forEach((zelle, spalte) => {
      if (!zelle.textContent.trim()) return;
      zelle.setAttribute("role", "button");
      zelle.setAttribute("tabindex", "0");
      zelle.setAttribute("aria-sort", "none");

      const sortieren = () => {
        /* Jeden Zellwert genau einmal lesen und umwandeln, danach nur noch
           die fertigen Paare vergleichen -- sonst liefe die Aufbereitung bei
           jedem einzelnen Vergleich erneut. */
        const paare = Array.from(koerper.rows, (zeile) => {
          const feld = zeile.cells[spalte];
          const roh = feld
            ? (feld.dataset.wert !== undefined ? feld.dataset.wert : feld.textContent).trim()
            : "";
          const zahl = Number(roh.replace(",", "."));
          return { zeile, text: roh, zahl, istZahl: roh !== "" && !Number.isNaN(zahl) };
        });
        const zahlig = paare.every((paar) => paar.text === "" || paar.istZahl);

        /* Erster Klick: bei Zahlen das Groesste nach oben, bei Text von A an.
           Danach kehrt jeder weitere Klick die Richtung um. */
        const zustand = zelle.getAttribute("aria-sort");
        const aufsteigend = zustand === null || zustand === "none" ? !zahlig : zustand !== "ascending";
        const richtung = aufsteigend ? 1 : -1;

        paare.sort((a, b) => {
          const vergleich = zahlig
            ? (a.istZahl ? a.zahl : 0) - (b.istZahl ? b.zahl : 0)
            : a.text.localeCompare(b.text, "de");
          return vergleich * richtung;
        });

        for (const paar of paare) koerper.appendChild(paar.zeile);
        for (const andere of kopf.cells) andere.setAttribute("aria-sort", "none");
        zelle.setAttribute("aria-sort", aufsteigend ? "ascending" : "descending");
      };

      zelle.addEventListener("click", sortieren);
      zelle.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          sortieren();
        }
      });
    });
  }`,
        }}
      />
    </body>
  </html>
  );
};
