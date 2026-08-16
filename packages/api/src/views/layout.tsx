import {
  ABSTAND,
  ABSTAND_EM,
  ANTEIL,
  DAUER,
  DECKKRAFT,
  EBENE,
  GEWICHT,
  GRAD,
  GRAD_EM,
  HUB,
  KURVE,
  MASS,
  PALETTE,
  PALETTE_DUNKEL,
  RADIUS,
  SCHATTEN,
  SCHWEREGRAD_TON,
  SCROLLWEG,
  SPERRUNG,
  STRICH,
  TILGUNG_STRICH,
  UMBRUCH,
  ZEILE,
} from "@korrektur/shared";
import type { FC, PropsWithChildren } from "hono/jsx";
import { raw } from "hono/html";
import { TOASTIFY_CSS, TOASTIFY_JS } from "./vendor/toastify.js";

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
    --balkengrund: color-mix(in srgb, rgb(var(--schatten)) ${ANTEIL.balkengrund}, rgb(var(--licht)));
    --balkenschrift: var(--papier);
    /* Korrekturrot auf 0,6 vor Weiss. Verrechnet statt per opacity, sonst
       verblasste die Beschriftung mit. */
    --korrektur-weich: color-mix(in srgb, var(--korrektur) ${ANTEIL.weicheKategorie}, rgb(var(--licht)));
    /* Schattenfarbe der Klotz-Kanten: hell laeuft sie in Tinte, dunkel als
       echter Schatten -- die helle Dunkel-Tinte wuerde die Kante beleuchten. */
    --klotzkante: var(--tinte);

    /* Courier New zuerst: die Schreibmaschinenschrift traegt das Motiv. Sie
       laeuft hell und braucht groessere Grade und fette Schnitte -- die Werte
       weiter unten sind darauf abgestimmt. */
    --mono: "Courier New", Courier, ui-monospace, SFMono-Regular, Menlo, monospace;
    --sans: system-ui, -apple-system, "Segoe UI", sans-serif;
    /* Die Schrift des Zeitungstitels; sie traegt auch die kleine Marke im
       klebenden Band. Didot und Bodoni liegen auf Apple-Systemen, Georgia
       faengt den Rest ab. */
    --titel: "Didot", "Bodoni 72", Didot, Georgia, "Times New Roman", serif;
    /* Ein Satzspiegel fuer alles: Kopf, Blatt und Fusszeile teilen diese
       Breite, und die Prosa laeuft darin mit, statt ein zweites Mass
       aufzumachen. Vorher standen 72rem und 62rem nebeneinander -- die
       Kanten von Marke, Datum und Fussstrich lagen dann je nach Seite
       woanders. 73.75rem ergibt 1140px Inhalt: zwei Spalten zu je 570px, und
       eine Prosaspalte traegt damit rund 74 Zeichen -- die uebliche
       Obergrenze fuer bequemes Lesen. */
    --mass: ${MASS.arbeitsbreite};
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
      --balkengrund: color-mix(in srgb, rgb(var(--licht)) ${ANTEIL.balkengrund}, rgb(var(--schatten)));
      --balkenschrift: var(--papier);
      /* Andere Richtung: vor Schwarz. Leiser heisst hier wie dort
         "naeher am Grund". */
      --korrektur-weich: color-mix(in srgb, var(--korrektur) ${ANTEIL.weicheKategorie}, rgb(var(--schatten)));
      /* Dunkel liegt der Koerper im echten Schatten, nicht in Tinte. */
      --klotzkante: rgb(var(--schatten));
    }
  }

  * { box-sizing: border-box; }
  body {
    /* Unten nur ein schmaler Rand: den Abstand zum Inhalt bringt die
       Fusszeile selbst mit, darunter soll die Seite enden. */
    margin: 0; padding: 0 0 ${ABSTAND.r50};
    background: var(--papier); color: var(--tinte);
    font: 16px/1.6 var(--sans);
  }
  /* Der Kopf laeuft ueber die volle Breite, damit sein Schatten keine Kanten
     nach links und rechts wirft; ausgerichtet wird der Inhalt darin auf
     dieselbe Spalte wie der Rest der Seite. */
  .blatt, .kopfinhalt, .fusszeile { max-width: ${MASS.satzspiegel}; margin: 0 auto; padding: 0 ${ABSTAND.r125}; }
  /* Faellt die Ueberschrift weg, weil sie den Navigationspunkt wiederholt, muss
     ihr Raum ersetzt werden -- sonst beginnt das Formular direkt unter dem
     Balken. Seiten mit Ueberschrift bringen ihn selbst mit. */
  .blatt.ohne-titel { padding-top: ${ABSTAND.r35}; }
  /* Die Startseite laeuft wie ein Blatt: ab Tabletbreite zwei gleich breite
     Spalten mit feiner Spaltenlinie, linksbuendig -- Blocksatz ohne
     Silbentrennung reisst Loecher. Vorspann und Rubriken spannen ueber beide
     Spalten, die Rubrik sitzt damit mittig auf der vollen Breite. */
  /* Kein eigenes Mass: die Prosa fuellt die Inhaltsspalte des Blattes. */
  .prosa { margin: 0 auto; text-align: left; }
  .prosa .einstieg { font-size: ${GRAD.stark}; line-height: 1.55; }
  .prosa h2:not(.rubrik) { margin-top: ${ABSTAND.r150}; }
  /* Steht der Vorspann ganz oben, gehoert er zum Titel und nicht zu einem
     eigenen Abschnitt: er rueckt dicht unter den Kopf und dicht ueber die
     Rubrik. */
  .prosa .einstieg:first-child { margin-top: 0; }
  .prosa .einstieg:first-child + h2.rubrik { margin-top: ${ABSTAND.r100}; }
  @media (min-width: ${UMBRUCH.schmal}) {
    .prosa { columns: 2; column-gap: ${ABSTAND.r275}; column-rule: 1px solid var(--linie); }
    .prosa .einstieg, .prosa h2.rubrik { column-span: all; }
    /* Am Spaltenanfang kappt der Browser den oberen Abstand -- in der zweiten
       Spalte, nicht in der ersten, die den Fluss unter dem Spanner fortsetzt.
       Was dem Spanner folgt, bekommt ihn deshalb auch dort genommen: sonst
       begaenne die linke Spalte eine Zeile tiefer als die rechte. */
    .prosa .einstieg + *:not(.rubrik), .prosa h2.rubrik + *:not(.rubrik) { margin-top: 0; }
    /* Die Luft, die dort wegfaellt, kommt unter den Vorspann: dort gilt sie
       fuer beide Spalten gleich, statt nur die linke tiefer zu setzen. */
    .prosa .einstieg { margin-bottom: ${ABSTAND.r150}; }
  }

  /* Der Kopf ist ein Zeitungskopf: der Titel zentriert wie ein Zeitungstitel,
     darunter die Datumszeile zwischen einer kraeftigen und einer feinen Linie,
     dann die Ressort-Navigation. Der Titel scrollt weg wie bei einer Zeitung;
     stehen bleibt nur die Navigationsleiste. */
  header { background: var(--papier); }
  /* Oben knapper als es die Zahl vermuten laesst: die Didone bringt viel
     eigenes Fleisch ueber den Versalien mit, erst .7rem zentriert optisch. */
  .markenzeile { display: block; text-align: center; padding: ${ABSTAND.r70} 0; }
  /* Das Band ist der Trenner zwischen Titel und Ressortleiste: Untertitel
     hell auf Tinte, im Dunkelmodus entsprechend umgekehrt. */
  .datumszeile { background: var(--tinte); }
  .datumszeile .kopfinhalt {
    /* Der Untertitel steht mittig im Band; das Datum haengt rechts daneben
       und veraendert die Bandhoehe nicht. Die Innenabstaende bleiben
       symmetrisch, sonst sitzt der Untertitel hoeher als das absolut
       zentrierte Datum. */
    position: relative; display: flex; align-items: center; justify-content: center;
    min-height: ${MASS.bandhoehe}; text-align: center;
    padding-top: ${ABSTAND.r25}; padding-bottom: ${ABSTAND.r25};
  }
  /* Die Zeilenbox der Courier sitzt ueber den Versalien hoeher als darunter:
     zentriert waere die Box, nicht die Schrift. Der Versatz holt die Versalien
     auf die Mitte des Bandes (gemessen: .05em). */
  .untertitel { font: ${GEWICHT.fett} ${GRAD.klein}/${ZEILE.luftig} var(--mono); letter-spacing: ${SPERRUNG.gesperrt};
    text-transform: uppercase; color: var(--papier);
    position: relative; top: .05em; }
  .datum { position: absolute; right: 1.25rem; top: 50%; transform: translateY(-50%);
    font: ${GRAD.winzig}/${ZEILE.satz} var(--mono); letter-spacing: ${SPERRUNG.leicht}; color: var(--rand); }
  /* Das Datum hellt beim Ueberfahren auf Papierweiss auf: schnell an (0.25s),
     langsam wieder zurueck (2s) — es soll aufmerken, nicht blinken. Die
     unterschiedlichen Dauern stehen deshalb an Grund- und Hover-Zustand. */
  .datumszeile .datum { color: var(--linie); transition: color ${DAUER.lang} ease-out; }
  .datumszeile .datum:hover { color: var(--papier); transition-duration: ${DAUER.ruhig}; }
  .datum-kurz { display: none; }
  /* Schmaler als 62rem draengt sich die Zeile: der Zusatz faellt weg, das
     lange Datum bleibt. */
  @media (max-width: ${UMBRUCH.pille}) {
    .untertiteltrenner, .untertitelrest { display: none; }
  }
  /* Ist der Titel weggescrollt, tritt er verkleinert ins Band -- links,
     spiegelbildlich zum Datum rechts, und mager statt fett: er meldet sich
     zurueck, ohne den Platz des Untertitels zu beanspruchen. Ein- und
     ausgeblendet ueber dieselbe Scroll-Zeitachse wie der Kopfschatten, also
     ohne Skript; wo der Browser sie nicht kennt, bleibt er unsichtbar. */
  .klebemarke {
    position: absolute; left: 1.25rem; top: 50%; transform: translateY(-50%);
    font: ${GEWICHT.normal} ${GRAD.grund}/${ZEILE.knapp} var(--titel); letter-spacing: ${SPERRUNG.leicht};
    text-transform: uppercase; color: var(--linie);
    text-decoration: none; opacity: 0;
    animation: markeauf linear both;
    animation-timeline: scroll(root);
    animation-range: ${SCROLLWEG.marke};
  }
  /* Im Band traegt der getilgte Buchstabe die Bandfarbe, nicht die Tinte --
     sonst verschwaende er im Schwarz. */
  .klebemarke .tilgung { color: inherit; }
  /* Unsichtbar ist sie auch kein Ziel: pointer-events wandert mit, damit am
     Seitenanfang niemand ins Leere klickt. */
  @keyframes markeauf {
    from { opacity: 0; pointer-events: none; }
    to { opacity: 1; pointer-events: auto; }
  }
  /* Wie die grosse Marke: beim Zeigen der Rotstift-Unterstrich. */
  .klebemarke:hover, .klebemarke:focus-visible {
    color: var(--papier); text-decoration: underline;
    text-decoration-color: var(--korrektur); text-decoration-thickness: ${STRICH.kraeftig};
    text-underline-offset: .28em; }
  /* Untertitelband und Ressortleiste bleiben beim Scrollen gemeinsam stehen;
     nur der Titel scrollt weg wie bei einer Zeitung. Der Schatten kommt erst,
     wenn der Titel darueber aus dem Bild ist -- ueber eine Scroll-Zeitachse,
     also ohne Skript; wo der Browser sie nicht kennt, klebt der Kopf ohne
     Schatten. Der Block steht ausserhalb des headers, weil sticky nicht
     ueber die Grenzen des Elternkastens hinaus kleben kann. */
  .klebekopf {
    position: sticky; top: 0; z-index: ${EBENE.kopf};
    margin-bottom: ${ABSTAND.r150};
    animation: kopfschatten linear both;
    animation-timeline: scroll(root);
    animation-range: ${SCROLLWEG.kopf};
  }
  .navzeile { background: var(--papier); }
  /* Beim Scrollen soll der Kopf sichtbar ueber dem Blatt liegen: der Schatten
     faellt tiefer und deutlich kraeftiger als zuvor — er trennt, statt nur
     anzudeuten. */
  @keyframes kopfschatten {
    from { box-shadow: 0 -${SCHATTEN.schaleFern} rgb(var(--schatten) / 0); }
    to { box-shadow: 0 -${SCHATTEN.schaleNah} rgb(var(--schatten) / ${DECKKRAFT.schale}); }
  }
  /* Auf der Meldungsliste klebt unterhalb schon die Filterzeile mit
     eigener Kante -- der Kopf traegt dort nur ein Viertel des Schattens,
     sonst stapeln sich zwei Trenner. */
  body:has(.listenrumpf) .klebekopf { animation-name: kopfschattenleise; }
  @keyframes kopfschattenleise {
    from { box-shadow: 0 -${SCHATTEN.schaleFern} rgb(var(--schatten) / 0); }
    to { box-shadow: 0 -${SCHATTEN.schaleNah} rgb(var(--schatten) / ${DECKKRAFT.schaleLeise}); }
  }
  /* Schmal gibt das Band beim Scrollen seine Zeile frei; der Kopf schrumpft
     dabei um genau diese Zeile. */
  @keyframes bandweicht {
    from { max-height: 3rem; opacity: 1; }
    to { max-height: 0; opacity: 0; }
  }
  .kopfinhalt {
    display: flex; flex-wrap: wrap; gap: ${ABSTAND.r70} ${ABSTAND.r150};
    align-items: baseline; justify-content: space-between;
  }
  .markenzeile.kopfinhalt { display: block; }
  /* Der Zeitungstitel laeuft nicht in der Schreibmaschine, sondern in einer
     Didone -- der Schriftgattung klassischer Titelkoepfe. Didot und Bodoni
     liegen auf Apple-Systemen, Georgia faengt den Rest ab. */
  .marke { font: ${GEWICHT.fett} ${GRAD.zeitung}/${ZEILE.titel} var(--titel);
    letter-spacing: ${SPERRUNG.leicht}; text-transform: uppercase;
    color: inherit; text-decoration: none; }
  /* Die Schrift bleibt in Tinte; ausgezeichnet wird ueber eine Unterstreichung
     im selben Rot wie der Tilgungsstrich und in derselben Staerke. */
  .marke:hover, .marke:focus-visible { text-decoration: underline;
    text-decoration-color: var(--korrektur); text-decoration-thickness: ${STRICH.kraeftig};
    text-underline-offset: .28em; }
  /* Der Wortmarke ist ein Fehler eingebaut, der zugleich getilgt wird: man liest
     „Korrekturen“ und sieht dabei, was die Anwendung tut. Fuer Vorlesesoftware
     traegt das aria-label am Link den richtigen Namen. */
  /* Der Buchstabe bleibt Text in Tinte -- rot ist nur der Strich, so wie auf
     Papier: der Fehler ist gesetzt, die Korrektur kommt von Hand dazu. */
  /* display: inline, nicht inline-block: ein Inline-Block bildet einen eigenen
     Dekorationsbereich, wodurch die Unterstreichung beim Ueberfahren am "h"
     abgerissen waere. */
  /* Die Lage teilen sich beide Marken; die Farbe nicht: auf dem Blatt bleibt
     der Buchstabe in Tinte, im schwarzen Band nimmt er die Bandfarbe an
     (siehe .klebemarke) -- in Tinte staende er dort schwarz auf schwarz. */
  .marke .tilgung, .klebemarke .tilgung { position: relative; }
  .marke .tilgung { color: var(--tinte); }
  /* Kein text-decoration und kein gerader Balken: ein Filzstiftstrich ist leicht
     gebogen, laeuft ueber den Buchstaben hinaus und wird zum Ende hin flacher.
     Deshalb eine gezeichnete Kurve als Data-URI statt einer gedrehten Linie. */
  .marke .tilgung::after, .klebemarke .tilgung::after {
    content: ""; position: absolute;
    left: -.22em; right: -.22em; top: -.15em; bottom: -.15em;
    background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${TILGUNG_STRICH.breite}' height='${TILGUNG_STRICH.hoehe}' viewBox='0 0 ${TILGUNG_STRICH.breite} ${TILGUNG_STRICH.hoehe}' preserveAspectRatio='none'%3E%3Cpath d='${TILGUNG_STRICH.pfad}' fill='${uri(PALETTE.korrektur)}'/%3E%3C/svg%3E") center / 100% 100% no-repeat;
  }
  nav { display: flex; gap: 0; flex-wrap: wrap; align-items: baseline;
    justify-content: center; width: 100%; }
  /* Die normale Navi zentriert sich in der Spalte; die Verwaltungsressorts
     haengen absolut am rechten Rand und beeinflussen die Mitte nicht. */
  nav { position: relative; }
  /* Als Pille: hellgrauer Grund, aussen halbrund; overflow schneidet die
     Hover-Flaechen der Haelften auf die Rundung zu. */
  .randressorts { display: flex; align-items: baseline;
    position: absolute; right: 0; top: 50%; transform: translateY(-50%);
    background: var(--linie); border-radius: ${RADIUS.voll}; overflow: hidden;
    margin: ${STRICH.haar}; }
  /* Auf mittleren Breiten faellt die Pille in den Fluss zurueck, sonst
     schoebe sie sich ueber das zentrierte Trio. */
  @media (max-width: ${UMBRUCH.pille}) {
    nav > a:first-child { margin-left: auto; }
    .randressorts { position: static; transform: none; margin-left: auto;
      align-self: center; }
  }
  /* Vertikal grosszuegiger als die Schrift verlangt: die Pille ist ein
     haeufiges Tippziel (~34px Hoehe). */
  .randressorts a { border-bottom: none; color: var(--tinte);
    padding: calc(${ABSTAND.r60} - ${STRICH.haar}) calc(${ABSTAND.r95} - ${STRICH.haar}); }
  /* Am Spalt stossen zwei Innenabstaende aufeinander und ergaeben sonst
     doppelt so viel Luft wie an den runden Aussenkanten. Innen daher knapper,
     damit die Pille in beiden Ansichten gleichmaessig wirkt. */
  /* Jede Marke mit Nachbarin rechts, nicht nur die erste: sonst behaelt die
     mittlere rechts das volle Polster, waehrend links schon das schmale
     steht -- die Naht saesse schief. */
  .randressorts a:not(:last-child) { padding-right: calc(${ABSTAND.r50} - ${STRICH.haar}); }
  /* Trennstrich im Seiten-Hintergrund: wirkt wie ein Spalt in der Pille. */
  .randressorts a + a { border-left: ${STRICH.kraeftig} solid var(--papier);
    padding-left: calc(${ABSTAND.r50} - ${STRICH.haar}); }
  /* Oberhalb des Telefons: 1px vom Polster in den Aussenabstand verlagert
     -- die Pille wirkt eine Spur kompakter und steht freier. */
  @media (min-width: ${UMBRUCH.abTablet}) {
    .randressorts { margin: ${STRICH.kraeftig}; }
    /* Breit haengt die Pille absolut und zentriert sich per transform --
       eine vertikale Margin schoebe sie aus der Mitte. */
    @media (min-width: ${UMBRUCH.abPille}) {
      .randressorts { margin: 0 ${STRICH.kraeftig} 0 0; }
    }
    .randressorts a { padding: calc(${ABSTAND.r60} - ${STRICH.kraeftig}) calc(${ABSTAND.r95} - ${STRICH.kraeftig}); }
    .randressorts a:not(:last-child) { padding-right: calc(${ABSTAND.r50} - ${STRICH.kraeftig}); }
    .randressorts a + a { padding-left: calc(${ABSTAND.r50} - ${STRICH.kraeftig}); }
  }
  .randressorts a:hover, .randressorts a:focus-visible {
    background: color-mix(in srgb, var(--linie) ${ANTEIL.ressortHover}, rgb(var(--schatten)));
    color: var(--tinte); }
  .randressorts a[aria-current="page"] {
    background: var(--balkengrund); color: var(--papier); }
  /* Breit traegt die Pille Text; schmaler als 62rem nur die Icons. */
  .randressorts .navicon { display: none; }
  @media (max-width: ${UMBRUCH.pille}) {
    .randressorts .ressorttext { display: none; }
    .randressorts .navicon { display: block; width: 1.575em; height: 1.575em;
      margin: 0; }
    /* Das groessere Icon frisst das Polster: die Pille bleibt so hoch wie
       der Aufklapper daneben, das Icon mittig darin. */
    .randressorts a { display: flex; align-items: center;
      padding-top: calc(${ABSTAND.r35} - ${STRICH.haar}); padding-bottom: calc(${ABSTAND.r35} - ${STRICH.haar}); }
  }
  /* Der Aufklapper der schmalen Navigation: die Zeile oben traegt den
     aktiven Bereich wie die aktive Ressortmarke (hell auf Karmin), die
     Liste faellt als Blatt darunter. */
  .navklapp { display: none; position: relative;
    font: ${GEWICHT.fett} ${GRAD.klein}/${ZEILE.eng} var(--mono); letter-spacing: ${SPERRUNG.leicht}; }
  .navklapp summary { list-style: none; cursor: pointer;
    display: inline-flex; align-items: center; gap: ${ABSTAND_EM.e50};
    background: var(--korrektur); color: var(--papier);
    padding: ${ABSTAND.r50} ${ABSTAND.r95} ${ABSTAND.r35}; }
  .navklapp summary::-webkit-details-marker { display: none; }
  .klapppfeil { font-size: ${GRAD_EM.pille}; transition: transform ${DAUER.flink} ease; }
  .navklapp[open] .klapppfeil { transform: rotate(180deg); }
  .klappliste { position: absolute; top: 100%; left: 0; min-width: 100%;
    z-index: ${EBENE.klappliste}; background: var(--papier); border: ${STRICH.haar} solid var(--linie);
    box-shadow: ${SCHATTEN.schwebe} rgb(var(--schatten) / ${DECKKRAFT.klappliste}); }
  .klappliste a { display: block; white-space: nowrap;
    padding: ${ABSTAND.r60} ${ABSTAND.r95} ${ABSTAND.r50}; color: var(--rand);
    text-decoration: none; border-bottom: ${STRICH.haar} solid var(--linie); }
  .klappliste a:last-child { border-bottom: none; }
  .klappliste a:hover, .klappliste a:focus-visible {
    background: var(--linie); color: var(--tinte); }
  nav a { font: ${GEWICHT.fett} ${GRAD.normal}/${ZEILE.eng} var(--mono); letter-spacing: ${SPERRUNG.leicht};
    color: var(--rand); text-decoration: none; padding: ${ABSTAND.r60} ${ABSTAND.r95} ${ABSTAND.r50};
    border-bottom: ${STRICH.kraeftig} solid transparent; }
  /* Das Icon steht als Inline-Element mit seiner Unterkante auf der
     Grundlinie der Schrift; die Feinkorrektur gleicht die Innenraender der
     Font-Awesome-Zeichenflaeche aus. */
  /* Zeichen, die nicht quadratisch angelegt sind, behalten ihr Verhaeltnis. */
  .navicon.schmal { width: auto; }
  .navicon { width: .85em; height: .85em; margin-right: ${ABSTAND_EM.e50};
    vertical-align: baseline; position: relative; top: .02em; }
  nav a:hover, nav a:focus-visible { color: var(--tinte); border-bottom-color: var(--korrektur); }
  /* Die aktuelle Seite ist rot hinterlegt statt groesser gesetzt: die Leiste
     behaelt so auf jeder Seite dieselbe Hoehe und springt beim Wechsel nicht. */
  nav a[aria-current="page"] { background: var(--korrektur); color: var(--papier); }

  /* Fehlersuche im Formular: Treffer als anklickbare Zeilen, jede mit der
     Wortaenderung und dem Satz, in dem sie steckt. Stilbefunde stehen
     nachrangig darunter und laufen blasser. */
  .pruefung { display: block; }
  .pruefung .quelle { margin: ${ABSTAND.r35} 0 0; }
  .treffer { display: flex; flex-direction: column; gap: ${ABSTAND.r35}; margin-top: ${ABSTAND.r50}; }
  .treffer:empty { margin-top: 0; }
  .treffer-zeile { display: block; width: 100%; text-align: left; cursor: pointer;
    margin: 0; padding: ${ABSTAND.r35} ${ABSTAND.r60}; border: ${STRICH.haar} solid var(--linie); border-radius: ${RADIUS.klein};
    background: var(--feld); color: var(--tinte); font: inherit;
    /* Kein Bleisatz-Klotz: das sind Zeilenknoepfe in einer Liste. */
    transform: none; box-shadow: none; }
  .treffer-zeile:hover, .treffer-zeile:focus-visible {
    transform: none; box-shadow: none; border-color: var(--korrektur); }
  .treffer-zeile.stil { opacity: ${DECKKRAFT.stiltreffer}; }
  .trefferWechsel { display: block; font: ${GEWICHT.fett} ${GRAD.klein}/${ZEILE.satz} var(--mono); }
  .trefferWechsel del { color: var(--korrektur); text-decoration-thickness: ${STRICH.kraeftig}; margin-right: ${ABSTAND_EM.e50}; }
  .trefferWechsel ins { color: var(--vorschlag); text-decoration: none; }
  .trefferOft { font: ${GRAD.winzig}/${ZEILE.eng} var(--sans); color: var(--rand); margin-left: ${ABSTAND_EM.e60}; }
  .trefferSatz { display: block; font-size: ${GRAD.klein}; color: var(--rand); margin-top: ${ABSTAND.r15}; }
  .trefferSatz mark { background: color-mix(in srgb, var(--korrektur) ${ANTEIL.trefferMarke}, var(--papier));
    color: var(--tinte); font-weight: ${GEWICHT.fett}; }

  /* QR-Code des Kurzbefehls: klein, mit Papierrand, damit Kameras ihn auch
     auf dunklem Grund lesen. */
  /* Blöcke, die der Spaltenumbruch nicht zerreissen darf: Ueberschrift,
     Link und QR-Code des Kurzbefehls gehoeren zusammen — sonst stuende der
     Code oben in der rechten Spalte und sein Link unten in der linken. */
  .zusammenhalt { break-inside: avoid; }

  /* Der Hinweis steht neben dem Code, nicht darunter — deshalb kein
     Umbruch; der Text schrumpft stattdessen mit der Spalte. */
  /* wrap: schmal rutscht der Kurzbefehl-Knopf unter den QR-Code, statt
     die Seite querscrollen zu lassen. */
  .qr-zeile { display: flex; flex-wrap: wrap; align-items: center; gap: ${ABSTAND.r95}; }
  .qr-zeile .zaehler { min-width: 0; }
  /* Neben dem Code stehen Knopf und Bildunterschrift untereinander; der
     Knopf traegt seine eigene Breite, nicht die der Spalte. */
  /* Kleine Grundbreite, damit der Text neben dem Code bleibt: bei
     flex-wrap wird umbrochen, bevor geschrumpft wird. */
  .qr-neben { display: flex; flex-direction: column; align-items: flex-start;
    gap: ${ABSTAND.r70}; min-width: 0; flex: 1 1 ${MASS.qrneben}; }

  /* Das i traegt seinen Hinweis selbst: beim Zeigen und beim Tastatur-Fokus,
     damit er nicht nur der Maus gehoert. Der Kasten haengt am Zeichen, ist
     aber breiter als es — deshalb die feste Breite statt einer, die vom
     Zeichen erbt. */
  /* Knopf und Zeichen auf einer Grundlinie mittig, mit Luft dazwischen --
     das Zeichen soll neben dem Knopf stehen, nicht an ihm kleben. */
  .knopfzeile { display: flex; align-items: center; gap: ${ABSTAND.r110};
    flex-wrap: wrap; }

  .infozeichen { position: relative; display: inline-flex; align-items: center;
    color: var(--rand); cursor: help; }
  /* 80 % groesser als ein Zeichen im Fliesstext (.85em): es steht allein,
     ohne Beschriftung, und muss von selbst auffindbar sein. */
  .infozeichen .navicon { width: 1.53em; height: 1.53em; margin-right: 0; top: 0; }
  .infozeichen:hover, .infozeichen:focus { color: var(--tinte); }
  .infozeichen::after { content: attr(data-hinweis);
    position: absolute; left: 0; top: calc(100% + .45rem); z-index: ${EBENE.kopf};
    width: min(${MASS.hinweisbreite}, ${MASS.hinweisdeckel}); padding: ${ABSTAND.r60} ${ABSTAND.r70};
    background: var(--papier); color: var(--tinte);
    border: ${STRICH.haar} solid var(--linie); border-left: ${STRICH.balken} solid var(--rand);
    /* Kraeftiger Schatten: der Kasten liegt ueber dem Satz und muss sich
       deutlich von ihm abheben. */
    border-radius: ${RADIUS.klein}; box-shadow: ${SCHATTEN.schwebe} rgb(var(--schatten) / ${DECKKRAFT.hinweiskasten});
    font: ${GEWICHT.normal} ${GRAD.winzig}/${ZEILE.luftig} var(--sans); text-align: left;
    /* Die Schritte stehen zeilenweise: die Umbrueche kommen aus dem
       data-Attribut und muessen erhalten bleiben. */
    white-space: pre-line;
    /* Nicht display:none: so bleibt der Text fuer Vorlesesoftware da und
       der Kasten laesst sich weich einblenden. */
    opacity: 0; visibility: hidden; transition: opacity ${DAUER.flink} ease; }
  /* Auch bei :focus, nicht nur :focus-visible -- auf dem Telefon gibt es
     kein Zeigen; dort oeffnet der Tipp den Hinweis. */
  .infozeichen:hover::after, .infozeichen:focus::after {
    opacity: 1; visibility: visible; }
  /* Am rechten Spaltenrand liefe der Kasten sonst aus dem Satzspiegel. */
  .infozeichen:last-child::after { left: auto; right: 0; }
  .qr { width: 100%; height: auto; display: block;
    background: var(--papier); padding: ${ABSTAND.r35}; border: ${STRICH.haar} solid var(--linie); border-radius: ${RADIUS.klein}; }
  /* Der Code ist ein Schalter, kein Knopf im Bleisatz: er traegt nichts als
     sich selbst. Angetippt waechst er auf Lesegroesse und legt sich beim
     naechsten Klick wieder ab -- angegeben wird nur die Breite, die Hoehe
     folgt dem Quadrat. */
  .qrschalter { display: block; box-sizing: border-box;
    /* Breite und flex-basis zusammen: als Flex-Element bemisst sich der
       Schalter nach der Basis, ein Uebergang allein auf width bliebe
       stehen. */
    width: ${MASS.qrKlein}; flex: 0 0 ${MASS.qrKlein};
    margin: 0; padding: 0; border: 0; font: inherit; color: inherit;
    max-width: 100%; cursor: zoom-in;
    transition: width ${DAUER.ruhig} ease, flex-basis ${DAUER.ruhig} ease; }
  /* Die Bleisatz-Gestalt der Knoepfe gilt hier nicht: der Code steht fuer
     sich, ohne Klotz, Kante und Schatten -- in jedem Zustand. */
  .qrschalter, .qrschalter:hover, .qrschalter:focus-visible, .qrschalter:active {
    background: none; transform: none; box-shadow: none; }
  .qrschalter:focus-visible { outline: ${STRICH.kraeftig} solid var(--korrektur); outline-offset: 3px; }
  /* Schlichte Laenge statt min(): Chrome haelt den Uebergang sonst am
     Anfangswert fest. Die Begrenzung uebernimmt max-width oben. */
  .qrschalter.gross { width: ${MASS.qrGross}; flex-basis: ${MASS.qrGross}; cursor: zoom-out; }

  h1 { font: ${GEWICHT.fett} ${GRAD.titel}/${ZEILE.knapp} var(--mono); margin: 0 0 ${ABSTAND.r125}; letter-spacing: ${SPERRUNG.fein}; }
  /* 1.2rem statt 1.15: ab 18.66px fett gilt Text als gross, und dort genuegt
     dem Balken ein Kontrast von 3 statt 4.5 — 0.8px, die die helle Schrift
     auf dem grauen Grund regelkonform machen. */
  h2 { font: ${GEWICHT.fett} ${GRAD.stark}/${ZEILE.satz} var(--mono); letter-spacing: ${SPERRUNG.fein};
    color: var(--tinte); margin: ${ABSTAND.r250} 0 ${ABSTAND.r70}; }
  /* Abschnitts-Balken (Verwaltungslisten und Rubriken) ueber die volle
     Spaltenbreite: hell auf Karmin wie die aktive Ressortmarke, mit leiser
     Rundung. Fliesstext-Zwischentitel bleiben still in Tinte. */
  h2.balken, h2.rubrik {
    /* Neutrales Dunkelgrau statt Karmin: der Balken gliedert, er zeichnet
       nicht aus. Gemischt aus Schwarz und Weiss — im Dunkelmodus mit
       geringerem Schwarzanteil, sonst saenke er in den dunklen Grund. */
    color: var(--balkenschrift);
    background: var(--balkengrund);
    /* Eckig wie ein gesetzter Balken: eine Rundung machte ihn zur Schaltflaeche. */
    border-radius: 0;
    /* Optisch mittig statt rechnerisch: Zentriert wird zwischen Versaloberkante
       und Grundlinie, denn so nimmt das Auge den Textkoerper wahr — ob zufaellig
       ein „g" vorkommt, darf die Lage nicht verschieben. Die Zeilenbox reserviert
       unten Platz fuer Unterlaengen, deshalb 0.68px mehr oben (.24 statt .2rem)
       und ebenso weniger unten; die Balkenhoehe bleibt gleich. */
    padding: ${ABSTAND.r25} ${ABSTAND.r70} ${ABSTAND.r15}; }
  /* Die Zaehlweise sitzt rechts oben im Balken: zweiteilige Pille wie in der
     Ressortleiste, nur kleiner und auf den dunklen Grund abgestimmt. Die
     aktive Haelfte ist kein Link — sie zeigt den Stand, sie schaltet nicht. */
  h2.balken { display: flex; align-items: center; justify-content: space-between; gap: ${ABSTAND.r100}; }
  .zaehlweise { display: inline-flex; border-radius: ${RADIUS.voll}; overflow: hidden;
    background: color-mix(in srgb, var(--balkengrund) ${ANTEIL.balkenpille}, var(--papier));
    font: ${GEWICHT.fett} ${GRAD.winzig}/${ZEILE.eng} var(--sans); letter-spacing: ${SPERRUNG.fein}; flex: none; }
  .zaehlweise > * { padding: ${ABSTAND.r35} ${ABSTAND.r70}; text-decoration: none;
    color: color-mix(in srgb, var(--balkenschrift) ${ANTEIL.balkenpilleSchrift}, var(--balkengrund)); }
  .zaehlweise > * + * { border-left: ${STRICH.kraeftig} solid var(--balkengrund); }
  .zaehlweise a:hover, .zaehlweise a:focus-visible {
    background: color-mix(in srgb, var(--balkengrund) ${ANTEIL.balkenpilleHover}, var(--papier));
    color: var(--balkenschrift); }
  .zaehlweise [aria-current] { background: var(--papier); color: var(--tinte); }
  /* Rubriken bleiben die groesste Sprechstufe: zentriert und gesperrt. */
  h2.rubrik { text-align: center; letter-spacing: ${SPERRUNG.gesperrt};
    text-transform: uppercase; font-size: ${GRAD.stark}; margin-top: ${ABSTAND.r300}; }
  h2.rubrik:first-child { margin-top: 0; }
  a { color: inherit; text-underline-offset: .2em; }

  /* Das Korrekturzeichen sitzt unmittelbar vor der Beschriftung, nicht in einer
     eigenen Randspalte: es gehoert zu dem, was darunter zu tun ist. */
  /* Emoji: sie bringen ihre Farbe selbst mit, deshalb hier weder color noch
     Schriftwahl. Auf Apple-Systemen ist das rote Kreuz kraeftig, der Haken
     dunkel und handgezeichnet, der Bleistift gelb. */
  .zeichen { font-size: ${GRAD_EM.gross}; line-height: 0; margin-right: ${ABSTAND_EM.e35};
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
    justify-content: space-between; gap: ${ABSTAND.r25} ${ABSTAND.r100}; margin: 0 0 ${ABSTAND.r35};
    font: ${GRAD.grund}/${ZEILE.satz} var(--mono); letter-spacing: ${SPERRUNG.fein}; color: var(--tinte); }
  .feld { margin-bottom: ${ABSTAND.r150}; }
  /* Wie ein gedrucktes Formular: keine weissen Kaesten auf dem Blatt, sondern
     Linien im Blatt. Einzeilige Angaben stehen auf einer Grundlinie; nur
     mehrzeilige Felder bekommen den duennen Rahmen, den auch gedruckte
     Bemerkungsfelder haben. Beim Fokus uebernimmt der Rotstift die Linie. */
  /* Formularelemente bringen hier eigene display-Angaben mit; die schlagen
     das [hidden]-Attribut, und Verstecktes bliebe sichtbar. Einmal fuer
     alle zurueckgenommen. */
  :is(input, textarea, select, button)[hidden] { display: none; }

  input, textarea, select {
    /* Block statt inline-block: die Grundlinien-Phantomluecke unter den
       Feldern wuerde sonst jede Zeile um ein paar Pixel hoeher machen als
       das sichtbare Feld -- und alles daneben saesse um genau diese Pixel
       zu tief. */
    display: block;
    width: 100%; font: inherit;
    background: transparent; color: inherit;
    border: none; border-bottom: ${STRICH.haar} solid var(--rand); border-radius: 0;
    padding: ${ABSTAND.r35} ${ABSTAND.r15};
  }
  textarea { border: ${STRICH.haar} solid var(--rand); padding: ${ABSTAND.r50} ${ABSTAND.r60}; }
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
  .abschluss { padding-top: ${ABSTAND.r125}; }
  .abschluss .feld { margin-bottom: 0; }
  .abschluss button { width: 100%; margin-top: 0; min-height: ${MASS.knopfhoehe}; }
  /* Zitat und Vorschlag im festen Raster: ein Leerzeichen zu viel oder ein
     Buchstabendreher ist nur so zu sehen. */
  #quoteBefore, #suggestionAfter { font: ${GRAD.grund}/${ZEILE.luftig} var(--mono); min-height: ${MASS.feldMittel}; }
  #quoteBefore { border-left: ${STRICH.markant} solid var(--korrektur); }
  #suggestionAfter { border-left: ${STRICH.markant} solid var(--vorschlag); }
  textarea { min-height: ${MASS.feldKlein}; resize: vertical; }

  /* Der Systempfeil ist auf jeder Plattform eine andere Form und passt zu keiner.
     Stattdessen derselbe Winkel wie das Einfuegezeichen am Rand, nur nach unten
     gedreht und mit runden Enden -- gezeichnet als Data-URI, damit nichts
     nachgeladen wird. */
  select {
    -webkit-appearance: none; appearance: none; padding-right: ${ABSTAND.r225};
    background-image: ${pfeil(PALETTE.rand)};
    background-repeat: no-repeat; background-position: right .8rem center;
    background-size: .8rem auto;
  }
  select:hover, select:focus-visible {
    background-image: ${pfeil(PALETTE.korrektur)};
  }
  optgroup { font: ${GEWICHT.halbfett} ${GRAD.klein} var(--mono); letter-spacing: ${SPERRUNG.leicht}; color: var(--rand); }
  optgroup option { font: ${GEWICHT.normal} ${GRAD.grund} var(--sans); letter-spacing: ${SPERRUNG.keine}; color: var(--tinte); }
  :focus-visible { outline: ${STRICH.kraeftig} solid var(--korrektur); outline-offset: 1px; }


  /* Kursiv, weil die Zusaetze erlaeutern und nicht benennen: sie gehoeren zu
     einer anderen Sprechebene als die Beschriftung links daneben. */
  .zaehler { font: italic 400 ${GRAD.klein}/${ZEILE.satz} var(--sans); letter-spacing: ${SPERRUNG.keine};
    text-transform: none; color: var(--rand); }
  /* Ganze Absaetze in dieser Nebenstimme wollen gelesen werden, nicht nur
     ueberflogen: sie bekommen Lesegroesse. Die kurzen Stempel an den
     Formularfeldern bleiben klein. */
  p.zaehler { font-size: ${GRAD.normal}; line-height: 1.55; }
  /* Automatisch befuellte Felder tragen ihren Hinweis als Stempel: hell auf
     Karmin, eckig wie die Ressortmarke, kursiv wie die uebrigen Zusaetze.
     Die Aussage steht im Text selbst, die Farbe traegt sie also nie allein. */
  .zaehler.erkannt { color: var(--papier); background: var(--korrektur);
    padding: ${ABSTAND.r10} ${ABSTAND.r25}; }
  /* Das zugehoerige Feld nimmt einen Hauch der Stempelfarbe an, als haette
     das Stempelkissen aufs Papier abgefaerbt: der Wert kam aus der Automatik,
     nicht von Hand. Der Ton ist aus der Palette gemischt, kein eigener Wert. */
  .feld:has(.zaehler.erkannt) :is(input, select, textarea) {
    background-color: color-mix(in oklab, var(--korrektur) ${ANTEIL.erkanntesFeld}, var(--feld));
    /* Aufgehellt und kursiv, nicht voll und aufrecht: der Vorschlag ist erst
       Vermutung, kein Urteil -- die Kursive ist die Stimme der Automatik. */
    color: color-mix(in oklab, var(--korrektur) ${ANTEIL.erkannteSchrift}, var(--feld));
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
  .kategoriezeile { display: flex; gap: ${ABSTAND.r60}; }
  .kategoriezeile #errorCount { width: ${MASS.feldKlein}; flex: none; }
  .kategoriezeile select { flex: 1; min-width: 0; }
  #errorCount[hidden] { display: none; }

  /* a.knopf: Verweise, die wie ein Knopf auftreten sollen -- der mailto-
     Abschluss des Besucher-Formulars und der Bezug des Kurzbefehls. Sie
     tragen dieselbe Bleisatz-Gestalt wie die freistehenden Knoepfe. */
  button, a.knopf {
    /* Beschriftung unten rechts: dort endet der Blick nach dem Ausfuellen, und
       im hohen Knopf saehe zentrierter Text verloren aus. */
    display: flex; align-items: flex-end; justify-content: flex-end;
    margin-top: ${ABSTAND.r50}; padding: ${ABSTAND.r80} ${ABSTAND.r70} ${ABSTAND.r70} ${ABSTAND.r125}; cursor: pointer;
    font: ${GEWICHT.fett} ${GRAD.stark}/${ZEILE.eng} var(--mono); letter-spacing: ${SPERRUNG.leicht};
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
    border: ${STRICH.kraeftig} solid transparent; border-radius: 0;
    transition: transform ${DAUER.flink} ease, box-shadow ${DAUER.flink} ease;
    /* Die Grundflaeche (z=0) liegt exakt auf der Layoutposition, im Raster
       der Formularfelder (x wie y). In Ruhe schwebt die Deckflaeche um die
       Kantentiefe darueber, die Kanten fuehren auf die Grundflaeche zurueck,
       aus der der weiche Schlagschatten faellt. */
    transform: translate(-${HUB.ruhe}px, -${HUB.ruhe}px);
    box-shadow: ${klotzKanten(HUB.ruhe)}, ${SCHATTEN.klotz} rgb(var(--schatten) / ${DECKKRAFT.klotz});
  }
  /* Beim Zeigen hebt sich der Klotz weiter aus dem Blatt; die Grundflaeche
     bleibt im Raster verankert. */
  button:hover, button:focus-visible, a.knopf:hover, a.knopf:focus-visible {
    transform: translate(-${HUB.gehoben}px, -${HUB.gehoben}px);
    box-shadow: ${klotzKanten(HUB.gehoben)}, ${SCHATTEN.klotzGehoben} rgb(var(--schatten) / ${DECKKRAFT.klotzGehoben});
  }
  /* Beim Druecken kippt der Koerper ins Negativ: die Flaeche sinkt um die
     Kantentiefe unter die Grundflaeche. Die Aushoehlung zeigt dieselben
     isometrischen Seitenwaende wie der erhabene Koerper -- abgedunkelt, weil
     sie im eigenen Schatten liegen --, dazu der weiche Schattenfall auf die
     vertiefte Flaeche. Die Flaechenfarbe selbst bleibt unveraendert. */
  a.knopf { display: inline-flex; text-decoration: none; }
  button:active, a.knopf:active {
    transform: none;
    /* Die Fuellung endet an der Innenkante des (transparenten) Rahmens: um
       die Vertiefung herum scheint das Blatt durch, kein grauer Saum. */
    background-clip: padding-box;
    box-shadow: ${klotzKanten(HUB.ruhe, true)}, ${SCHATTEN.klotzVertieft} rgb(var(--schatten) / ${DECKKRAFT.klotzVertieft});
  }
  /* Das Zeilenschaltungszeichen sagt, dass der Knopf auch mit der Eingabetaste
     ausgeloest wird. aria-hidden, weil das fuer Vorlesesoftware ohnehin gilt. */
  /* Text und Zeichen teilen sich eine Zeilenbox, damit das ⏎ auf der Grundlinie
     der Beschriftung sitzt und nicht darunter haengt. */
  /* Beschriftung samt Icon in einer Zeile: bricht der Text um, stuende das
     Zeichen sonst allein in der ersten. Der Text bleibt dabei gewoehnlicher
     Inline-Fluss (kein Flex) -- nur dort teilen Icon und Schrift eine
     Grundlinie; im Flex-Kasten des Knopfes gaebe es keine gemeinsame, weil
     dessen align-items die Beschriftung an die Unterkante zieht. */
  .knopftext { display: block; white-space: nowrap; }
  button, a.knopf { white-space: nowrap; }
  .taste { margin-left: ${ABSTAND_EM.e35}; font-size: ${GRAD_EM.gross}; opacity: ${DECKKRAFT.taste}; }
  /* Filter der Meldungsliste: eine Reihe, die schmal umbricht. Sie klebt
     unter dem Kopf (top setzt das Seitenskript aus dessen gemessener Hoehe);
     der Papiergrund deckt die durchlaufenden Zeilen ab. z-Index unter dem
     Kopf, damit sie beim Fortscrollen unter ihm verschwindet, nicht davor. */
  /* Fester Teil der Schale (siehe .listenrumpf): kein eigenes Kleben, die
     Seite selbst scrollt nicht. Tintenkante und Schatten trennen zum
     Scrollbereich. */
  .filterzeile { display: flex; flex-wrap: wrap; gap: ${ABSTAND.r35} ${ABSTAND.r50}; align-items: center;
    margin: 0; padding: ${ABSTAND.r35} 0 ${ABSTAND.r35}; position: relative; z-index: ${EBENE.imBlatt};
    background: var(--papier); border-bottom: ${STRICH.haar} solid var(--tinte);
    box-shadow: 0 ${SCHATTEN.leiste} rgb(var(--schatten) / ${DECKKRAFT.leiste}); }
  /* Die Trefferzahl vor den Filtern: dicktengleich und ruhig, kein Wert mit
     Bedeutung, nur die Antwort auf "wie viele sind das gerade?". */
  .trefferzahl { font: ${GEWICHT.fett} ${GRAD.normal}/${ZEILE.eng} var(--mono); color: var(--rand);
    padding-right: ${ABSTAND.r35}; }
  /* Eine Schrift fuer alle Bedienteile: ohne sie erben nur die Selects im
     Label die Schreibmaschine, der Rest faellt auf die Grundschrift. */
  .filterzeile select, .filterzeile input { width: auto; margin: 0;
    font: ${GRAD.normal}/${ZEILE.satz} var(--mono); }
  /* Breit ist das Filterfeld unsichtbare Verpackung um den Select. */
  .filterfeld { display: contents; }
  .filterfeld .navicon { display: none; }
  /* Kategorie als Chip auf allen Breiten: Tabelle zeigt die Langform,
     die Karte (schmal) die Kurzform. */
  .meldungsliste .sp-kategorie .langform,
  .meldungsliste .sp-kategorie .kurzform {
    background: var(--korrektur); color: var(--papier);
    font-size: ${GRAD_EM.pille}; line-height: 1; border-radius: ${RADIUS.klein}; padding: ${ABSTAND.px4};
    white-space: nowrap; }
  .meldungsliste .sp-kategorie .langform { display: inline-block; }
  .sp-kategorie .kurzform { display: none; }
  /* Weiche Kategorien (WEICHE_FEHLERARTEN) treten leiser auf. Der Text
     bleibt weiss -- dunkel deshalb Licht statt Papier. */
  .meldungsliste .sp-kategorie.weich .langform,
  .meldungsliste .sp-kategorie.weich .kurzform {
    background: var(--korrektur-weich); color: rgb(var(--licht)); }
  /* Der Rueckweg aus dem Detail: als Tippziel gepolstert. */
  .zurueckliste { display: inline-block; padding: ${ABSTAND.r50} 0; }

  /* Der Schweregrad als Chip in derselben Form. Die Toene sind vom
     Korrekturrot aus im Farbton verschoben (relative Farbsyntax, keine
     eigenen Werte): schwer bleibt Karmin, mittel dreht nach Orange,
     leicht weiter nach Gelb -- dunkler nachgezogen, damit das Papierweiss
     darauf lesbar bleibt. Bewusste Ausnahme von "keine Ampelfarben":
     nur hier, in der nicht-oeffentlichen Liste (Zuruf vom 15.8.2026). */
  .meldungsliste .sp-ausgang, .meldungsliste .sp-datum { white-space: nowrap; }
  .meldungsliste .nrim, .meldungsliste .sp-ausgang .kurzform { display: none; }
  /* Die Lage, wenn nichts abzugleichen ist: schmale Zahlenaufstellung. */
  .lagetabelle { width: auto; margin-top: ${ABSTAND.r100}; }
  .lagetabelle td { font: ${GRAD.klein}/${ZEILE.satz} var(--mono); }
  .lagetabelle td + td { text-align: right; font-weight: ${GEWICHT.fett}; }
  .lagetabelle .lageunter { padding-left: ${ABSTAND.r150}; color: var(--rand); }
  .lagetabelle .lagetief { padding-left: ${ABSTAND.r300}; }

  /* Abgleich: ein Fall je Bildschirm. Die beiden Belege stehen als Zitate
     untereinander, jeder mit seiner Herkunft als Marke davor. */
  .abgleichfall { border: ${STRICH.haar} solid var(--linie); border-left: ${STRICH.markant} solid var(--korrektur);
    padding: ${ABSTAND.r80} ${ABSTAND.r95}; margin: ${ABSTAND.r50} 0 ${ABSTAND.r150}; background: var(--feld); }
  .abgleichkopf { margin: 0 0 ${ABSTAND.r25}; font: ${GRAD.normal}/${ZEILE.satz} var(--mono); color: var(--rand); }
  .abgleichtitel { margin: 0 0 ${ABSTAND.r60}; font: ${GEWICHT.fett} ${GRAD.stark}/${ZEILE.knapp} var(--titel); }
  .abgleichstelle { margin: 0 0 ${ABSTAND.r80}; font: ${GRAD.grund}/${ZEILE.luftig} var(--mono); }
  .abgleichstelle del { color: var(--korrektur); text-decoration-thickness: ${STRICH.kraeftig}; }
  .abgleichstelle ins { color: var(--vorschlag); text-decoration: none; }
  .abgleichbeleg { margin: 0 0 ${ABSTAND.r35}; font: ${GRAD.klein}/${ZEILE.luftig} var(--sans); }
  .belegmarke { display: inline-block; margin-right: ${ABSTAND.r50};
    padding: ${ABSTAND.px4} ${ABSTAND.px9}; border-radius: ${RADIUS.voll};
    background: var(--balkengrund); color: var(--balkenschrift);
    font: ${GEWICHT.fett} ${GRAD_EM.pille}/${ZEILE.eng} var(--sans); white-space: nowrap; }
  /* Der Umschalter zwischen den beiden Warteschlangen -- dieselbe zweiteilige
     Pille wie die Zaehlweise in der Bilanz, nur frei stehend. */
  .abgleichwahl { display: inline-flex; margin: 0 0 ${ABSTAND.r100}; }
  /* Der Rat zum Befund: eine Nebenstimme, keine zweite Aussage. */
  .belegrat { color: var(--rand); font-style: italic; }
  .lesezeichenzeile { display: flex; flex-wrap: wrap; align-items: center; gap: ${ABSTAND.r70}; }
  /* Die Einfuege-Pruefung steht zwischen Beleg und Entscheidung: sie kann
     den Befund noch aendern, auf den die Knoepfe sich stuetzen. */
  .einfuegepruefung { margin: ${ABSTAND.r80} 0; }
  .einfuegepruefung label { font: ${GRAD.klein}/${ZEILE.satz} var(--sans); color: var(--rand);
    display: block; margin-bottom: ${ABSTAND.r25}; }
  .einfuegepruefung textarea { font: ${GRAD.klein}/${ZEILE.satz} var(--mono); }
  .abgleichtasten { display: flex; flex-wrap: wrap; align-items: center; gap: ${ABSTAND.r70}; }
  .abgleichtasten form { margin: 0; display: flex; align-items: flex-end; gap: ${ABSTAND.r35}; }
  /* Das Feld gehoert zum Knopf daneben, nicht ins Blatt: schmaler und ohne
     die betonte Unterkante der Formularfelder. */
  .andersfassung { width: ${MASS.suchbreite}; font: ${GRAD.klein}/${ZEILE.satz} var(--mono); }

  /* Die Titelzelle scrollt ohne sichtbaren Balken. Die Geste endet in ihr,
     sonst liest der Browser sie als "eine Seite zurueck" (Finger; das
     Mausrad faengt das Seitenskript ab). */
  .meldungsliste td.sp-artikel { scrollbar-width: none; overscroll-behavior-x: contain; }
  .meldungsliste td.sp-artikel::-webkit-scrollbar { display: none; }
  .meldungsliste .gradchip { display: inline-block;
    background: var(--korrektur); color: var(--papier);
    font-size: ${GRAD_EM.pille}; line-height: 1; border-radius: ${RADIUS.voll}; padding: ${ABSTAND.px4} ${ABSTAND.px9};
    white-space: nowrap; }
  /* Volle Toene statt abgedunkelt; auf den hellen traegt Schwarz den Text. */
  .meldungsliste .gradchip.grad-2 {
    background: hsl(from var(--korrektur) calc(h + ${SCHWEREGRAD_TON.mittel.drehung}) ${SCHWEREGRAD_TON.mittel.saettigung} ${SCHWEREGRAD_TON.mittel.helligkeit});
    color: rgb(var(--schatten)); }
  .meldungsliste .gradchip.grad-1 {
    background: hsl(from var(--korrektur) calc(h + ${SCHWEREGRAD_TON.leicht.drehung}) ${SCHWEREGRAD_TON.leicht.saettigung} ${SCHWEREGRAD_TON.leicht.helligkeit});
    color: rgb(var(--schatten)); }
  /* Ohne die betonte Unterkante der Formularfelder: hier sind es Werkzeuge
     in einer Leiste, keine Eingaben im Blatt. */
  .filterzeile select, .filterzeile input[type="search"] {
    border-bottom: 0; }
  .filterzeile input[type="search"] { flex: 1; min-width: ${MASS.suchbreite}; }

  /* Blaettern unter der Meldungsliste: dieselben Bleisatz-Kloetze wie die
     freistehenden Knoepfe, nur kleiner. Die aktive Seite steht als
     eingedrueckter Klotz da — dieselbe Vertiefung wie ein gedrueckter
     Knopf, aber dauerhaft und ohne Ziel. Der untere feste Teil der Schale:
     statisch, denn die Seite scrollt nicht. Der Innenrand schliesst die
     Klotz-Geometrie ein (Hub 7px, Kanten 5px), sonst blitzten die Zeilen
     um die Knoepfe herum durch. Tintenkante und Schatten spiegeln die
     Filterzeile. */
  .seitenblaettern { display: flex; flex-wrap: wrap; gap: ${ABSTAND.r35} ${ABSTAND.r70};
    justify-content: center; align-items: center;
    margin: 0; padding: ${ABSTAND.r50} 0 ${ABSTAND.r60}; position: relative; z-index: ${EBENE.imBlatt};
    background: var(--papier); border-top: ${STRICH.haar} solid var(--tinte);
    box-shadow: 0 -${SCHATTEN.leiste} rgb(var(--schatten) / ${DECKKRAFT.leiste}); }

  /* Die Meldungsliste scrollt wie jede Seite: erst zieht der Titel davon,
     der klebende Kopf bleibt stehen -- und die Filterzeile klebt buendig
     darunter (ihr top ist die gemessene Kopfhoehe, als CSS-Variable vom
     Seitenskript gesetzt; der Kopf schrumpft schmal beim Scrollen).
     Blaetterreihe und Fusszeile stehen fest am unteren Rand; das Blatt
     reserviert genau deren gemessene Hoehe. */
  body:has(.listenrumpf) { padding-bottom: 0; }
  body:has(.listenrumpf) .klebekopf { margin-bottom: 0; }
  body:has(.listenrumpf) .blatt { width: 100%;
    padding-top: 0; padding-bottom: var(--leistehoehe, ${ABSTAND.r600}); }
  body:has(.listenrumpf) .filterzeile { position: sticky;
    top: var(--kopfhoehe, ${MASS.kopfhoehe}); z-index: ${EBENE.leiste}; }
  body:has(.listenrumpf) .seitenblaettern { position: fixed;
    bottom: var(--fusshoehe, 2rem); left: 50%; transform: translateX(-50%);
    width: min(100% - ${MASS.schalenluft}, var(--mass) - ${MASS.schalenluft}); z-index: ${EBENE.leiste}; }
  /* Die Fusszeile steht auf jeder Seite fest am unteren Rand -- eine Regel
     fuer alle (Entscheidung vom 13.8.2026). Unter der Liste war sie das
     schon; sie bekommt dadurch keine zweite Fixierung, sondern dieselbe.
     Was sich unterscheidet, steht weiter unten: Linie und Luft oben. */
  .fusszeile { position: fixed; bottom: 0;
    left: 50%; transform: translateX(-50%); z-index: ${EBENE.leiste};
    width: min(100% - ${MASS.schalenluft}, var(--mass) - ${MASS.schalenluft});
    margin: 0; background: var(--papier); }
  .listenrumpf table { margin-top: ${ABSTAND.r25}; }
  /* Die Spaltenkoepfe kleben unter der Filterzeile (Halt = gemessene Hoehe
     von Kopf und Zeile) und liegen unter ihr, statt sie zu verdecken. Die
     Linie als Innenschatten: border-collapse laesst den Rahmen mitscrollen. */
  body:has(.listenrumpf) .meldungsliste thead th {
    position: sticky; top: var(--kopfleiste, ${MASS.kopfhoehe});
    z-index: ${EBENE.imBlatt}; background: var(--papier);
    border-bottom-color: transparent;
    box-shadow: inset 0 -${STRICH.haar} 0
      color-mix(in srgb, var(--tinte) ${ANTEIL.trennlinie}, transparent); }
  /* Breite Arbeits-Tabellen (Medien, Kategorien, Meldungen): der Inhalt
     scrollt IN der Seite quer, nie die Seite selbst. Die Grenze liegt dort,
     wo die breiteste Tabelle noch passt. */
  /* Breit nimmt der Titel die Restbreite der Tabelle und kuerzt mit
     Ellipse (max-width 0 zwingt die Spalte auf den uebrigen Raum). */
  @media (min-width: ${UMBRUCH.abBreit}) {
    .meldungsliste td.sp-artikel { width: 100%; max-width: 0;
      overflow-x: auto; white-space: nowrap; }
  }
  /* Zwischenmodus (Tablet-Hochformat): die Tabelle bleibt einzeilig und
     verzichtet aufs Querscrollen -- Datum und Medium treten ab (stehen im
     Detail), die Nummer rueckt zur Kennung, der Ausgang traegt die
     Kurzform, der Titel nimmt die Restbreite und scrollt in der Zelle. */
  @media (min-width: ${UMBRUCH.abTablet}) and (max-width: ${UMBRUCH.tablet}) {
    .querblatt .meldungsliste { width: 100%; min-width: 0; }
    .meldungsliste .sp-datum, .meldungsliste .sp-medium { display: none; }
    .meldungsliste .sp-nr { display: none; }
    .meldungsliste .nrim { display: inline; font: ${GEWICHT.fett} ${GRAD.normal}/${ZEILE.satz} var(--mono);
      color: var(--rand); }
    .meldungsliste td.sp-kennung { white-space: nowrap; }
    .meldungsliste td.sp-artikel { width: 100%; max-width: 0;
      overflow-x: auto; white-space: nowrap; }
    .meldungsliste .sp-ausgang .langform { display: none; }
    .meldungsliste .sp-ausgang .kurzform { display: inline; }
  }
  @media (max-width: ${UMBRUCH.tablet}) {
    /* Wie an der Titelzelle: die Geste endet am Rand der Tabelle. */
    .querblatt { overflow-x: auto; overscroll-behavior-x: contain; }
    .querblatt table { width: max-content; min-width: 100%; }

    /* Entfernen-Knopf rechts und Namensspalte links bleiben beim
       Querscrollen stehen; der Papiergrund deckt die durchlaufenden
       Zellen ab. */
    .querblatt th.aktion, .querblatt td.aktion { position: sticky; right: 0;
      background: var(--papier); z-index: ${EBENE.imBlatt}; }
    .querblatt .namenfest th:first-child, .querblatt .namenfest td:first-child {
      position: sticky; left: 0; background: var(--papier); z-index: ${EBENE.imBlatt}; }
    /* Domains reihen sich sonst ungebremst: Deckel und Ellipse, die volle
       Liste steht im title. */
    .querblatt .sp-domain { max-width: ${MASS.domainbreite};
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  }
  @media (max-width: ${UMBRUCH.schmal}) {
    /* Randlos ueber die volle Breite: die zentrierte Spalte liesse Streifen
       frei, durch die der scrollende Inhalt vorbeizoege. */
    body:has(.listenrumpf) .seitenblaettern, .fusszeile {
      width: 100%; max-width: none; left: 0; transform: none; }
  }
  body:has(.listenrumpf) .blatt th,
  body:has(.listenrumpf) .blatt td { padding: ${ABSTAND.r25} ${ABSTAND.r50}; }
  /* Telefon: aus jeder Meldungszeile wird eine Karte. Datum, Medium und
     Grad treten ab (stehen im Detail); die Kategorie schliesst als Band in
     Korrekturrot ab und trennt so zur naechsten Karte. */
  @media (max-width: ${UMBRUCH.telefon}) {
    .querblatt .meldungsliste { width: 100%; min-width: 0; }
    /* Nur Medien und Kategorien: Icon als Beschriftung, der Select selbst
       zeigt kurz das Gewaehlte (Breitendeckel + Ellipse). Der Ausgang
       steht in den Karten selbst. */
    .filterzeile select[name="ausgang"] { display: none; }
    /* Eine Zeile fuer alles: die Selects geben ab, das Suchfeld schrumpft. */
    .filterzeile { flex-wrap: nowrap; }
    .filterzeile input[type="search"] { flex: 1 1 ${MASS.suchbreiteFluss}; min-width: ${MASS.suchbreiteSchmal}; }
    .filterfeld { display: flex; flex-wrap: nowrap; align-items: center;
      gap: ${ABSTAND.r35}; flex: 0 1 auto; min-width: 0; }
    .filterfeld .navicon { display: block; width: 1em; height: 1em;
      margin: 0; flex: none; color: var(--rand); }
    .filterfeld select { min-width: 0; max-width: ${MASS.filterselect};
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .meldungsliste, .meldungsliste tbody { display: block; }
    .meldungsliste thead, .meldungsliste .sp-medium { display: none; }
    /* Die Karte hebt sich leicht vom Papier ab: Richtung Licht gemischt,
       aber nicht reinweiss. */
    .meldungsliste tr { background: color-mix(in srgb, rgb(var(--licht)) ${ANTEIL.karte}, var(--papier));
      display: flex; flex-wrap: wrap; align-items: baseline;
      margin: ${ABSTAND.r50} 0; border: ${STRICH.haar} solid var(--linie); }
    /* tr td: hebt die Spezifitaet ueber die Polster-Regel des Blattes. */
    .meldungsliste tr td { display: block; border-bottom: 0; }
    /* Zeile 1: Nr · Kennung — Datum rechts. */
    .meldungsliste tr td.sp-nr { order: 1; padding-right: 0;
      font: ${GEWICHT.fett} ${GRAD.normal}/${ZEILE.satz} var(--mono); color: var(--rand); }
    .meldungsliste tr td.sp-nr::after { content: "\u00a0·\u00a0"; }
    .meldungsliste tr td.sp-kennung { order: 2; padding-left: 0; }
    .meldungsliste tr td.sp-datum { order: 3; margin-left: auto;
      font-size: ${GRAD.klein}; color: var(--rand); }
    /* Zeile 2: die Ueberschrift, auf zwei Zeilen gekappt. */
    .meldungsliste tr td.sp-artikel { order: 4; width: 100%; max-width: none;
      padding-top: 0; white-space: normal;
      display: -webkit-box; -webkit-box-orient: vertical;
      -webkit-line-clamp: 2; overflow: hidden; }
    /* Zeile 3: der Kategorie-Chip (Kurzform) voran, dann Grad · Ausgang. */
    .meldungsliste tr td.sp-kategorie { order: 5; margin-left: ${ABSTAND.r50};
      align-self: center; padding: 0; }
    .meldungsliste tr td.sp-grad { order: 6;
      font-size: ${GRAD.klein}; color: var(--rand); }
    /* Die eigene Schlusszeile der Karte traegt die volle Bezeichnung. */
    .meldungsliste tr td.sp-ausgang { order: 7; margin-left: auto;
      font-size: ${GRAD.klein}; color: var(--rand); white-space: nowrap; }
    .meldungsliste .sp-kategorie .langform { display: none; }
    .sp-kategorie .kurzform { display: inline-block; }
    /* Kennzahl-Kacheln paarweise: vier Aussagen, halber Scrollweg.
       div-Praefix: die Basisregel steht spaeter im Blatt. */
    div.eckdaten { grid-template-columns: 1fr 1fr; gap: ${ABSTAND.r60}; }
    div.kennzahl { padding: ${ABSTAND.r60} ${ABSTAND.r60}; }

    /* Lange Erlaeuterungen: zwei Zeilen, Antippen klappt auf. */
    p.zaehler, .kennzahl-erklaerung { display: -webkit-box;
      -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
    p.zaehler.offen, .kennzahl-erklaerung.offen { -webkit-line-clamp: unset; }
  }
  /* Unter dem Text derselbe Weissraum wie ueberall (.6rem, siehe
     .fussinhalt) -- so steht die Herkunftszeile auf jeder Seite gleich
     hoch ueber der Unterkante (Entscheidung vom 13.8.2026). Oben bleibt
     es knapp: darueber liegt die Blaetterreihe. */
  body:has(.listenrumpf) .fussinhalt { padding: ${ABSTAND.r25} 0 ${ABSTAND.r60}; border-top: 0; }

  /* Flach gehalten: die Knoepfe behalten ihre Masse, nur die Reihe verliert
     die zusaetzlichen Innenraender. */
  .seitenblaettern a.knopf, .seitenblaettern .seitenknopf-aktiv,
  .seitenblaettern .seitenrand { margin-top: 0; }
  /* zurueck und vor ruecken von den Seitenzahlen ab: Randsteine, keine
     Glieder der Zahlenreihe. */
  .seitenblaettern > :first-child { margin-right: ${ABSTAND.r110}; }
  .seitenblaettern > :last-child { margin-left: ${ABSTAND.r110}; }
  .seitenblaettern a.knopf, .seitenblaettern .seitenknopf-aktiv {
    font-size: ${GRAD.normal}; padding: ${ABSTAND.r50} ${ABSTAND.r80} ${ABSTAND.r35}; min-height: 0; }
  /* Der Block ist ein <nav>: die Kopfzeilen-Regeln (nav a) wuerden hier
     roten Unterstrich und Tinte beim Zeigen hineintragen. Der Klotz behaelt
     stattdessen Papierschrift und kommt ohne Unterstrich aus. */
  .seitenblaettern a.knopf, .seitenblaettern a.knopf:hover,
  .seitenblaettern a.knopf:focus-visible {
    color: var(--papier); border-bottom: 0; }
  .seitenknopf-aktiv { display: inline-flex; margin-top: ${ABSTAND.r50};
    font: ${GEWICHT.fett} ${GRAD.normal}/${ZEILE.eng} var(--mono); letter-spacing: ${SPERRUNG.leicht};
    background: var(--rand); color: var(--papier);
    border: ${STRICH.kraeftig} solid transparent; border-radius: 0;
    background-clip: padding-box;
    box-shadow: ${klotzKanten(HUB.ruhe, true)}, ${SCHATTEN.klotzVertieft} rgb(var(--schatten) / ${DECKKRAFT.klotzVertieft}); }
  /* zurueck/vor ohne Ziel: derselbe Klotz-Koerper, aber auf z = 0 -- weder
     gehoben noch vertieft, keine Kanten, kein Schatten. Die Flaeche liegt
     flach auf dem Blatt, hell und stark zurueckgenommen: erkennbar Teil der
     Reihe, erkennbar ohne Funktion. */
  .seitenrand { display: inline-flex; align-items: center; margin-top: ${ABSTAND.r50};
    font: ${GEWICHT.fett} ${GRAD.normal}/${ZEILE.eng} var(--mono); letter-spacing: ${SPERRUNG.leicht};
    padding: ${ABSTAND.r50} ${ABSTAND.r80} ${ABSTAND.r35}; border: ${STRICH.kraeftig} solid transparent; border-radius: 0;
    background: color-mix(in srgb, var(--rand) ${ANTEIL.seitenrandGrund}, var(--papier));
    color: color-mix(in srgb, var(--rand) ${ANTEIL.seitenrandSchrift}, var(--papier));
    transform: none; box-shadow: none; }
  /* Anker-Zitate im Meldungsdetail: die Fundstelle traegt Gewicht, der
     Kontext die Nebenstimme. */
  blockquote.anker { margin: 0 0 ${ABSTAND.r100}; padding: ${ABSTAND.r60} ${ABSTAND.r95};
    border-left: ${STRICH.balken} solid var(--linie); font: ${GRAD.grund}/${ZEILE.luftig} var(--mono); }
  /* Der Einfuegeknopf steht links vor dem Fundstellen-Feld: ein
     Geisterknopf -- nur das Zeichen, kein Klotz, kein Rahmen. In Ruhe grau
     wie der Tabellen-Griff, unter dem Zeiger Tinte; er tritt erst hervor,
     wenn man ihn meint. Die Ruecksetzungen heben die Bleisatz-Gestalt der
     freistehenden Knoepfe auf. */
  .feldzeile { position: relative; }
  /* Der Einfuege-Hinweis ist kurz und darf deshalb etwas groesser sprechen
     als die uebrigen Zusaetze. */
  #einfuege-hinweis { font-size: ${GRAD.normal}; }
  /* Die gesperrte Fundstelle ist leicht zurueckgenommen -- lesbar, aber
     erkennbar "uebernommen, nicht in Arbeit". Der Zeiger laedt zum
     Entsperren ein. */
  .feldzeile textarea[readonly] { cursor: pointer;
    background: var(--linie);
    border-color: color-mix(in srgb, var(--linie) ${ANTEIL.gesperrtRahmen}, var(--rand));
    color: color-mix(in srgb, var(--tinte) ${ANTEIL.gesperrtSchrift}, var(--linie)); }
  button.einfuegeknopf, button.einfuegeknopf:hover, button.einfuegeknopf:focus-visible,
  button.einfuegeknopf:active {
    background: none; transform: none; box-shadow: none; }
  button.einfuegeknopf {
    display: inline-flex; align-items: center; justify-content: center;
    width: 2rem; height: 2rem;
    margin: 0 0 ${ABSTAND.r25}; padding: ${ABSTAND.r35}; border: 0; min-height: 0;
    color: var(--rand); cursor: pointer; transition: color ${DAUER.flink} ease; }
  /* display schlaegt das hidden-Attribut -- ausdruecklich wieder herstellen. */
  button.einfuegeknopf[hidden] { display: none; }
  button.einfuegeknopf:hover, button.einfuegeknopf:focus-visible { color: var(--tinte); }
  button.einfuegeknopf .navicon { width: ${MASS.zeilenicon}; height: ${MASS.zeilenicon}; margin: 0; }
  /* Sobald links vom Blatt Rand frei ist, haengt der Knopf dort: vor dem
     Feld, nicht in dessen Spalte -- das Feld behaelt die volle Breite.
     Schmaler steht er ueber dem Feld, denn dort gibt es keinen Rand. */
  @media (min-width: ${UMBRUCH.weit}) {
    button.einfuegeknopf { position: absolute; top: .1rem;
      right: calc(100% + .45rem); margin: 0; }
  }
  /* Knoepfe im Fliesstext sind keine Formularabschluesse: sie stehen mitten
     im Absatz, tragen deshalb kleinere Schrift und ihre Beschriftung mittig
     statt unten rechts. Mittig heisst hier optisch -- zentriert wird die
     Versalienhoehe, nicht die Zeilenbox; der Ausgleich steht in den
     Innenabstaenden (gemessen). */
  button.zeilenknopf, a.zeilenknopf { align-items: center; justify-content: center;
    /* inline-flex fuer beide: als blockartiger Kasten faellt der obere
       Abstand eines <button> mit dem Rand des Absatzes zusammen, bei einem
       <a> nicht -- die beiden Knoepfe saessen sonst unterschiedlich tief. */
    display: inline-flex;
    font-size: ${GRAD.grund}; padding: ${ABSTAND.r60} ${ABSTAND.r100} ${ABSTAND.r50};
    /* Feste Zeilenhoehe: sonst hebt ein Zeichen in der Beschriftung die
       Zeilenbox an und der Knopf wuerde hoeher als sein Nachbar ohne
       Zeichen. So haben alle Knoepfe im Fliesstext dieselben Masse. */
    line-height: 1.25; }
  /* Das Zeichen bleibt innerhalb dieser Zeile: knapp unter die Grundlinie
     gesetzt, damit es sie oben nicht sprengt. */
  .zeilenknopf .navicon { vertical-align: -.1em; }

  /* Ein Knopf, der wie Beiwerk aussieht: er steht in der Beschriftungszeile
     neben dem Hinweis und soll sie nicht beherrschen -- deshalb der Ton der
     Zaehler, kein Kasten. */
  button.textknopf { display: inline; background: none; border: 0; box-shadow: none;
    padding: 0; margin-left: ${ABSTAND.r50}; transform: none;
    font: italic 400 ${GRAD.klein}/${ZEILE.satz} var(--sans); color: var(--rand);
    text-decoration: underline; text-underline-offset: .2em; cursor: pointer; }
  button.textknopf:hover { color: var(--tinte); box-shadow: none; transform: none; }

  .hinweis { padding: ${ABSTAND.r80} ${ABSTAND.r100}; margin: 0 0 ${ABSTAND.r150};
    background: var(--feld); border: ${STRICH.haar} solid var(--linie);
    border-left: ${STRICH.markant} solid var(--rand); border-radius: ${RADIUS.mittel}; }
  .hinweis p { margin: 0 0 ${ABSTAND.r50}; }
  .hinweis p:last-child { margin-bottom: 0; }

  /* Die Kennung ist das, wonach spaeter gesucht wird — also im Raster und fett. */
  .kennung { font: ${GEWICHT.fett} ${GRAD_EM.gehoben} var(--mono); letter-spacing: ${SPERRUNG.leicht}; }

  table { width: 100%; border-collapse: collapse; margin-top: ${ABSTAND.r100}; }
  /* Feste Aufteilung fuer die Auswertung: alle Spalten gleich breit,
     unabhaengig davon, wie lang die laengste Zelle gerade ist -- sonst
     wandern die Kanten mit dem Bestand. Verwaltungstabellen tragen dagegen
     einen Griff und eine Schaltflaeche, die nur so breit sein sollen wie
     noetig; dort bemisst der Browser die Spalten am Inhalt. */
  table.gleichspaltig { table-layout: fixed; }
  th { font: ${GRAD.grund}/${ZEILE.satz} var(--mono); letter-spacing: ${SPERRUNG.fein}; color: var(--tinte); }
  th, td { text-align: left; padding: ${ABSTAND.r35} ${ABSTAND.r50}; border-bottom: ${STRICH.haar} solid var(--linie);
    vertical-align: middle; }
  form.inline { display: inline; }
  /* Die Mailvorschau zeigt das fertige HTML der Mail in einem Rahmen; darueber
     stehen Empfaenger und Betreff wie im Kopf eines Mailprogramms. */
  .mailkopf { font: ${GRAD.normal}/${ZEILE.luftig} var(--mono); color: var(--tinte);
    border: ${STRICH.haar} solid var(--linie); border-bottom: none; padding: ${ABSTAND.r60} ${ABSTAND.r95};
    background: var(--feld); }
  .mailkopf .zaehler { display: inline; margin-right: ${ABSTAND.r50}; }
  /* Bilanz: Kennzahlen als Kaesten mit duenner Kante, keine Flaechen und
     keine Ampelfarben -- ein Wert ist ein Wert, kein Urteil (§2.2). */
  .eckdaten { display: grid; gap: ${ABSTAND.r100}; margin: 0 0 ${ABSTAND.r125};
    grid-template-columns: repeat(auto-fit, minmax(${MASS.kachel}, 1fr)); }
  .kennzahl { display: flex; flex-direction: column; gap: ${ABSTAND.r15};
    border: ${STRICH.haar} solid var(--linie); padding: ${ABSTAND.r80} ${ABSTAND.r95}; background: var(--feld); }
  .kennzahl-titel { font: ${GEWICHT.fett} ${GRAD.klein}/${ZEILE.satz} var(--mono); letter-spacing: ${SPERRUNG.weit};
    text-transform: uppercase; color: var(--rand); }
  .kennzahl-wert { font: ${GEWICHT.fett} ${GRAD.titel}/${ZEILE.titel} var(--mono); color: var(--tinte); }
  .kennzahl-wert.klein { font-size: ${GRAD.stark}; line-height: 1.4; }
  /* Fehlende Aussage sieht aus wie fehlende Aussage: leise, nicht als Null. */
  .kennzahl-leer { font: italic 400 ${GRAD.stark}/${ZEILE.satz} var(--sans); color: var(--rand); }
  .kennzahl-fuss { font: ${GRAD.winzig}/${ZEILE.satz} var(--mono); color: var(--tinte); }
  .kennzahl-erklaerung { font: italic 400 ${GRAD.klein}/${ZEILE.satz} var(--sans); color: var(--rand);
    margin-top: ${ABSTAND.r35}; }

  /* Waagerechte Balken: Name links, Spur, Zahl rechts auf fester Breite,
     damit die Ziffern untereinander stehen. */
  .verteilung { display: flex; flex-direction: column; gap: ${ABSTAND.r35}; margin-bottom: ${ABSTAND.r150}; }
  /* Summe vor der Spur, schlicht: der Blick liest Kategorie, Menge, Verteilung. */
  .balkenzeile { display: grid; grid-template-columns: minmax(${MASS.balkennameMin}, ${MASS.balkenname}) ${MASS.balkenmenge} 1fr;
    align-items: center; gap: ${ABSTAND.r70}; }
  .balkenname { font: ${GRAD.normal}/${ZEILE.satz} var(--sans); }
  /* Spur deutlich heller als das Linien-Grau: 60 % davon auf Papier. */
  /* 1.5-fache Hoehe (1.05 -> 1.58rem): die Segmente und ihre Beschriftung
     brauchen Luft, seit die Menge als Marke im Balken sitzt. */
  .balkenspur { display: block; height: ${MASS.balkenspur};
    background: color-mix(in srgb, var(--linie) ${ANTEIL.balkenspur}, var(--papier)); }
  .balkenfuellung { display: flex; height: 100%; background: var(--korrektur); }
  /* Medien-Segmente: von links nach rechts ansteigend heller (gemischt aus der
     Palette, keine eigenen Farbwerte), "uebrige" stets am hellsten. Dazwischen
     eine duenne Trennlinie in Papierweiss. */
  .balkenteil { display: flex; align-items: center; height: 100%; background: var(--korrektur);
    color: var(--papier); container-type: inline-size; overflow: hidden; }
  .balkenteil:nth-child(2) { background: color-mix(in srgb, var(--korrektur) ${ANTEIL.segmentZwei}, var(--papier)); }
  .balkenteil:nth-child(3) { background: color-mix(in srgb, var(--korrektur) ${ANTEIL.segmentDrei}, var(--papier)); }
  .balkenteil:nth-child(n + 4) { background: color-mix(in srgb, var(--korrektur) ${ANTEIL.segmentWeitere}, var(--papier)); }
  /* "uebrige" traegt keinen Namen — eine diagonale Schraffur genuegt. */
  /* Schraffur: 2px/2px im 150-Grad-Winkel, Karmin 50 % auf 25 %. */
  .balkenteil.uebrige { background: repeating-linear-gradient(150deg,
    color-mix(in srgb, var(--korrektur) ${ANTEIL.schraffurHell}, var(--papier)) 0 2px,
    color-mix(in srgb, var(--korrektur) ${ANTEIL.schraffurDunkel}, var(--papier)) 2px 4px); }
  .balkenteil + .balkenteil { border-left: ${STRICH.haar} solid var(--papier); }
  .balkenteilname { display: inline-flex; align-items: center; gap: ${ABSTAND.r35};
    font: ${GEWICHT.fett} ${GRAD.winzig}/${ZEILE.eng} var(--sans); padding: 0 ${ABSTAND.r35};
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  /* Die Menge des Mediums als Marke direkt rechts neben seinem Namen —
     rund bis zwei Stellen, darueber waechst sie zur Pille. */
  .teilzahl { display: inline-flex; align-items: center; justify-content: center;
    min-width: 1.05rem; height: 1.05rem; padding: 0 ${ABSTAND.r25}; border-radius: ${RADIUS.voll};
    background: color-mix(in srgb, var(--papier) ${ANTEIL.teilzahl}, transparent);
    color: var(--tinte); font-size: ${GRAD.winzig}; flex: none; }
  /* In zu schmalen Segmenten faellt der Name weg — der Tooltip bleibt. */
  @container (max-width: ${UMBRUCH.segmentEng}) { .balkenteilname { display: none; } }
  .balkenwert { font: ${GEWICHT.fett} ${GRAD.klein}/${ZEILE.satz} var(--mono); text-align: right; }

  /* Verlauf: senkrechte Balken auf gemeinsamer Grundlinie, seitlich
     scrollbar -- eine Zeitreihe waechst mit den Monaten. */
  .verlauf { display: flex; align-items: flex-end; gap: ${ABSTAND.r35}; height: ${MASS.verlaufhoehe};
    margin-bottom: ${ABSTAND.r150}; overflow-x: auto; padding-bottom: ${ABSTAND.r25}; }
  /* max-width, damit wenige Monate keine plakativen Bloecke werden. */
  .verlaufsspalte { display: flex; flex-direction: column; align-items: center;
    justify-content: flex-end; height: 100%; min-width: ${MASS.saeuleMin}; max-width: ${MASS.saeuleMax}; flex: 1; }
  .verlaufsbalken { display: block; width: 100%; background: var(--korrektur);
    min-height: 2px; }
  .verlaufswert { font: ${GEWICHT.fett} ${GRAD.klein}/${ZEILE.satz} var(--mono); color: var(--tinte); }
  .verlaufsmonat { font: ${GRAD.winzig}/${ZEILE.satz} var(--mono); color: var(--rand); margin-top: ${ABSTAND.r25};
    white-space: nowrap; }

  /* Toasts im Blattstil: Papier auf Korrekturrot, Schreibmaschine, keine
     Verlaeufe. Sie gleiten von oben herein und fahren denselben Weg
     zurueck — reine Bewegung, kein Ausblenden (Toastify nimmt vor dem
     Entfernen nur die on-Klasse, die Ruecktransition laeuft von selbst).
     Der Aus-Zustand liegt weit genug oben, dass er auch unterhalb des
     klebenden Kopfs startend aus dem Bild faehrt. */
  .toastify.hinweistoast { background: var(--korrektur); color: var(--papier);
    font: ${GEWICHT.fett} ${GRAD.grund}/${ZEILE.luftig} var(--mono); letter-spacing: ${SPERRUNG.leicht};
    border-radius: ${RADIUS.klein}; padding: ${ABSTAND.r60} ${ABSTAND.r100};
    box-shadow: ${SCHATTEN.toast} rgb(var(--schatten) / ${DECKKRAFT.toast});
    /* Ueber Kopf und Filterzeile geschichtet — nichts verdeckt ihn. Und
       kein Klickziel: was unter ihm liegt, bleibt sofort bedienbar. */
    z-index: ${EBENE.toast}; pointer-events: none; cursor: default;
    /* Die Ruheposition setzt das Skript als Variable; !important schlaegt
       Toastifys nachtraegliches Inline-top -- sonst springt die Einfahrt. */
    top: var(--toastruhe, 6rem) !important;
    /* Beide Richtungen als Keyframe-Animation, nicht als Transition: das
       reduced-motion-CSS unten schaltet Transitionen pauschal ab, und
       Toastify fuegt das Element ohnehin schon fertig eingeblendet ein.
       Die Ausfahrt ist die gespiegelte Einfahrt; das Skript setzt dafuer
       die ab-Klasse und entfernt den Toast erst nach der Animation. */
    opacity: 1; transform: translateY(-${MASS.toastweg}); }
  .toastify.hinweistoast.on {
    transform: translateY(0);
    animation: toasteinfahrt .4s ${KURVE.ein}; }
  .toastify.hinweistoast.ab {
    animation: toastausfahrt .4s ${KURVE.aus} forwards; }
  @keyframes toasteinfahrt {
    from { transform: translateY(-${MASS.toastweg}); }
    to { transform: translateY(0); }
  }
  @keyframes toastausfahrt {
    from { transform: translateY(0); }
    to { transform: translateY(-${MASS.toastweg}); }
  }

  /* Ganz unten, unter dem Blatt: ein leiser Hinweis auf die Herkunft. Er
     klebt nicht und draengt sich nicht vor -- eine Zeile im Ton eines
     Impressums, abgesetzt durch eine feine Linie. */

  /* Fixiert ist die Zeile fuer alle Seiten gleich (siehe oben). Hier steht
     nur, was sich unterscheidet: unten laeuft die Zeile ueber die volle
     Seitenbreite und traegt denselben Schatten wie der klebende Kopf, nur
     nach oben geworfen -- dieselbe Geometrie, dasselbe Grau
     (Entscheidung vom 13.8.2026). Die Trennlinie sitzt ohne Abstand am
     oberen Rand, dort, wo der Schatten ansetzt: sie ist die Grenze.
     Unter der Liste bleibt alles, wie es ist -- dort liegt ueber der
     Zeile die Blaetterreihe, und die waere der falsche Ort dafuer. */
  body:not(:has(.listenrumpf)) .fusszeile {
    left: 0; transform: none; width: 100%; max-width: none; padding: 0;
    animation: fussschatten linear both;
    animation-timeline: scroll(root);
    /* Voll, solange Inhalt hinter der Zeile liegt; verklingt auf den
       letzten 4rem und ist ganz unten aus. */
    animation-range: ${SCROLLWEG.fuss}; }
  /* In den Keyframes, nicht in der Regel: so bleibt der Schatten aus, wo
     die Seite gar nicht scrollt -- dann verdeckt die Zeile nichts. */
  @keyframes fussschatten {
    from { box-shadow: 0 ${SCHATTEN.schaleNah} rgb(var(--schatten) / ${DECKKRAFT.schale}); }
    to { box-shadow: 0 ${SCHATTEN.schaleFern} rgb(var(--schatten) / 0); }
  }
  /* Der Text haelt Abstand vom Rand, die Linie darueber nicht. Ueber und
     unter dem Text liegt derselbe Weissraum (.6rem): die Zeile sitzt in
     ihrem Streifen mittig, statt nach unten zu rutschen. */
  body:not(:has(.listenrumpf)) .fussinhalt {
    padding: ${ABSTAND.r50} ${ABSTAND.r125}; /* 9px */ }
  /* Der Inhalt endet ueber der festen Zeile, nicht darunter: etwas mehr
     als ihre Hoehe, damit die letzte Zeile frei steht. Unter der Liste
     besorgt das die gemessene Leistenhoehe am Blatt. */
  body:not(:has(.listenrumpf)) { padding-bottom: ${ABSTAND.r400}; }
  /* Der Strich sitzt am inneren Kasten, nicht am aeusseren: sonst liefe er
     um den Innenabstand des Blattes breiter als alles darueber. */
  /* Unter der Zeile bleibt nur ein schmaler Rand: die Seite soll dort enden,
     nicht ausklingen. */
  .fussinhalt { margin: 0; padding: ${ABSTAND.r100} 0 ${ABSTAND.r60};
    border-top: ${STRICH.kraeftig} solid var(--linie); text-align: center;
    font: ${GRAD.klein}/${ZEILE.luftig} var(--mono); letter-spacing: ${SPERRUNG.leicht};
    color: color-mix(in srgb, var(--rand) ${ANTEIL.fusszeile}, var(--tinte)); }
  /* Die Adresse ist der Zweck der Zeile: sie steht in Tinte und traegt den
     Rotstift-Unterstrich der uebrigen Verweise. */
  .fussinhalt a { color: var(--tinte); font-weight: ${GEWICHT.fett};
    text-decoration-color: color-mix(in srgb, var(--korrektur) ${ANTEIL.fussUnterstrich}, transparent);
    text-decoration-thickness: ${STRICH.haar}; text-underline-offset: .28em;
    transition: text-decoration-color ${DAUER.flink} ease, text-decoration-thickness ${DAUER.flink} ease; }
  /* In Ruhe nur angedeutet, beim Zeigen der volle Rotstift. */
  .fussinhalt a:hover, .fussinhalt a:focus-visible {
    text-decoration-color: var(--korrektur); text-decoration-thickness: ${STRICH.kraeftig}; }

  /* Fliesstext der Methodik schmal halten: lange Zeilen liest niemand. */
  .prosa-schmal { max-width: 40rem; }
  /* Unter der Bilanz laeuft der Vorbehalt zweispaltig wie das Blatt: drei
     kurze Absaetze nebeneinander lesen sich schneller als eine lange Fahne.
     Die Spalten duerfen dafuer weiter als die schmale Lesebreite reichen. */
  @media (min-width: ${UMBRUCH.schmal}) {
    .prosa-zweispaltig { max-width: none; columns: 2; column-gap: ${ABSTAND.r275};
      column-rule: 1px solid var(--linie); }
    /* Die Absaetze duerfen umbrechen wie im Blatt -- sonst faellt einer ganz
       in die linke Spalte und die Fahnen werden ungleich lang. */
    .prosa-zweispaltig p:first-child { margin-top: 0; }
  }
  .prosa-schmal p { margin: 0 0 ${ABSTAND.r80}; }

  /* Die Korrekturfahne zeigt den Wortunterschied der beiden Fassungen:
     Getilgtes durchgestrichen in Karmin, Eingefuegtes unterstrichen in Gruen.
     Beide tragen Strich und Farbe -- keines der Mittel steht allein. */
  .fahne { font: ${GRAD.grund}/${ZEILE.luftig} var(--mono); margin: 0 0 ${ABSTAND.r100}; }
  .fahne del { color: var(--korrektur); text-decoration: line-through;
    text-decoration-thickness: ${STRICH.kraeftig}; }
  .fahne ins { color: var(--vorschlag); text-decoration: underline;
    text-decoration-thickness: ${STRICH.kraeftig}; }
  .mailvorschau { border: ${STRICH.haar} solid var(--linie); margin: 0 0 ${ABSTAND.r150}; overflow-x: auto; }
  /* Die ganze Zeile ist das Klickziel -- beim Zeigen fuellt sie sich einen Hauch
     dunkler, nicht invers. Formulare und Griff sind davon ausgenommen. */
  tr[data-href] { cursor: pointer; }
  /* Objektnamen in den Zeilen: Schreibmaschine fett statt Unterstreichung --
     die ganze Zeile ist ohnehin das Klickziel, der Link braucht keine eigene
     Auszeichnung mehr. */
  td a { font: ${GEWICHT.fett} ${GRAD.normal}/${ZEILE.satz} var(--mono); letter-spacing: ${SPERRUNG.fein};
    color: var(--tinte); text-decoration: none; }
  tr[data-href]:hover td { background: color-mix(in oklab, var(--tinte) ${ANTEIL.zeileUnterZeiger}, var(--papier)); }
  /* Knoepfe in Tabellenzeilen sind Werkzeug, nicht Ziel der Seite: nuechtern,
     rechteckig, ueber die volle Zeilenhoehe -- der Rotstift kommt beim Zeigen.
     height:100% braucht die 1px-Hoehe an der Zelle, sonst loest es sich nicht auf. */
  /* Die Schaltflaeche steht am rechten Rand der Zeile, die Angaben links --
     dazwischen bleibt Luft, statt dass beides aneinanderklebt. */
  td.aktion, th.aktion { padding: 0 0 0 ${ABSTAND.r200}; width: 1%; height: 1px;
    text-align: right; }
  td.aktion form { display: block; height: 100%; }
  table button {
    display: flex; align-items: center; margin: 0; padding: 0 ${ABSTAND.r70}; min-height: 0;
    height: 100%; width: 100%;
    font: ${GRAD.klein}/${ZEILE.satz} var(--mono); letter-spacing: ${SPERRUNG.fein}; text-transform: none;
    background: transparent; color: var(--rand);
    border: none; border-left: ${STRICH.haar} solid var(--linie); border-radius: 0;
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
    border: none; border-left: ${STRICH.haar} solid var(--korrektur); border-radius: 0;
    transform: none; box-shadow: none;
  }
  /* Gezogen wird die ganze Zeile; das Zeichen davor zeigt es an. Sein
     Trennstrich bleibt aus, damit die Linie erst am Text beginnt. */
  tbody tr[draggable="true"] { cursor: grab; }
  tbody tr[draggable="true"] .griff { border-bottom-color: transparent; }
  tr.zieht { opacity: ${DECKKRAFT.gezogeneZeile}; }
  /* Einfuegemarke: eine karminrote Linie an der Kante, an der die gezogene
     Zeile beim Loslassen einsortiert wuerde. Als Innenschatten auf den Zellen,
     weil border-collapse Zeilenraender verschluckt. */
  tr.ziel-oben td { box-shadow: inset 0 2px 0 var(--korrektur); }
  tr.ziel-unten td { box-shadow: inset 0 -2px 0 var(--korrektur); }
  /* Das Ziehzeichen ist eine Einladung, kein Inhalt: in Ruhe zurueckgenommen,
     unter dem Zeiger in voller Farbe -- so tritt es erst hervor, wenn die
     Zeile gemeint ist. Groesser als der Text, damit es als Griff lesbar ist. */
  .griff { color: var(--rand); user-select: none; width: 2rem;
    font-size: ${GRAD.gross}; line-height: 1; text-align: center;
    opacity: ${DECKKRAFT.ziehgriff}; transition: opacity ${DAUER.flink} ease; }
  tbody tr:hover .griff, tbody tr:focus-within .griff { opacity: 1; }

  /* Sortierbare Spaltenkoepfe: der Pfeil steht erst da, wenn nach dieser
     Spalte sortiert wurde -- vorher zeigt nur der Zeiger, dass sich klicken
     lohnt. Ohne JavaScript bleibt die Serverreihenfolge (alphabetisch). */
  /* Bilanz-Medienliste: Namen und Zahlen fett (Wunsch vom 7.8.2026). */
  table.medienliste td { font-weight: ${GEWICHT.fett}; }
  /* Beschriftung und Pfeil auf einer Zeile: sonst bricht der Pfeil in
     schmalen Spalten um und hebt die Beschriftung eine halbe Zeile. */
  table.sortierbar th[role="button"] { cursor: pointer; user-select: none;
    white-space: nowrap; }
  table.sortierbar th[role="button"]:hover,
  table.sortierbar th[role="button"]:focus-visible { color: var(--korrektur); }
  /* Der Platz fuer den Pfeil steht von Anfang an: sonst wuerde die Spalte beim
     ersten Klick um seine Breite springen. Das leere Zeichen haelt ihn frei. */
  table.sortierbar th[role="button"]::after {
    content: "▲"; display: inline-block; width: 1em; margin-left: ${ABSTAND_EM.e20};
    font-size: ${GRAD_EM.pille}; visibility: hidden;
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
  @media (min-width: ${UMBRUCH.pille}) {
    .blatt, .kopfinhalt, .fusszeile { max-width: var(--mass); }
    /* Hauptspalte traegt Artikel und Korrektur, Nebenspalte die Einordnung.
       Die Aufteilung folgt der Arbeit, nicht dem verfuegbaren Platz. */
    .arbeitsflaeche { grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); gap: 0 ${ABSTAND.r225}; }
    /* Gleiche Feldhoehen in beiden Spalten: Beschriftungen und Abstaende sind
       ohnehin identisch, damit liegen die Zeilen exakt uebereinander. */
    #quoteBefore, #suggestionAfter, #comment { min-height: ${MASS.feldGross}; }
    /* Die Nebenspalte fuellt die Zeilenhoehe; der Knopf wird ans untere Ende
       geschoben und schliesst damit buendig mit dem letzten Textfeld links ab. */
    .nebenspalte { display: flex; flex-direction: column; }
    /* Der Knopf ist so hoch wie das Feld links daneben und schliesst unten
       buendig ab -- damit liegt auch die letzte Zeile in beiden Spalten
       exakt uebereinander. */
    .nebenspalte .abschluss { margin-top: auto; }
    .hauptspalte > .feld:last-child { margin-bottom: 0; }
    .nebenspalte .abschluss button { min-height: ${MASS.feldGross}; }
    /* Verwaltungsformulare (Zeilenraster): die Spalten-Wrapper loesen sich im
       Raster auf, jedes Feldpaar teilt sich eine echte Rasterzeile -- so
       stehen die Zeilen beider Spalten exakt nebeneinander, auch wenn rechts
       ein Hinweis umbricht oder ein Feld hoeher ist. */
    .zeilenraster .hauptspalte, .zeilenraster .nebenspalte { display: contents; }
    .zeilenraster { grid-auto-flow: row dense; align-items: start; }
    .zeilenraster .hauptspalte > .feld { grid-column: 1; }
    .zeilenraster .nebenspalte > .feld { grid-column: 2; }

    /* Das Erfassungsformular nutzt dieselbe Mechanik, nur mit fester
       Zuordnung: die Einordnung rechts sitzt neben dem, was sie einordnet --
       die Anmerkung neben der Fundstelle, der Abschluss neben der
       berichtigten Fassung. Die Zeile der Pruefung bleibt rechts frei,
       damit rechts keine Luecke im Lauf entsteht. */
    /* ACHTUNG: Die Zuordnung zaehlt Kinder. Die Hauptspalte muss genau fuenf
       haben (URL, Pruefblock, Ueberschrift, Fundstelle, Berichtigung), die
       Nebenspalte vier. Ein zusaetzliches Kind verschiebt alles und faellt
       am Ende aus der Zuordnung -- dann steht die Berichtigung oben. Neue
       Felder gehoeren in einen der vorhandenen Bloecke. */
    .erfassungsraster .hauptspalte, .erfassungsraster .nebenspalte { display: contents; }
    .erfassungsraster { align-items: start; }
    .erfassungsraster .hauptspalte > * { grid-column: 1; }
    .erfassungsraster .nebenspalte > * { grid-column: 2; }
    .erfassungsraster .hauptspalte > :nth-child(1) { grid-row: 1; }
    .erfassungsraster .hauptspalte > :nth-child(2) { grid-row: 2; }
    .erfassungsraster .hauptspalte > :nth-child(3) { grid-row: 3; }
    .erfassungsraster .hauptspalte > :nth-child(4) { grid-row: 4; }
    .erfassungsraster .hauptspalte > :nth-child(5) { grid-row: 5; }
    .erfassungsraster .nebenspalte > :nth-child(1) { grid-row: 1; }
    .erfassungsraster .nebenspalte > :nth-child(2) { grid-row: 3; }
    .erfassungsraster .nebenspalte > :nth-child(3) { grid-row: 4; }
    .erfassungsraster .nebenspalte > :nth-child(4) { grid-row: 5; }
    /* Im Raster braucht der Abschluss kein margin-top: auto mehr -- seine
       Zeile ist dieselbe wie die des letzten Textfeldes. Er fuellt sie ganz,
       damit beide Spalten unten buendig abschliessen. */
    .erfassungsraster .abschluss { margin-top: 0; align-self: stretch; }
    .erfassungsraster .abschluss button { height: 100%; }
  }

  /* Schmale Schirme: kompakter Kopf wie die mobile Ausgabe einer Zeitung --
     kleinerer Titel, das Datum rueckt unter den Untertitel, die Ressortleiste
     wird zur seitlich scrollbaren Zeile. */
  @media (max-width: ${UMBRUCH.telefon}) {
    .markenzeile { padding: ${ABSTAND.r100} 0 ${ABSTAND.r50}; }
    .marke { font-size: ${GRAD.gross}; }
    .untertitel { font-size: ${GRAD.winzig}; letter-spacing: ${SPERRUNG.weit}; }
    /* Nur am Telefon ersetzt "15. Aug." das lange Datum; die kleine Marke
       entfaellt. */
    .datum-lang { display: none; }
    .datum-kurz { display: block; }
    .datumszeile .kopfinhalt { justify-content: center; gap: ${ABSTAND.r70}; }
    .datum { position: static; transform: none; }
    .klebemarke { display: none; }
    /* Das ganze Band darf weichen, sobald gescrollt wird: der klebende Kopf
       nimmt auf kleinen Anzeigen sonst zu viel vom Blatt. Scroll-Zeitachse
       ohne Skript; wo der Browser sie nicht kennt, bleibt das Band stehen. */
    .datumszeile { overflow: hidden;
      animation: bandweicht linear both;
      animation-timeline: scroll(root);
      animation-range: ${SCROLLWEG.band}; }

    /* Die Ressorts bleiben eine Zeile; die Verwaltungspille rutscht darunter
       in eine eigene, zentrierte Reihe — statt die Zeile zu verlaengern. */
    nav { flex-wrap: wrap; justify-content: center; row-gap: ${ABSTAND.r10}; }
    nav a { white-space: nowrap; font-size: ${GRAD.klein}; padding: ${ABSTAND.r50} ${ABSTAND.r70} ${ABSTAND.r35}; }
    nav > a:first-child { margin-left: 0; }
    /* Die Hauptreihe weicht dem Aufklapper; die Verwaltungspille steht
       rechts daneben in derselben Zeile. */
    nav > a { display: none; }
    .navklapp { display: block; }
    nav { justify-content: center; gap: ${ABSTAND.r60}; align-items: center; }
    .randressorts { position: static; transform: none; margin: 0; align-self: center; }

    /* Am Telefon scrollt die Herkunftszeile mit dem Blatt statt fest zu
       stehen -- sie kostete sonst ein Zehntel der Hoehe. Unter der Liste
       bleibt sie Teil der festen Schale. */
    body:not(:has(.listenrumpf)) .fusszeile { position: static;
      animation: none; box-shadow: none; }
    body:not(:has(.listenrumpf)) { padding-bottom: ${ABSTAND.r50}; }

    /* Bilanz: die Namensspalte so schmal wie ihr laengster Eintrag, die
       Zahlen bekommen den Rest. table-Selektor, sonst gewinnt gleichspaltig. */
    table.medienliste { table-layout: auto; }
    .medienliste th:first-child, .medienliste td:first-child { width: 1%;
      white-space: nowrap; }

    /* Die Mailvorschau bringt eine feste Lesebreite mit (Outlook-Tabelle):
       schmal muss sie sich fuegen. Tabellen auf volle Breite zwingen, die
       grosszuegigen Mail-Innenabstaende kuerzen; bleibt doch etwas ueber,
       scrollt der Kasten selbst — abgeschnitten wird nichts. */
    .mailvorschau { overflow-x: auto; }
    .mailvorschau table { width: 100% !important; max-width: 100% !important; }
    .mailvorschau td { padding-left: ${ABSTAND.r35} !important; padding-right: ${ABSTAND.r35} !important; }
    .mailvorschau div { max-width: 100%; box-sizing: border-box; }
    /* Artikeladressen sind lang und kennen keine Trennstelle — ohne das
       hielten sie die Tabelle auf ihrer Mindestbreite. */
    .mailvorschau a, .mailvorschau p, .mailvorschau div { overflow-wrap: anywhere; }
    .mailkopf { font-size: ${GRAD.winzig}; word-break: break-word; }

    /* Schriftstaffel fuers Telefon: Fliesstext bleibt bei 16 px (darunter
       zoomen Browser beim Tippen in Felder), alles Ausgezeichnete rueckt
       eine Stufe herunter — die Verhaeltnisse bleiben, die Seite wird
       ruhiger und nichts bricht mehr unschoen um. */
    h1 { font-size: ${GRAD.stark}; margin-bottom: ${ABSTAND.r100}; }
    h2 { font-size: ${GRAD.grund}; }
    h2.rubrik { font-size: ${GRAD.grund}; margin-top: ${ABSTAND.r200}; }
    .prosa .einstieg { font-size: ${GRAD.grund}; }
    button, a.knopf { font-size: ${GRAD.normal}; padding: ${ABSTAND.r70} ${ABSTAND.r60} ${ABSTAND.r60} ${ABSTAND.r95}; }
    .kennzahl-wert { font-size: ${GRAD.gross}; }
    .kennzahl-wert.klein { font-size: ${GRAD.grund}; }
    .balkenname { font-size: ${GRAD.klein}; }
    .balkenwert { font-size: ${GRAD.winzig}; }
    .balkenteilname { font-size: ${GRAD.winzig}; }
    /* Untergrenze 11px: darunter wird die Schreibmaschine unleserlich. */
    .teilzahl { min-width: .95rem; height: .95rem; font-size: ${GRAD.winzig}; }
    .zaehlweise { font-size: ${GRAD.winzig}; }
    .verlaufsmonat, .verlaufswert { font-size: ${GRAD.winzig}; }
    .trefferWechsel { font-size: ${GRAD.winzig}; }
    .trefferSatz { font-size: ${GRAD.klein}; }
  }

  @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
`;

export type Bereich =
  | "neu"
  | "redaktionen"
  | "fehlerarten"
  | "meldungen"
  | "abgleich"
  | "bilanz"
  | "backfill"
  | "ueber";

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
  meldungen: "Meldungen",
  abgleich: "Ausgang abgleichen",
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

/** Kurzfassung fuer schmale Anzeigen: "15. Aug." */
function datumKurz(): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "numeric",
    month: "short",
  }).format(new Date());
}

/* Font Awesome Free 6.7.2 by @fontawesome - https://fontawesome.com
   License - https://fontawesome.com/license/free (Icons: CC BY 4.0)
   Copyright 2024 Fonticons, Inc. — Pfade byteidentisch aus svgs/solid/
   uebernommen (solid/file-pen.svg, solid/envelope-open-text.svg,
   solid/paste.svg, solid/newspaper.svg, solid/tag.svg, brands/apple.svg),
   als inline SVG statt Webfont (Projektregel: keine Webfonts). */
export const FilePenIcon: FC = () => (
  <svg class="navicon" viewBox="0 0 576 512" aria-hidden="true">
    <path fill="currentColor" d="M0 64C0 28.7 28.7 0 64 0L224 0l0 128c0 17.7 14.3 32 32 32l128 0 0 125.7-86.8 86.8c-10.3 10.3-17.5 23.1-21 37.2l-18.7 74.9c-2.3 9.2-1.8 18.8 1.3 27.5L64 512c-35.3 0-64-28.7-64-64L0 64zm384 64l-128 0L256 0 384 128zM549.8 235.7l14.4 14.4c15.6 15.6 15.6 40.9 0 56.6l-29.4 29.4-71-71 29.4-29.4c15.6-15.6 40.9-15.6 56.6 0zM311.9 417L441.1 287.8l71 71L382.9 487.9c-4.1 4.1-9.2 7-14.9 8.4l-60.1 15c-5.5 1.4-11.2-.2-15.2-4.2s-5.6-9.7-4.2-15.2l15-60.1c1.4-5.6 4.3-10.8 8.4-14.9z" />
  </svg>
);
export const AppleIcon: FC = () => (
  <svg class="navicon schmal" viewBox="0 0 384 512" aria-hidden="true">
    <path fill="currentColor" d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
  </svg>
);
export const PasteIcon: FC = () => (
  <svg class="navicon" viewBox="0 0 512 512" aria-hidden="true">
    <path fill="currentColor" d="M160 0c-23.7 0-44.4 12.9-55.4 32L48 32C21.5 32 0 53.5 0 80L0 400c0 26.5 21.5 48 48 48l144 0 0-272c0-44.2 35.8-80 80-80l48 0 0-16c0-26.5-21.5-48-48-48l-56.6 0C204.4 12.9 183.7 0 160 0zM272 128c-26.5 0-48 21.5-48 48l0 272 0 16c0 26.5 21.5 48 48 48l192 0c26.5 0 48-21.5 48-48l0-220.1c0-12.7-5.1-24.9-14.1-33.9l-67.9-67.9c-9-9-21.2-14.1-33.9-14.1L320 128l-48 0zM160 40a24 24 0 1 1 0 48 24 24 0 1 1 0-48z" />
  </svg>
);
export const EnvelopeOpenTextIcon: FC = () => (
  <svg class="navicon" viewBox="0 0 512 512" aria-hidden="true">
    <path fill="currentColor" d="M215.4 96L144 96l-36.2 0L96 96l0 8.8L96 144l0 40.4 0 89L.2 202.5c1.6-18.1 10.9-34.9 25.7-45.8L48 140.3 48 96c0-26.5 21.5-48 48-48l76.6 0 49.9-36.9C232.2 3.9 243.9 0 256 0s23.8 3.9 33.5 11L339.4 48 416 48c26.5 0 48 21.5 48 48l0 44.3 22.1 16.4c14.8 10.9 24.1 27.7 25.7 45.8L416 273.4l0-89 0-40.4 0-39.2 0-8.8-11.8 0L368 96l-71.4 0-81.3 0zM0 448L0 242.1 217.6 403.3c11.1 8.2 24.6 12.7 38.4 12.7s27.3-4.4 38.4-12.7L512 242.1 512 448s0 0 0 0c0 35.3-28.7 64-64 64L64 512c-35.3 0-64-28.7-64-64c0 0 0 0 0 0zM176 160l160 0c8.8 0 16 7.2 16 16s-7.2 16-16 16l-160 0c-8.8 0-16-7.2-16-16s7.2-16 16-16zm0 64l160 0c8.8 0 16 7.2 16 16s-7.2 16-16 16l-160 0c-8.8 0-16-7.2-16-16s7.2-16 16-16z" />
  </svg>
);

export const NewspaperIcon: FC = () => (
  <svg class="navicon" viewBox="0 0 512 512" aria-hidden="true">
    <path fill="currentColor" d="M96 96c0-35.3 28.7-64 64-64l288 0c35.3 0 64 28.7 64 64l0 320c0 35.3-28.7 64-64 64L80 480c-44.2 0-80-35.8-80-80L0 128c0-17.7 14.3-32 32-32s32 14.3 32 32l0 272c0 8.8 7.2 16 16 16s16-7.2 16-16L96 96zm64 24l0 80c0 13.3 10.7 24 24 24l112 0c13.3 0 24-10.7 24-24l0-80c0-13.3-10.7-24-24-24L184 96c-13.3 0-24 10.7-24 24zm208-8c0 8.8 7.2 16 16 16l48 0c8.8 0 16-7.2 16-16s-7.2-16-16-16l-48 0c-8.8 0-16 7.2-16 16zm0 96c0 8.8 7.2 16 16 16l48 0c8.8 0 16-7.2 16-16s-7.2-16-16-16l-48 0c-8.8 0-16 7.2-16 16zM160 304c0 8.8 7.2 16 16 16l256 0c8.8 0 16-7.2 16-16s-7.2-16-16-16l-256 0c-8.8 0-16 7.2-16 16zm0 96c0 8.8 7.2 16 16 16l256 0c8.8 0 16-7.2 16-16s-7.2-16-16-16l-256 0c-8.8 0-16 7.2-16 16z" />
  </svg>
);
export const TagIcon: FC = () => (
  <svg class="navicon" viewBox="0 0 448 512" aria-hidden="true">
    <path fill="currentColor" d="M0 80L0 229.5c0 17 6.7 33.3 18.7 45.3l176 176c25 25 65.5 25 90.5 0L418.7 317.3c25-25 25-65.5 0-90.5l-176-176c-12-12-28.3-18.7-45.3-18.7L48 32C21.5 32 0 53.5 0 80zm112 32a32 32 0 1 1 0 64 32 32 0 1 1 0-64z" />
  </svg>
);
export const CopyIcon: FC = () => (
  <svg class="navicon" viewBox="0 0 448 512" aria-hidden="true">
    <path fill="currentColor" d="M208 0L332.1 0c12.7 0 24.9 5.1 33.9 14.1l67.9 67.9c9 9 14.1 21.2 14.1 33.9L448 336c0 26.5-21.5 48-48 48l-192 0c-26.5 0-48-21.5-48-48l0-288c0-26.5 21.5-48 48-48zM48 128l80 0 0 64-64 0 0 256 192 0 0-32 64 0 0 48c0 26.5-21.5 48-48 48L48 512c-26.5 0-48-21.5-48-48L0 176c0-26.5 21.5-48 48-48z" />
  </svg>
);
/* Traegt selbst den Hinweis: das Zeichen ist der Anker, der Text steht im
   data-Attribut und erscheint beim Zeigen wie beim Tastatur-Fokus. */
export const InfoIcon: FC = () => (
  <svg class="navicon" viewBox="0 0 512 512" aria-hidden="true">
    <path fill="currentColor" d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM216 336l24 0 0-64-24 0c-13.3 0-24-10.7-24-24s10.7-24 24-24l48 0c13.3 0 24 10.7 24 24l0 88 8 0c13.3 0 24 10.7 24 24s-10.7 24-24 24l-80 0c-13.3 0-24-10.7-24-24s10.7-24 24-24zm40-208a32 32 0 1 1 0 64 32 32 0 1 1 0-64z" />
  </svg>
);

export const Layout: FC<
  PropsWithChildren<{ title: string; aktiv?: Bereich | undefined; betreiber?: boolean }>
> = ({
  title,
  aktiv,
  betreiber = false,
  children,
}) => {
  const ohneTitel = aktiv !== undefined && BEREICH_TITEL[aktiv] === title;
  return (
  <>
  {/* Ohne DOCTYPE laufen alle Seiten im Quirks-Modus: dann scrollt der
      body statt des Wurzelelements, und scroll(root) -- die Zeitachse der
      beiden Schatten -- hat keine Strecke. Er steht hier einmal, damit ihn
      keine Ansicht vergessen kann. */}
  {raw("<!DOCTYPE html>")}
  <html lang="de">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="robots" content="noindex" />
      <title>{title}</title>
      {/* Icons und Manifest: siehe routes/icons.ts. Das SVG kommt zuerst,
          Browser die es koennen nehmen es; die .ico bleibt fuer die uebrigen. */}
      <link rel="icon" href="/icon.svg" type="image/svg+xml" />
      <link rel="icon" href="/favicon.ico" sizes="32x32" />
      <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      <link rel="manifest" href="/site.webmanifest" />
      {/* Die Browserleiste nimmt die Farbe des Blattes an, in beiden Modi. */}
      <meta name="theme-color" media="(prefers-color-scheme: light)" content={PALETTE.papier} />
      <meta
        name="theme-color"
        media="(prefers-color-scheme: dark)"
        content={PALETTE_DUNKEL.papier}
      />
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-title" content="Korrekturen" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <style dangerouslySetInnerHTML={{ __html: TOASTIFY_CSS }} />
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
            <a class="klebemarke" href="/" aria-label="Korrekturen" draggable={false}>
              Korrektu<span class="tilgung">h</span>ren
            </a>
            <span class="untertitel">
              Blatt zur Textpflege<span class="untertiteltrenner"> • </span>
              <span class="untertitelrest">Unabhängig • Überparteilich</span>
            </span>
            <span class="datum datum-lang">{datumszeile()}</span>
            <span class="datum datum-kurz" title={datumszeile()}>{datumKurz()}</span>
          </div>
        </div>
        <div class="navzeile">
          <div class="kopfinhalt">
            <nav>
            {/* Schmal ersetzt ein Aufklapper die Hauptreihe: oben steht der
                aktive Bereich (im Rot der aktiven Marke), darunter klappen
                die uebrigen aus. details/summary -- kein Skript, schliesst
                sich durch die Navigation von selbst. Breit: unsichtbar. */}
            <details class="navklapp">
              <summary>
                {aktiv ? BEREICH_TITEL[aktiv] : "Menü"}
                <span class="klapppfeil" aria-hidden="true">▾</span>
              </summary>
              <div class="klappliste">
                {(
                  [
                    { key: "neu", href: betreiber ? "/neu" : "/hinweis" },
                    { key: "bilanz", href: "/bilanz" },
                    ...(betreiber ? ([{ key: "meldungen", href: "/admin/meldungen" }] as const) : []),
                    { key: "ueber", href: "/" },
                  ] as const
                )
                  .filter((ziel) => ziel.key !== aktiv)
                  .map((ziel) => (
                    <a href={ziel.href} draggable={false}>
                      {BEREICH_TITEL[ziel.key]}
                    </a>
                  ))}
              </div>
            </details>
            {betreiber ? (
              <a href="/neu" aria-current={aktiv === "neu" ? "page" : undefined} draggable={false}>
                Neue Korrektur
              </a>
            ) : (
              <a href="/hinweis" aria-current={aktiv === "neu" ? "page" : undefined} draggable={false}>
                Neue Korrektur
              </a>
            )}
            {/* Meldungen vor Bilanz: erst die einzelnen Faelle, dann die
                Zusammenfassung (Entscheidung vom 13.8.2026). */}
            {betreiber ? (
              <a href="/admin/meldungen" aria-current={aktiv === "meldungen" ? "page" : undefined} draggable={false}>
                Meldungen
              </a>
            ) : null}
            <a href="/bilanz" aria-current={aktiv === "bilanz" ? "page" : undefined} draggable={false}>
              Bilanz
            </a>
            <a href="/" aria-current={aktiv === "ueber" ? "page" : undefined} draggable={false}>
              In eigener Sache
            </a>
            {/* Verwaltungsressorts: rechtsbuendig am Rand der Inhaltsspalte,
                Hover nur im Grau der Zwischenueberschriften. */}
            <span class="randressorts">
              <a href="/admin/redaktionen" aria-label="Medien" aria-current={aktiv === "redaktionen" ? "page" : undefined} draggable={false}>
                <NewspaperIcon />
                <span class="ressorttext">Medien</span>
              </a>
              <a href="/admin/fehlerarten" aria-label="Kategorien" aria-current={aktiv === "fehlerarten" ? "page" : undefined} draggable={false}>
                <TagIcon />
                <span class="ressorttext">Kategorien</span>
              </a>
              <a href="/admin/abgleich" aria-label="Ausgang abgleichen" aria-current={aktiv === "abgleich" ? "page" : undefined} draggable={false}>
                <FilePenIcon />
                <span class="ressorttext">Abgleich</span>
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
      <footer class="fusszeile">
        <p class="fussinhalt">
          Textkorrekturen melden und tracken — Quelltext auf{" "}
          <a href="https://github.com/01msmr/corrections" target="_blank" rel="noopener">
            github.com/01msmr/corrections
          </a>
        </p>
      </footer>
      <script dangerouslySetInnerHTML={{ __html: TOASTIFY_JS }} />
      <script
        dangerouslySetInnerHTML={{
          __html: `
  /* Der Service Worker macht die Seite installierbar; er faengt nur die
     Navigation ohne Netz ab (siehe routes/icons.ts). Scheitert die
     Registrierung, aendert sich an der Seite nichts. */
  if ("serviceWorker" in navigator) {
    addEventListener("load", () => { navigator.serviceWorker.register("/sw.js").catch(() => {}); });
  }

  /* Umschalter, die nur einen Seitenteil betreffen (Zaehlweise der Bilanz):
     Der Inhalt wird nachgeladen und an Ort und Stelle ersetzt, statt die
     Seite neu zu laden — sonst spraenge der Blick bei jedem Umschalten
     zurueck an den Seitenanfang. Ohne JavaScript bleibt der Link ein
     gewoehnlicher Link und funktioniert unveraendert. */
  const teilTausch = (wurzel) => {
    for (const link of wurzel.querySelectorAll("a[data-teil]")) {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const stand = window.scrollY;
        fetch(link.href, { headers: { accept: "text/html" } })
          .then((res) => (res.ok ? res.text() : null))
          .then((html) => {
            if (!html) { location.href = link.href; return; }
            const neu = new DOMParser().parseFromString(html, "text/html").querySelector(".blatt");
            const alt = document.querySelector(".blatt");
            if (!neu || !alt) { location.href = link.href; return; }
            alt.replaceWith(neu);
            history.replaceState(null, "", link.href);
            window.scrollTo({ top: stand });
            teilTausch(neu);
            tabellenSortierbar(neu);
          })
          .catch(() => { location.href = link.href; });
      });
    }
  };
  teilTausch(document);

  for (const zeile of document.querySelectorAll("tr[data-href]")) {
    zeile.addEventListener("click", (e) => {
      if (e.target.closest("a, button, form, .griff")) return;
      location.href = zeile.dataset.href;
    });
  }

  /* Erfolgs-Hinweise laufen als Toast (Toastify, 5s) statt als Kasten im
     Blatt; die Adresse wird gleich vom Hinweis-Parameter befreit, damit
     Neuladen ihn nicht wiederholt. Ohne Skript bleibt der Kasten stehen. */
  /* Der Ruheplatz liegt unter Titel und Navigation, nicht darueber. */
  const kopf = document.querySelector(".klebekopf");
  const kopfKante = kopf ? Math.round(kopf.getBoundingClientRect().bottom) + 10 : 16;
  document.documentElement.style.setProperty("--toastruhe", kopfKante + "px");
  for (const kasten of document.querySelectorAll(".hinweis.fluechtig")) {
    /* duration 0: Toastify raeumt nicht selbst ab -- erst faehrt die
       Ausfahrt-Animation (ab-Klasse), dann entfernt hideToast den Toast. */
    const toast = Toastify({
      text: kasten.textContent.trim(),
      duration: 0,
      gravity: "top",
      position: "center",
      className: "hinweistoast",
      stopOnFocus: false,
    });
    toast.showToast();
    const el = toast.toastElement;
    setTimeout(() => {
      el.classList.add("ab");
      setTimeout(() => toast.hideToast(), 400);
    }, 3000);
    kasten.remove();
  }
  if (document.querySelector(".hinweis.fluechtig") || location.search.includes("hinweis=")) {
    const adresse = new URL(location.href);
    adresse.searchParams.delete("hinweis");
    adresse.searchParams.delete("gesetzt");
    history.replaceState(null, "", adresse);
  }

  /* Gekappte Erlaeuterungen (schmal): Antippen klappt auf und zu. */
  for (const text of document.querySelectorAll("p.zaehler, .kennzahl-erklaerung")) {
    text.addEventListener("click", () => {
      if (text.classList.contains("offen") || text.scrollHeight > text.clientHeight + 1) {
        text.classList.toggle("offen");
      }
    });
  }

  /* Sortieren im Browser: die Serverantwort bleibt alphabetisch, umsortiert
     wird nur die Ansicht. Zahlenspalten numerisch, Text nach deutscher
     Sortierfolge; leere Zellen und Aktionsspalten bleiben aussen vor. */
  function tabellenSortierbar(wurzel) {
  for (const tabelle of wurzel.querySelectorAll("table.sortierbar")) {
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
  }
  }
  tabellenSortierbar(document);`,
        }}
      />
    </body>
  </html>
  </>
  );
};
