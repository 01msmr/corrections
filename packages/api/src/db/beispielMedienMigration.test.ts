import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createId } from "@paralleldrive/cuid2";
import { describe, expect, it } from "vitest";
import { createOutlet } from "../repo/outlets.js";
import { createDb, runMigrations } from "./client.js";
import { corrections, errorTypes, outletDomains, outlets } from "./schema.js";
import { seed } from "./seed.js";

const MIGRATIONS = "packages/api/src/db/migrations";

/**
 * runMigrations() fuehrt jede Migration nur einmal aus -- auf einer frischen
 * Datenbank laeuft die Aufraeum-Migration also ueber leere Tabellen. Der Test
 * spielt deshalb den Bestandsfall nach: erst Daten anlegen, dann das SQL der
 * Migration direkt ausfuehren.
 */
function migrationSql(): string[] {
  const ordner = readdirSync(MIGRATIONS).find((name) =>
    name.endsWith("_beispiel-medien-entfernen"),
  );
  if (!ordner) throw new Error("Migration beispiel-medien-entfernen fehlt");
  return readFileSync(join(MIGRATIONS, ordner, "migration.sql"), "utf8")
    .split("--> statement-breakpoint")
    .map((teil) => teil.trim())
    .filter((teil) => teil.length > 0);
}

describe("Migration beispiel-medien-entfernen", () => {
  it("loescht Platzhalter ohne Meldungen und laesst alles andere stehen", () => {
    const db = createDb(":memory:");
    runMigrations(db);
    seed(db);
    const jetzt = 1_754_000_000;

    // Platzhalter ohne Meldung: soll verschwinden.
    createOutlet(
      db,
      { name: "Beispiel-Zeitung", primaryDomain: "beispiel-zeitung.de", publisher: null, country: null, notes: null, contactEmails: [] },
      jetzt,
    );
    // Platzhalter MIT Meldung: soll bleiben.
    const muster = createOutlet(
      db,
      { name: "Muster-Magazin", primaryDomain: "muster-magazin.de", publisher: null, country: null, notes: null, contactEmails: [] },
      jetzt,
    );
    // Echtes Medium ohne Meldung: darf die Migration nicht anfassen.
    createOutlet(
      db,
      { name: "taz", primaryDomain: "taz.de", publisher: null, country: null, notes: null, contactEmails: [] },
      jetzt,
    );

    const fehlerart = db.select().from(errorTypes).all()[0];
    if (!fehlerart) throw new Error("Seed ohne Fehlerarten");
    const meldungsId = createId();
    db.insert(corrections)
      .values({
        id: meldungsId,
        ref: `K${meldungsId.slice(0, 5).toUpperCase()}`,
        idempotencyKey: meldungsId,
        createdAt: jetzt,
        dispatchMode: "smtp",
        articleUrl: "https://muster-magazin.de/a",
        articleUrlCanon: "https://muster-magazin.de/a",
        outletId: muster.id,
        errorTypeId: fehlerart.id,
        severity: 2,
        quoteBefore: "falsch",
        suggestionAfter: "richtig",
        recipientEmail: "korrektur@muster-magazin.de",
        dispatchStatus: "sent",
        sentAt: jetzt,
        source: "backfill",
      })
      .run();

    for (const anweisung of migrationSql()) db.$client.exec(anweisung);

    const domains = db.select().from(outletDomains).all().map((zeile) => zeile.domain);
    expect(db.select().from(outlets).all().map((zeile) => zeile.primaryDomain).sort()).toEqual([
      "muster-magazin.de",
      "taz.de",
    ]);
    expect(domains.sort()).toEqual(["muster-magazin.de", "taz.de"]);
    expect(db.select().from(corrections).all()).toHaveLength(1);
  });
});
