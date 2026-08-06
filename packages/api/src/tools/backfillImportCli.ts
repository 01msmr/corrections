import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { createDb, runMigrations } from "../db/client.js";
import { seed } from "../db/seed.js";
import {
  ergaenzeKontaktadressen,
  importiereEntscheidungen,
  leseEntscheidungen,
} from "./backfillImport.js";

/**
 * Einstieg fuer den Altbestand-Import — lokal ueber `pnpm backfill:import`,
 * auf dem Server als mitgeliefertes `backfillImport.js`.
 *
 * Bewusst ohne `import.meta`: dieselbe Datei wird als CJS gebuendelt, wo es
 * das nicht gibt. Alle Pfade beziehen sich deshalb auf das Arbeitsverzeichnis
 * — lokal der Repo-Stamm, auf dem Server der Anwendungsstamm.
 *
 * Der Import ergaenzt nur: er legt fehlende Datensaetze an, ueberspringt
 * bekannte Message-IDs und loescht nie etwas. Ein zweiter Lauf ist deshalb
 * gefahrlos, und bereits erfasste Meldungen bleiben unberuehrt.
 */

const STANDARD_JSONL = "fixtures.local/review-entscheidungen.jsonl";
const STANDARD_DB = "data/korrektur.db";

function absolut(pfad: string): string {
  return isAbsolute(pfad) ? pfad : resolve(process.cwd(), pfad);
}

function main(): void {
  const pfad = absolut(process.argv[2] ?? STANDARD_JSONL);
  const datenbank = absolut(process.env["DATABASE_PATH"] ?? STANDARD_DB);

  if (!existsSync(pfad)) {
    console.error(
      `Keine Entscheidungen gefunden: ${pfad}\n` +
        "Erst die Review durchlaufen (pnpm backfill:review), dann importieren.\n" +
        "Ein anderer Ort lässt sich als Argument übergeben.",
    );
    process.exitCode = 1;
    return;
  }

  const { eintraege, fehler: lesefehler } = leseEntscheidungen(readFileSync(pfad, "utf8"));
  for (const fehler of lesefehler) console.warn(`  ${fehler}`);

  mkdirSync(dirname(datenbank), { recursive: true });
  const db = createDb(datenbank);
  runMigrations(db);
  /* Stammdaten sicherstellen: ohne die Fehlerarten aus dem Seed findet der
     Import keine Kategorie. seed() legt nur Fehlendes an. */
  seed(db);

  const ergebnis = importiereEntscheidungen(db, eintraege, Math.floor(Date.now() / 1000));
  const adressen = ergaenzeKontaktadressen(db);

  /* Write-Ahead-Log in die .db schreiben: Wird die Datei anschliessend
     kopiert, sind die frischen Zeilen sonst nicht darin. */
  db.$client.exec("PRAGMA wal_checkpoint(TRUNCATE)");

  console.log(
    `Import: ${ergebnis.uebernommen} uebernommen, ${ergebnis.uebersprungen} schon da, ` +
      `${ergebnis.nichtUebernommen} verworfen/uebergangen, ${ergebnis.fehler.length} Fehler`,
  );
  for (const fehler of ergebnis.fehler) console.warn(`  ${fehler}`);
  if (adressen > 0) console.log(`Kontaktadressen ergänzt: ${adressen}`);
  console.log(`Datenbank: ${datenbank}`);
}

main();
