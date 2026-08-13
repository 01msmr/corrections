import { writeFileSync } from "node:fs";
import { createDb } from "../db/client.js";
import { loadWorkerEnv } from "../env.js";
import { passtAufBestaetigungsmuster } from "../inbox/bestaetigung.js";
import { nimmBestaetigungenZurueck, zaehleBestaetigungen } from "../repo/antworten.js";

/**
 * Einmalwerkzeug: Eingangsbestaetigungen, die als Antwort gezaehlt wurden,
 * weil die Erkennung ihre Formulierung noch nicht kannte. Ohne Argument
 * wird nur gezaehlt; erst `--loeschen` nimmt sie zurueck.
 *
 * Laeuft auf dem Server ueber "Skript ausfuehren": `npm run bestaetigungen`
 * bzw. `npm run bestaetigungen:loeschen`.
 */
function main(): void {
  const env = loadWorkerEnv();
  const db = createDb(env.DATABASE_PATH);
  const loeschen = process.argv.includes("--loeschen");

  const treffer = zaehleBestaetigungen(db, passtAufBestaetigungsmuster);
  if (!loeschen) {
    console.log(
      JSON.stringify({
        level: "info",
        msg: "bestaetigungen gezaehlt",
        ereignisse: treffer.ereignisse,
        meldungen: treffer.meldungen,
        hinweis: "nichts geaendert — zum Zuruecknehmen: npm run bestaetigungen:loeschen",
      }),
    );
    return;
  }

  const ergebnis = nimmBestaetigungenZurueck(db, passtAufBestaetigungsmuster);
  /* Netz unter dem Eingriff: die geloeschten Zeilen liegen als JSON neben
     der Datenbank, mit dem Ausgang, den die Meldung vorher hatte. */
  const sicherung = `${env.DATABASE_PATH}.bestaetigungen-${Math.floor(Date.now() / 1000)}.json`;
  writeFileSync(sicherung, JSON.stringify(ergebnis.zeilen, null, 1) + "\n", "utf8");
  console.log(
    JSON.stringify({
      level: "info",
      msg: "bestaetigungen zurueckgenommen",
      geloescht: ergebnis.geloescht,
      wiederOffen: ergebnis.wiederOffen,
      sicherung,
    }),
  );
}

main();
