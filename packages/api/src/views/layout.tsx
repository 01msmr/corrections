import type { FC, PropsWithChildren } from "hono/jsx";

const STYLES = `
  :root { color-scheme: light dark; --line: color-mix(in oklab, currentColor 20%, transparent); }
  body { font: 16px/1.55 system-ui, sans-serif; margin: 0; padding: 1.5rem; max-width: 46rem; }
  h1 { font-size: 1.4rem; margin: 0 0 1.25rem; }
  h2 { font-size: 1.1rem; margin: 2rem 0 .75rem; }
  nav { margin-bottom: 1.5rem; display: flex; gap: 1rem; flex-wrap: wrap; }
  label { display: block; margin: 1rem 0 .25rem; font-weight: 600; }
  input, textarea, select { width: 100%; padding: .5rem; font: inherit; box-sizing: border-box;
    border: 1px solid var(--line); border-radius: .25rem; background: transparent; color: inherit; }
  textarea { min-height: 5rem; }
  button { margin-top: 1.25rem; padding: .6rem 1.2rem; font: inherit; cursor: pointer;
    border: 1px solid var(--line); border-radius: .25rem; background: transparent; color: inherit; }
  .hinweis { padding: .75rem; border: 1px solid var(--line); border-radius: .25rem; margin: 1rem 0; }
  .zaehler { font-weight: 400; font-size: .85rem; opacity: .75; }
  table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
  th, td { text-align: left; padding: .4rem .5rem; border-bottom: 1px solid var(--line); }
  form.inline { display: inline; }
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
      <nav>
        <a href="/neu">Neue Meldung</a>
        <a href="/admin/redaktionen">Redaktionen</a>
        <a href="/admin/fehlerarten">Fehlerarten</a>
      </nav>
      <h1>{title}</h1>
      {children}
    </body>
  </html>
);
