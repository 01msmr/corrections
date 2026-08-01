import { describe, expect, it } from "vitest";
import { createDb, runMigrations } from "./client.js";
import { DEFAULT_ERROR_TYPES, seed } from "./seed.js";
import { errorTypes, outletDomains, outlets } from "./schema.js";

function freshDb() {
  const db = createDb(":memory:");
  runMigrations(db);
  return db;
}

describe("seed", () => {
  it("legt die zwölf Fehlerarten aus der Spec an", () => {
    const db = freshDb();
    seed(db);
    const rows = db.select().from(errorTypes).all();
    expect(rows).toHaveLength(12);
    expect(rows.map((r) => r.key)).toContain("ueberschrift_deckt_nicht");
    expect(DEFAULT_ERROR_TYPES).toHaveLength(12);
  });

  it("legt drei Redaktionen mit je einer Domain an", () => {
    const db = freshDb();
    seed(db);
    expect(db.select().from(outlets).all()).toHaveLength(3);
    expect(db.select().from(outletDomains).all()).toHaveLength(3);
  });

  it("ist mehrfach ausführbar, ohne zu duplizieren", () => {
    const db = freshDb();
    seed(db);
    seed(db);
    expect(db.select().from(errorTypes).all()).toHaveLength(12);
    expect(db.select().from(outlets).all()).toHaveLength(3);
  });

  it("vergibt eine stabile Sortierreihenfolge", () => {
    const db = freshDb();
    seed(db);
    const orders = db.select().from(errorTypes).all().map((r) => r.sortOrder);
    expect(new Set(orders).size).toBe(12);
  });
});
