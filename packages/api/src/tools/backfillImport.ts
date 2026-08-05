import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  canonicalizeUrl,
  detectSeverity,
  generateRef,
  type DetectedErrorTypeKey,
} from "@korrektur/shared";
import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { createDb, runMigrations, type Db } from "../db/client.js";
import { corrections } from "../db/schema.js";
import { seed } from "../db/seed.js";
import { reserveRef } from "../repo/corrections.js";
import { getErrorTypeByKey } from "../repo/errorTypes.js";
import { ensureOutletForHost } from "../repo/outlets.js";

/**
 * Import der Review-Entscheidungen (Spec §11.2): uebernommene Altmeldungen
 * werden zu corrections-Datensaetzen mit source='backfill'. Kein Versand,
 * kein Artikelabruf — der Versand ist historisch belegt (Gesendet-Ordner),
 * die Anker sind nicht rekonstruierbar (anchor_quality='none'). Idempotent
 * ueber die Message-ID: ein zweiter Lauf ueberspringt Vorhandenes.
 *
 * Liegt im api-Paket, damit Schema, Migrationen und Repos nicht dupliziert
 * werden — aber ausserhalb der Buendel-Einstiege (web.ts, worker.ts), also
 * nicht im Laufzeitpfad des Servers (§11.5).
 */

export interface ReviewEntscheidung {
  datei: string;
  entscheidung: "uebernommen" | "verworfen";
  felder?: {
    ueberschrift?: string | null;
    artikelUrl?: string | null;
    fehlerartKey?: string | null;
    anzahl?: string | null;
    zeichen?: string | null;
    falsch?: string | null;
    richtig?: string | null;
  };
  messageId?: string | null;
  gesendetAm?: string | null;
  empfaenger?: string | null;
}

export interface ImportErgebnis {
  uebernommen: number;
  uebersprungen: number;
  nichtUebernommen: number;
  fehler: string[];
}

/** Schluessel, fuer die die Schwere-Heuristik definiert ist (Typwaechter). */
const DETECT_KEYS = new Set([
  "zeichen_fehlt", "zeichen_zu_viel", "buchstabendreher", "komma_fehlt", "komma_zu_viel",
  "wort_fehlt", "wort_zu_viel", "falsche_zahl", "falsches_datum", "falscher_name",
  "falsche_wortwahl", "satzbau",
]);

function istDetectKey(key: string): key is DetectedErrorTypeKey {
  return DETECT_KEYS.has(key);
}

export function importiereEntscheidungen(
  db: Db,
  eintraege: ReviewEntscheidung[],
  now: number,
): ImportErgebnis {
  const ergebnis: ImportErgebnis = { uebernommen: 0, uebersprungen: 0, nichtUebernommen: 0, fehler: [] };

  for (const eintrag of eintraege) {
    if (eintrag.entscheidung !== "uebernommen") {
      ergebnis.nichtUebernommen += 1;
      continue;
    }
    const { felder, messageId, empfaenger } = eintrag;
    const artikelUrl = felder?.artikelUrl ?? null;
    const fehlerartKey = felder?.fehlerartKey ?? null;
    const falsch = felder?.falsch ?? null;
    const richtig = felder?.richtig ?? null;
    if (!messageId || !empfaenger || !artikelUrl || !fehlerartKey || !falsch || !richtig) {
      ergebnis.fehler.push(`${eintrag.datei}: Pflichtfeld fehlt`);
      continue;
    }

    const idempotencyKey = `backfill:${messageId}`.slice(0, 128);
    const vorhanden = db
      .select({ id: corrections.id })
      .from(corrections)
      .where(eq(corrections.idempotencyKey, idempotencyKey))
      .get();
    if (vorhanden) {
      ergebnis.uebersprungen += 1;
      continue;
    }

    const canon = canonicalizeUrl(artikelUrl);
    if (!canon) {
      ergebnis.fehler.push(`${eintrag.datei}: URL nicht verwertbar`);
      continue;
    }
    const errorType = getErrorTypeByKey(db, fehlerartKey);
    if (!errorType) {
      ergebnis.fehler.push(`${eintrag.datei}: unbekannte Fehlerart ${fehlerartKey}`);
      continue;
    }

    const gesendet = eintrag.gesendetAm ? Date.parse(eintrag.gesendetAm) : Number.NaN;
    const sentAt = Number.isNaN(gesendet) ? now : Math.floor(gesendet / 1000);
    const anzahlRoh = Number(felder?.anzahl ?? "");
    const errorCount = Number.isInteger(anzahlRoh) && anzahlRoh >= 1 ? anzahlRoh : null;
    const severity =
      (istDetectKey(fehlerartKey) ? detectSeverity(falsch, richtig, fehlerartKey) : null) ?? 2;

    const { outlet } = ensureOutletForHost(db, canon.host, sentAt);
    reserveRef(generateRef, (ref) => {
      db.insert(corrections)
        .values({
          id: createId(),
          ref,
          idempotencyKey,
          createdAt: sentAt,
          dispatchMode: "smtp",
          articleUrl: artikelUrl,
          articleUrlCanon: canon.canonical,
          outletId: outlet.id,
          headline: felder?.ueberschrift ?? null,
          errorTypeId: errorType.id,
          errorCount,
          errorChar: felder?.zeichen ?? null,
          severity,
          quoteBefore: falsch,
          suggestionAfter: richtig,
          anchorQuality: "none",
          recipientEmail: empfaenger,
          messageId,
          dispatchStatus: "sent",
          sentAt,
          /* Der Gesendet-Ordner belegt den Versand; damit zaehlt die Meldung
             zur SMTP-Population der Antwortquote (§9.3, §11.3). */
          sendConfirmedBy: "smtp",
          verification: "none",
          source: "backfill",
          needsReview: false,
        })
        .run();
    });
    ergebnis.uebernommen += 1;
  }

  return ergebnis;
}

