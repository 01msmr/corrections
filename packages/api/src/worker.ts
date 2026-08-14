import { createDb, runMigrations } from "./db/client.js";
import { loadWorkerEnv } from "./env.js";
import { artikelLauf } from "./article/lauf.js";
import { fetchArticle } from "./article/fetch.js";
import { posteingangLauf } from "./inbox/lauf.js";
import { fehlerDetails } from "./inbox/postfach.js";

/**
 * Wird von der Kommandozeile aufgerufen, laeuft kurz und endet. Auf dem
 * Server steht fuer geplante Aufgaben keine Node-Laufzeit bereit; dort
 * stoesst die interne Route denselben Gang an (routes/intern.ts).
 */
async function main(): Promise<void> {
  const env = loadWorkerEnv();
  const db = createDb(env.DATABASE_PATH);
  runMigrations(db, env.MIGRATIONS_DIR);

  const posteingang = await posteingangLauf(db, env);
  const artikel = await artikelLauf(db, { fetchArticle, now: () => Math.floor(Date.now() / 1000) });

  console.log(
    JSON.stringify({
      level: "info",
      msg: "worker gelaufen",
      posteingang: posteingang ?? "IMAP nicht konfiguriert",
      artikel,
    }),
  );
}

main().catch((fehler: unknown) => {
  console.error(
    JSON.stringify({
      level: "error",
      msg: "worker gescheitert",
      fehler: String(fehler),
      ...fehlerDetails(fehler),
    }),
  );
  process.exitCode = 1;
});
