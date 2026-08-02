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
  it("legt alle voreingestellten Fehlerarten an", () => {
    const db = freshDb();
    seed(db);
    const rows = db.select().from(errorTypes).all();
    // Gegen die Konstante statt gegen eine feste Zahl: die Liste waechst,
    // der Test soll dann die Vollstaendigkeit pruefen, nicht die Anzahl.
    expect(rows).toHaveLength(DEFAULT_ERROR_TYPES.length);
    expect(rows.map((r) => r.key)).toEqual(
      expect.arrayContaining(DEFAULT_ERROR_TYPES.map((e) => e.key)),
    );
    expect(rows.map((r) => r.key)).toContain("ueberschrift_deckt_nicht");
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
    expect(db.select().from(errorTypes).all()).toHaveLength(DEFAULT_ERROR_TYPES.length);
    expect(db.select().from(outlets).all()).toHaveLength(3);
  });

  it("vergibt eine stabile Sortierreihenfolge", () => {
    const db = freshDb();
    seed(db);
    const orders = db.select().from(errorTypes).all().map((r) => r.sortOrder);
    expect(new Set(orders).size).toBe(DEFAULT_ERROR_TYPES.length);
  });
});
