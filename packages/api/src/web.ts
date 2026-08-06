import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { fetchArticle } from "./article/fetch.js";
import { createDb, runMigrations } from "./db/client.js";
import medien from "./db/medien.json" with { type: "json" };
import { seed } from "./db/seed.js";
import { applyViews } from "./db/views.js";
import { createSmtpMailer } from "./dispatch/send.js";
import { loadEnv } from "./env.js";
import { uebernimmStammdaten } from "./tools/medienStammdaten.js";

const env = loadEnv();

if (env.DATABASE_PATH !== ":memory:") {
  mkdirSync(dirname(env.DATABASE_PATH), { recursive: true });
}

const db = createDb(env.DATABASE_PATH);
// Ordner explizit aus der geprueften Umgebung, nicht aus dem Rueckfall in
// runMigrations selbst — sonst liegt derselbe Wert an zwei Stellen.
runMigrations(db, env.MIGRATIONS_DIR);
applyViews(db); // aus den Konstanten neu erzeugt, siehe Task 9
seed(db);
/* Redaktionsnamen und Korrekturadressen kommen aus medien.json — der Fassung
   aus dem Kurzbefehl, die den Versand jahrelang getragen hat. Bei jedem Start
   abgeglichen, damit eine Aenderung dort nur einen Deploy braucht. */
uebernimmStammdaten(db, medien, Math.floor(Date.now() / 1000));

const app = createApp({
  env,
  db,
  mailer: createSmtpMailer(env),
  fetchArticle: (url) => fetchArticle(url),
});

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(JSON.stringify({ level: "info", msg: "server gestartet", port: info.port }));
});
