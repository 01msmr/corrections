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
    margin: 0; padding: 2rem 1.25rem 4rem;
    background: var(--papier); color: var(--tinte);
    font: 16px/1.6 var(--sans);
  }
  .blatt { max-width: 44rem; margin: 0 auto; }

  header {
    display: flex; flex-wrap: wrap; gap: .75rem 1.5rem;
    align-items: baseline; justify-content: space-between;
    padding-bottom: .75rem; margin-bottom: 2.25rem;
    border-bottom: 1px solid var(--linie);
  }
  .marke { font: 700 1.05rem/1 var(--mono); letter-spacing: .12em; text-transform: uppercase;
    color: inherit; text-decoration: none; }
  .marke:hover, .marke:focus-visible { color: var(--korrektur); }
  /* Der Wortmarke ist ein Fehler eingebaut, der zugleich getilgt wird: man liest
     „Korrekturen“ und sieht dabei, was die Anwendung tut. Fuer Vorlesesoftware
     traegt das aria-label am Link den richtigen Namen. */
  .marke .tilgung { position: relative; display: inline-block; color: var(--korrektur); }
  /* Kein text-decoration: der Strich soll nach Filzstift aussehen, also leicht
     schraeg und ueber den Buchstaben hinauslaufend, nicht nach Satzprogramm. */
  .marke .tilgung::after {
    content: ""; position: absolute; left: -.22em; right: -.22em; top: 50%;
    height: .15em; border-radius: .08em; background: var(--korrektur);
    transform: rotate(-7deg); transform-origin: center; opacity: .92;
  }
  nav { display: flex; gap: 1.25rem; flex-wrap: wrap; }
  nav a { font: .85rem/1 var(--mono); letter-spacing: .02em;
    color: var(--rand); text-decoration: none; padding-bottom: .15rem;
    border-bottom: 1px solid transparent; }
  nav a:hover, nav a:focus-visible { color: var(--tinte); border-bottom-color: var(--korrektur); }

  h1 { font: 600 1.75rem/1.25 var(--sans); margin: 0 0 2rem; letter-spacing: -.01em; }
  h2 { font: 600 .75rem/1 var(--mono); letter-spacing: .16em; text-transform: uppercase;
    color: var(--rand); margin: 2.5rem 0 .75rem; }
  a { color: inherit; text-underline-offset: .2em; }

  /* Randspalte: das Korrekturzeichen steht links neben seinem Feld und benennt,
     was dort zu tun ist. Auf schmalen Bildschirmen klappt es darueber. */
  .satz { display: grid; grid-template-columns: 2.5rem minmax(0, 1fr); gap: 0 .75rem; }
  .satz > .zeichen {
    grid-column: 1; font: 1.5rem/1.5 var(--mono); color: var(--korrektur);
    text-align: center; user-select: none;
  }
  .satz > .feld { grid-column: 2; }
  @media (max-width: 34rem) {
    .satz { grid-template-columns: 1fr; }
    .satz > .zeichen { grid-column: 1; text-align: left; line-height: 1.4; }
    .satz > .feld { grid-column: 1; }
  }

  label { display: block; margin: 0 0 .3rem;
    font: 600 .7rem/1.3 var(--mono); letter-spacing: .1em; text-transform: uppercase; }
  .feld { margin-bottom: 1.5rem; }
  input, textarea, select {
    width: 100%; padding: .55rem .65rem; font: inherit;
    background: var(--feld); color: inherit;
    border: 1px solid var(--linie); border-radius: 2px;
  }
  /* Zitat und Vorschlag im festen Raster: ein Leerzeichen zu viel oder ein
     Buchstabendreher ist nur so zu sehen. */
  #quoteBefore, #suggestionAfter { font: .95rem/1.6 var(--mono); min-height: 5.5rem; }
  #quoteBefore { border-left: 3px solid var(--korrektur); }
  #suggestionAfter { border-left: 3px solid var(--vorschlag); }
  textarea { min-height: 4.5rem; resize: vertical; }
  :focus-visible { outline: 2px solid var(--korrektur); outline-offset: 1px; }

  .zaehler { display: block; margin-top: .2rem;
    font: 400 .7rem/1.4 var(--sans); letter-spacing: 0; text-transform: none; color: var(--rand); }

  button {
    margin-top: .5rem; padding: .6rem 1.4rem; cursor: pointer;
    font: 600 .75rem/1 var(--mono); letter-spacing: .12em; text-transform: uppercase;
    background: var(--tinte); color: var(--papier);
    border: 1px solid var(--tinte); border-radius: 2px;
  }
  button:hover { background: var(--korrektur); border-color: var(--korrektur); }

  .hinweis { padding: .85rem 1rem; margin: 0 0 1.5rem;
    background: var(--feld); border: 1px solid var(--linie);
    border-left: 3px solid var(--rand); border-radius: 2px; }
  .hinweis p { margin: 0 0 .5rem; }
  .hinweis p:last-child { margin-bottom: 0; }

  /* Die Kennung ist das, wonach spaeter gesucht wird — also im Raster und fett. */
  .kennung { font: 600 1.05em var(--mono); letter-spacing: .06em; }

  table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
  th { font: 600 .7rem/1.3 var(--mono); letter-spacing: .1em; text-transform: uppercase;
    color: var(--rand); }
  th, td { text-align: left; padding: .55rem .5rem; border-bottom: 1px solid var(--linie);
    vertical-align: top; }
  form.inline { display: inline; }

  @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
`;

export const Layout: FC<PropsWithChildren<{ title: string }>> = ({ title, children }) => (
  <html lang="de">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="robots" content="noindex" />
      <title>{title}</title>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
    </head>
    <body>
      <div class="blatt">
        <header>
          <a class="marke" href="/neu" aria-label="Korrekturen">
            Korrektu<span class="tilgung">h</span>ren
          </a>
          <nav>
            <a href="/neu">Neuer Hinweis</a>
            <a href="/admin/redaktionen">Redaktionen</a>
            <a href="/admin/fehlerarten">Fehlerarten</a>
          </nav>
        </header>
        <h1>{title}</h1>
        {children}
      </div>
    </body>
  </html>
);