/* Standardpfade absolut aus dem Modulpfad ableiten: `pnpm --filter … exec`
   startet im Paketverzeichnis, ein Aufruf von Hand meist im Repo-Stamm.
   Relative Vorgaben waeren also je nach Startort etwas anderes. */
const REPO = fileURLToPath(new URL("../../../../", import.meta.url));
const STANDARD_JSONL = `${REPO}fixtures.local/review-entscheidungen.jsonl`;
const STANDARD_DB = `${REPO}data/korrektur.db`;
const MIGRATIONEN = fileURLToPath(new URL("../db/migrations", import.meta.url));

/** Relative Angaben beziehen sich auf den Repo-Stamm, nicht auf das
 *  Verzeichnis, in dem pnpm das Werkzeug gerade gestartet hat. */
function ausRepo(pfad: string): string {
  return isAbsolute(pfad) ? pfad : resolve(REPO, pfad);
}

function main(): void {
  const pfad = ausRepo(process.argv[2] ?? STANDARD_JSONL);
  const datenbank = ausRepo(process.env["DATABASE_PATH"] ?? STANDARD_DB);
  if (!existsSync(pfad)) {
    console.error(
      `Keine Entscheidungen gefunden: ${pfad}\n` +
        "Erst die Review durchlaufen (pnpm backfill:review), dann importieren.",
    );
    process.exitCode = 1;
    return;
  }
  const zeilen = readFileSync(pfad, "utf8").split("\n").filter(Boolean);
  const eintraege: ReviewEntscheidung[] = zeilen.map(
    (zeile) => JSON.parse(zeile) as ReviewEntscheidung,
  );

  mkdirSync(dirname(datenbank), { recursive: true });
  const db = createDb(datenbank);
  runMigrations(db, process.env["MIGRATIONS_DIR"] ?? MIGRATIONEN);
  /* Stammdaten sicherstellen: ohne die Fehlerarten aus dem Seed findet der
     Import keine Kategorie. seed() ist idempotent. */
  seed(db);
  const ergebnis = importiereEntscheidungen(db, eintraege, Math.floor(Date.now() / 1000));
  /* Alles aus dem Write-Ahead-Log in die .db-Datei schreiben: Die Datenbank
     wird nach dem Import als einzelne Datei auf den Server gelegt, und ohne
     Checkpoint blieben die frischen Zeilen in der -wal-Datei zurueck. */
  db.$client.exec("PRAGMA wal_checkpoint(TRUNCATE)");

  console.log(
    `Import: ${ergebnis.uebernommen} uebernommen, ${ergebnis.uebersprungen} schon da, ` +
      `${ergebnis.nichtUebernommen} verworfen/uebergangen, ${ergebnis.fehler.length} Fehler`,
  );
  for (const fehler of ergebnis.fehler) console.warn(`  ${fehler}`);
  console.log(`Datenbank: ${datenbank}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
