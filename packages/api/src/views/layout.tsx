import type { FC, PropsWithChildren } from "hono/jsx";

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
    --papier: #f7f7f4;
    --tinte: #1b1f23;
    --korrektur: #d0342c;
    --vorschlag: #2f6f4e;
    --rand: #6b7480;
    --linie: #dcddd8;
    --feld: #fffffe;
    --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
    --sans: system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --papier: #16181b; --tinte: #e8e6e1; --korrektur: #f2756b; --vorschlag: #7bc39a;
      --rand: #949ba6; --linie: #2e3237; --feld: #1d2024;
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

  /* Die Kopfzeile bleibt stehen, damit die Navigation auf langen Seiten
     erreichbar bleibt. Der Schatten kommt erst, wenn wirklich etwas darunter
     liegt — ueber eine Scroll-Zeitachse, also ohne Skript. Wo der Browser sie
     nicht kennt, bleibt die Kopfzeile klebend und einfach ohne Schatten. */
  header {
    position: sticky; top: 0; z-index: 5;
    padding: 1.5rem 0 .75rem; margin-bottom: 2.25rem;
    background: var(--papier);
    border-bottom: 1px solid var(--linie);
    animation: kopfschatten linear both;
    animation-timeline: scroll(root);
    animation-range: 0 3rem;
  }
  @keyframes kopfschatten {
    from { box-shadow: 0 4px 12px -10px rgba(0, 0, 0, 0); }
    to { box-shadow: 0 4px 14px -8px rgba(0, 0, 0, .3); }
  }
  .kopfinhalt {
    display: flex; flex-wrap: wrap; gap: .75rem 1.5rem;
    align-items: baseline; justify-content: space-between;
  }
  .marke { font: 700 1.35rem/1 var(--mono); letter-spacing: .08em; text-transform: uppercase;
    color: inherit; text-decoration: none; }
  .marke:hover, .marke:focus-visible { color: var(--korrektur); }
  /* Der Wortmarke ist ein Fehler eingebaut, der zugleich getilgt wird: man liest
     „Korrekturen“ und sieht dabei, was die Anwendung tut. Fuer Vorlesesoftware
     traegt das aria-label am Link den richtigen Namen. */
  /* Der Buchstabe bleibt Text in Tinte -- rot ist nur der Strich, so wie auf
     Papier: der Fehler ist gesetzt, die Korrektur kommt von Hand dazu. */
  .marke .tilgung { position: relative; display: inline-block; color: var(--tinte); }
  /* Kein text-decoration und kein gerader Balken: ein Filzstiftstrich ist leicht
     gebogen, laeuft ueber den Buchstaben hinaus und wird zum Ende hin flacher.
     Deshalb eine gezeichnete Kurve als Data-URI statt einer gedrehten Linie. */
  .marke .tilgung::after {
    content: ""; position: absolute;
    left: -.4em; right: -.4em; top: -.15em; bottom: -.15em;
    background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='46' height='26' viewBox='0 0 46 26' preserveAspectRatio='none'%3E%3Cpath d='M2.4 20.6C13.2 16.4 26.4 10.2 41.8 3.2c1.1-.5 1.9.6 1 1.3-2 1.5-4.6 3-8 4.8C25.6 14.4 13.4 20.4 4.4 24c-1.3.5-2.6-1.6-2-3.4z' fill='%23d0342c'/%3E%3C/svg%3E") center / 100% 100% no-repeat;
  }
  nav { display: flex; gap: 1.25rem; flex-wrap: wrap; }
  nav a { font: .85rem/1 var(--mono); letter-spacing: .02em;
    color: var(--rand); text-decoration: none; padding-bottom: .15rem;
    border-bottom: 1px solid transparent; }
  nav a:hover, nav a:focus-visible { color: var(--tinte); border-bottom-color: var(--korrektur); }
  /* Die aktuelle Seite wird nicht durchgestrichen -- das hiesse "streichen".
     Im Korrektorat bedeutet die punktierte Unterlaengung "stet": bleibt stehen.
     Genau das trifft zu, und es bleibt leise. */
  nav a[aria-current="page"] {
    color: var(--tinte);
    border-bottom-style: dotted; border-bottom-width: 2px;
    border-bottom-color: var(--korrektur);
  }

  h1 { font: 600 1.75rem/1.25 var(--sans); margin: 0 0 2rem; letter-spacing: -.01em; }
  h2 { font: .85rem/1.3 var(--mono); letter-spacing: .02em;
    color: var(--rand); margin: 2.5rem 0 .75rem; }
  a { color: inherit; text-underline-offset: .2em; }

  /* Das Korrekturzeichen sitzt unmittelbar vor der Beschriftung, nicht in einer
     eigenen Randspalte: es gehoert zu dem, was darunter zu tun ist. */
  /* Emoji: sie bringen ihre Farbe selbst mit, deshalb hier weder color noch
     Schriftwahl. Auf Apple-Systemen ist das rote Kreuz kraeftig, der Haken
     dunkel und handgezeichnet, der Bleistift gelb. */
  .zeichen { font-size: 1.15em; line-height: 0; margin-right: .35em;
    vertical-align: -.12em; }
  .zeichen-falsch::before { content: "❌"; }
  .zeichen-richtig::before { content: "✔️"; }
  .zeichen-notiz::before { content: "✏️"; }

  /* Beschriftungen im selben Stil wie die Navigation: dicktengleich, ohne
     Versalien, im Randton. Beides ist Auszeichnungsebene, nicht Inhalt --
     dass sie gleich aussieht, macht das sichtbar. */
  label { display: flex; flex-wrap: wrap; align-items: baseline;
    justify-content: space-between; gap: .2rem 1rem; margin: 0 0 .4rem;
    font: .85rem/1.3 var(--mono); letter-spacing: .02em; color: var(--rand); }
  .feld { margin-bottom: 1.5rem; }
  input, textarea, select {
    width: 100%; padding: .55rem .65rem; font: inherit;
    background: var(--feld); color: inherit;
    border: 1px solid var(--linie); border-radius: 2px;
  }

  .arbeitsflaeche { display: grid; }
  .abschluss { padding-top: 1.25rem; }
  .abschluss .feld { margin-bottom: 0; }
  .abschluss button { width: 100%; margin-top: 0; min-height: 3.6rem; }
  /* Zitat und Vorschlag im festen Raster: ein Leerzeichen zu viel oder ein
     Buchstabendreher ist nur so zu sehen. */
  #quoteBefore, #suggestionAfter { font: .95rem/1.6 var(--mono); min-height: 5.5rem; }
  #quoteBefore { border-left: 5px solid var(--korrektur); }
  #suggestionAfter { border-left: 5px solid var(--vorschlag); }
  textarea { min-height: 4.5rem; resize: vertical; }

  /* Der Systempfeil ist auf jeder Plattform eine andere Form und passt zu keiner.
     Stattdessen derselbe Winkel wie das Einfuegezeichen am Rand, nur nach unten
     gedreht und mit runden Enden -- gezeichnet als Data-URI, damit nichts
     nachgeladen wird. */
  select {
    -webkit-appearance: none; appearance: none; padding-right: 2.2rem;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='13' height='9' viewBox='0 0 13 9'%3E%3Cpath d='M1.6 1.7 6.5 6.8l4.9-5.1' fill='none' stroke='%236b7480' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right .8rem center;
    background-size: .8rem auto;
  }
  select:hover, select:focus-visible {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='13' height='9' viewBox='0 0 13 9'%3E%3Cpath d='M1.6 1.7 6.5 6.8l4.9-5.1' fill='none' stroke='%23d0342c' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  }
  optgroup { font: 600 .75rem var(--mono); letter-spacing: .06em; color: var(--rand); }
  optgroup option { font: 400 1rem var(--sans); letter-spacing: 0; color: var(--tinte); }
  :focus-visible { outline: 2px solid var(--korrektur); outline-offset: 1px; }


  .zaehler { font: 400 .72rem/1.4 var(--sans); letter-spacing: 0;
    text-transform: none; color: var(--rand); }

  button {
    margin-top: .5rem; padding: .6rem 1.4rem; cursor: pointer;
    font: 600 1.125rem/1 var(--mono); letter-spacing: .1em; text-transform: uppercase;
    background: var(--tinte); color: var(--papier);
    border: 1px solid var(--tinte); border-radius: 2px;
  }
  button:hover { background: var(--korrektur); border-color: var(--korrektur); }

  .hinweis { padding: .85rem 1rem; margin: 0 0 1.5rem;
    background: var(--feld); border: 1px solid var(--linie);
    border-left: 5px solid var(--rand); border-radius: 2px; }
  .hinweis p { margin: 0 0 .5rem; }
  .hinweis p:last-child { margin-bottom: 0; }

  /* Die Kennung ist das, wonach spaeter gesucht wird — also im Raster und fett. */
  .kennung { font: 600 1.05em var(--mono); letter-spacing: .06em; }

  table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
  th { font: .85rem/1.3 var(--mono); letter-spacing: .02em; color: var(--rand); }
  th, td { text-align: left; padding: .55rem .5rem; border-bottom: 1px solid var(--linie);
    vertical-align: top; }
  form.inline { display: inline; }

  @media (prefers-color-scheme: dark) {
    select {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='13' height='9' viewBox='0 0 13 9'%3E%3Cpath d='M1.6 1.7 6.5 6.8l4.9-5.1' fill='none' stroke='%23949ba6' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
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

  @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
`;

export type Bereich = "neu" | "redaktionen" | "fehlerarten";

export const Layout: FC<PropsWithChildren<{ title: string; aktiv?: Bereich | undefined }>> = ({
  title,
  aktiv,
  children,
}) => (
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
        <div class="kopfinhalt">
          <a class="marke" href="/neu" aria-label="Korrekturen">
            Korrektu<span class="tilgung">h</span>ren
          </a>
          <nav>
            <a href="/neu" aria-current={aktiv === "neu" ? "page" : undefined}>
              Neuer Hinweis
            </a>
            <a href="/admin/redaktionen" aria-current={aktiv === "redaktionen" ? "page" : undefined}>
              Redaktionen
            </a>
            <a href="/admin/fehlerarten" aria-current={aktiv === "fehlerarten" ? "page" : undefined}>
              Fehlerarten
            </a>
          </nav>
        </div>
      </header>
      <div class="blatt">
        <h1>{title}</h1>
        {children}
      </div>
    </body>
  </html>
);
