import { createDb, runMigrations } from "./db/client.js";
import { loadWorkerEnv } from "./env.js";
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

  const ergebnis = await posteingangLauf(db, env);
  if (ergebnis === null) {
    console.log(
      JSON.stringify({ level: "info", msg: "worker gelaufen", tasks: [], hinweis: "IMAP nicht konfiguriert" }),
    );
    return;
  }

  console.log(JSON.stringify({ level: "info", msg: "worker gelaufen", tasks: ["posteingang"], ...ergebnis }));
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
