import { PALETTE, PALETTE_DUNKEL } from "@korrektur/shared";
import { Hono } from "hono";
import {
  APPLE_TOUCH_ICON,
  FAVICON_ICO,
  ICON_192,
  ICON_512,
  ICON_SVG,
  MANIFEST,
} from "../views/icons.js";

/**
 * Icons, Manifest und Service Worker (Startbildschirm und Browser-Tab).
 *
 * Die Bilder stehen als Base64 im Buendel (siehe views/icons.ts): der Hoster
 * startet die Anwendung aus einem anderen Verzeichnis als dem
 * Arbeitsverzeichnis, eingebettet gibt es keine Pfadfrage — und keine
 * externe Ressource, wie es die Projektregel verlangt.
 */

/** Die Adressen sind fest, der Inhalt aendert sich nur mit dem Motiv. */
const EIN_JAHR = "public, max-age=31536000, immutable";

/**
 * Der Service Worker macht die Seite installierbar und faengt genau einen
 * Fall ab: eine Seitennavigation ohne Netz. Er legt nichts im Zwischenspeicher
 * ab — die Anwendung ist serverseitig gerendert, ein "Offline-Modus" waere
 * eine Behauptung, die sie nicht einloesen kann.
 */
const SERVICE_WORKER = `
const ERSATZ = \`<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ohne Verbindung</title>
<style>body{margin:0;display:grid;place-items:center;min-height:100svh;
background:${PALETTE.papier};color:${PALETTE.tinte};font:16px/1.6 "Courier New",Courier,monospace;
text-align:center;padding:1.5rem}h1{font-size:1.25rem;letter-spacing:.03em}
p{color:${PALETTE.rand};max-width:26rem}
@media(prefers-color-scheme:dark){body{background:${PALETTE_DUNKEL.papier};color:${PALETTE_DUNKEL.tinte}}p{color:${PALETTE_DUNKEL.rand}}}
</style></head><body><div><h1>Ohne Verbindung</h1>
<p>Korrekturen braucht das Netz — die Seiten entstehen auf dem Server.
Sobald die Verbindung wieder steht, laedt ein Neuladen die Seite.</p>
</div></body></html>\`;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  if (e.request.mode !== "navigate") return;
  e.respondWith(
    fetch(e.request).catch(
      () =>
        new Response(ERSATZ, {
          status: 503,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
    ),
  );
});
`.trimStart();

function bild(base64: string, typ: string): Response {
  return new Response(Buffer.from(base64, "base64"), {
    headers: { "content-type": typ, "cache-control": EIN_JAHR },
  });
}

export const iconRoutes = (): Hono => {
  const app = new Hono();

  app.get("/favicon.ico", () => bild(FAVICON_ICO, "image/x-icon"));
  app.get("/apple-touch-icon.png", () => bild(APPLE_TOUCH_ICON, "image/png"));
  /* iOS aelterer Ausgaben fragt Varianten mit Groesse im Namen ab und faellt
     erst danach auf das Stammverzeichnis zurueck. */
  app.get("/apple-touch-icon-precomposed.png", () => bild(APPLE_TOUCH_ICON, "image/png"));
  app.get("/icon-192.png", () => bild(ICON_192, "image/png"));
  app.get("/icon-512.png", () => bild(ICON_512, "image/png"));

  app.get("/icon.svg", (c) =>
    c.body(ICON_SVG, 200, { "content-type": "image/svg+xml", "cache-control": EIN_JAHR }),
  );

  app.get("/site.webmanifest", (c) =>
    c.body(JSON.stringify(MANIFEST), 200, {
      "content-type": "application/manifest+json",
      "cache-control": "public, max-age=3600",
    }),
  );

  /* Der Service Worker darf nicht lange im Zwischenspeicher liegen, sonst
     bleibt eine alte Fassung kleben. */
  app.get("/sw.js", (c) =>
    c.body(SERVICE_WORKER, 200, {
      "content-type": "text/javascript; charset=utf-8",
      "cache-control": "no-cache",
    }),
  );

  return app;
};
