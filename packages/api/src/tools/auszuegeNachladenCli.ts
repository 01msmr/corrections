import { createDb } from "../db/client.js";
import { loadWorkerEnv } from "../env.js";
import { fehlerDetails, ladeAuszuegeNach } from "../inbox/postfach.js";
import { ereignisseZumNachladen, setzeAuszug } from "../repo/antworten.js";

/**
 * Einmalwerkzeug: holt den Text schon vermerkter Antworten erneut aus dem
 * Postfach. Fuer Altbestaende, deren Auszug zu kurz abgelegt wurde -- ohne
 * den Satz zur Sache ist eine erledigte Korrektur nicht von einer
 * Eingangsbestaetigung zu unterscheiden.
 *
 * Aendert nur `response_events.excerpt`, nie Ausgang oder Zuordnung.
 */
async function main(): Promise<void> {
  const env = loadWorkerEnv();
  const db = createDb(env.DATABASE_PATH);
  const offen = ereignisseZumNachladen(db);

  try {
    const ergebnis = await ladeAuszuegeNach(env, offen, (id, auszug) =>
      setzeAuszug(db, id, auszug),
    );
    if (!ergebnis) {
      console.log(JSON.stringify({ level: "warn", msg: "kein postfach eingerichtet" }));
      return;
    }
    console.log(JSON.stringify({ level: "info", msg: "auszuege nachgeladen", ...ergebnis }));
  } catch (fehler) {
    console.log(
      JSON.stringify({
        level: "error",
        msg: "nachladen fehlgeschlagen",
        ...fehlerDetails(fehler),
      }),
    );
    process.exitCode = 1;
  }
}

void main();
