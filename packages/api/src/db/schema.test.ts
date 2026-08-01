import { describe, expect, it } from "vitest";
import { createDb, runMigrations } from "./client.js";
import { errorTypes, outletDomains, outlets } from "./schema.js";

/**
 * drizzle-orm@1.0.0-rc.4 verpackt jeden fehlgeschlagenen Query in einen
 * `DrizzleQueryError`, dessen eigene `.message` nur "Failed query: ..." lautet.
 * Der echte SQLite-Fehler (inkl. "UNIQUE constraint failed") steckt in `.cause`.
 * Ein simples `toThrow(/UNIQUE/i)` würde daher immer fehlschlagen, obwohl die
 * Constraint korrekt greift — deshalb wird hier gezielt auf `.cause` geprüft,
 * um sicherzustellen, dass wirklich SQLite und nicht ein anderer Fehler wirft.
 */
function expectSqliteUniqueViolation(run: () => void): void {
  let error: unknown;
  try {
    run();
  } catch (caught) {
    error = caught;
  }
  expect(error).toBeInstanceOf(Error);
  const cause = error instanceof Error ? error.cause : undefined;
  expect(String(cause)).toMatch(/UNIQUE/i);
}

describe("Schema und Migration", () => {
  it("legt alle Tabellen an und ist idempotent", () => {
    const db = createDb(":memory:");
    runMigrations(db);
    runMigrations(db);

    const rows = db.$client
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];
    const names = rows.map((r) => r.name);

    for (const table of [
      "article_checks",
      "corrections",
      "error_types",
      "imap_cursor",
      "outlet_domains",
      "outlets",
      "response_events",
    ]) {
      expect(names).toContain(table);
    }
  });

  it("erzwingt Eindeutigkeit der Domain über Outlets hinweg", () => {
    const db = createDb(":memory:");
    runMigrations(db);
    const now = Math.floor(Date.now() / 1000);

    db.insert(outlets).values({ id: "o1", name: "A", primaryDomain: "a.de", createdAt: now }).run();
    db.insert(outlets).values({ id: "o2", name: "B", primaryDomain: "b.de", createdAt: now }).run();
    db.insert(outletDomains).values({ id: "d1", outletId: "o1", domain: "geteilt.de" }).run();

    expectSqliteUniqueViolation(() =>
      db.insert(outletDomains).values({ id: "d2", outletId: "o2", domain: "geteilt.de" }).run(),
    );
  });

  it("erzwingt Eindeutigkeit des Fehlerart-Schlüssels", () => {
    const db = createDb(":memory:");
    runMigrations(db);
    const now = Math.floor(Date.now() / 1000);

    db.insert(errorTypes).values({ id: "e1", key: "zahl", label: "Zahl", sortOrder: 1, createdAt: now }).run();
    expectSqliteUniqueViolation(() =>
      db.insert(errorTypes).values({ id: "e2", key: "zahl", label: "Zahl 2", sortOrder: 2, createdAt: now }).run(),
    );
  });
});
