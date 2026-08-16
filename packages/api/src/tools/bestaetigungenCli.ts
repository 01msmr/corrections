import { writeFileSync } from "node:fs";
import { createDb } from "../db/client.js";
import { loadWorkerEnv } from "../env.js";
import { passtAufBestaetigungsmuster } from "../inbox/bestaetigung.js";
import {
  listeBestaetigungen,
  macheAuszuegeLesbar,
  nimmBestaetigungenZurueck,
  zaehleBestaetigungen,
} from "../repo/antworten.js";

/**
 * Einmalwerkzeug: Eingangsbestaetigungen, die als Antwort gezaehlt wurden,
 * weil die Erkennung ihre Formulierung noch nicht kannte. Ohne Argument
 * wird nur gezaehlt, `--zeigen` legt sie zum Lesen vor; erst `--loeschen`
 * nimmt sie zurueck.
 *
 * Laeuft auf dem Server ueber "Skript ausfuehren": `npm run bestaetigungen`
 * bzw. `npm run bestaetigungen:loeschen`.
 */
/** So viel Auszug legt `--zeigen` vor; der Satz zur Sache steht am Anfang. */
const ZEICHEN = 600;

function main(): void {
  const env = loadWorkerEnv();
  const db = createDb(env.DATABASE_PATH);
  const loeschen = process.argv.includes("--loeschen");

  if (process.argv.includes("--auszuege")) {
    console.log(
      JSON.stringify({ level: "info", msg: "auszuege lesbar gemacht", geaendert: macheAuszuegeLesbar(db) }),
    );
    return;
  }

  if (process.argv.includes("--zeigen")) {
    /* Eine Zeile je Ereignis, damit der Blick ueber die Formulierungen
       geht -- die Entscheidung faellt am Wortlaut, nicht an der Zahl. */
    /* Nach Wortlaut gruppiert: die Redaktionen antworten aus Bausteinen,
       52 fast gleiche Zeilen zu lesen sagt weniger als ihre Handvoll
       Fassungen mit Haeufigkeit. Die Trennlinie der Vorlage faellt vorne
       weg, sonst frisst sie den Platz. */
    const fassungen = new Map<string, { anzahl: number; refs: string[] }>();
    for (const zeile of listeBestaetigungen(db, passtAufBestaetigungsmuster)) {
      const text = (zeile.excerpt ?? "")
        .replace(/\s+/g, " ")
        .replace(/^[\s-]+/, "")
        .slice(0, ZEICHEN);
      const eintrag = fassungen.get(text) ?? { anzahl: 0, refs: [] };
      eintrag.anzahl += 1;
      if (eintrag.refs.length < 3) eintrag.refs.push(zeile.ref);
      fassungen.set(text, eintrag);
    }
    for (const [auszug, { anzahl, refs }] of [...fassungen].sort((a, b) => b[1].anzahl - a[1].anzahl)) {
      console.log(JSON.stringify({ anzahl, refs, auszug }));
    }
    /* Immer eine Zeile am Ende: ohne sie sieht "keine Treffer" wie ein
       haengender Aufruf aus. */
    console.log(
      JSON.stringify({
        level: "info",
        msg: "bestaetigungen gesichtet",
        ereignisse: [...fassungen.values()].reduce((summe, e) => summe + e.anzahl, 0),
        fassungen: fassungen.size,
      }),
    );
    return;
  }

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
