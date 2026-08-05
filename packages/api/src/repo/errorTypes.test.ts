import { createId } from "@paralleldrive/cuid2";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, runMigrations, type Db } from "../db/client.js";
import { corrections, outlets } from "../db/schema.js";
import {
  createErrorType,
  getErrorTypeByKey,
  listErrorTypes,
  removeErrorType,
  reorderErrorTypes,
  updateErrorType,
} from "./errorTypes.js";

const NOW = 1_800_000_000;
let db: Db;

beforeEach(() => {
  db = createDb(":memory:");
  runMigrations(db);
});

describe("Fehlerarten", () => {
  it("legt eine Fehlerart an und findet sie über den Schlüssel", () => {
    const created = createErrorType(
      db,
      { key: "link", label: "Toter Link", description: null },
      NOW,
    );
    expect(created?.key).toBe("link");
    expect(getErrorTypeByKey(db, "link")?.id).toBe(created?.id);
  });

  it("verweigert einen doppelten Schlüssel", () => {
    createErrorType(db, { key: "link", label: "Toter Link", description: null }, NOW);
    expect(
      createErrorType(db, { key: "link", label: "Anderer Name", description: null }, NOW),
    ).toBeNull();
  });

  it("ändert Bezeichnung und Beschreibung, aber nicht den Schlüssel", () => {
    const created = createErrorType(db, { key: "link", label: "Toter Link", description: null }, NOW);
    const updated = updateErrorType(db, created!.id, {
      label: "Defekter Link",
      description: "Ziel nicht erreichbar.",
    });
    expect(updated?.label).toBe("Defekter Link");
    expect(updated?.description).toBe("Ziel nicht erreichbar.");
    expect(updated?.key).toBe("link");
  });

  it("haengt neue ans Ende und sortiert entlang der gezogenen Liste", () => {
    createErrorType(db, { key: "b", label: "B", description: null }, NOW);
    createErrorType(db, { key: "a", label: "A", description: null }, NOW);
    // Anlage-Reihenfolge, nicht alphabetisch: neue haengen sich hinten an.
    expect(listErrorTypes(db).map((e) => e.key)).toEqual(["b", "a"]);
    const ids = listErrorTypes(db).map((e) => e.id).reverse();
    reorderErrorTypes(db, ids);
    expect(listErrorTypes(db).map((e) => e.key)).toEqual(["a", "b"]);
  });

  it("löscht eine unbenutzte Fehlerart hart", () => {
    const created = createErrorType(db, { key: "link", label: "L", description: null }, NOW);
    expect(removeErrorType(db, created!.id)).toBe("deleted");
    expect(listErrorTypes(db, { includeArchived: true })).toHaveLength(0);
  });

  it("archiviert eine benutzte Fehlerart", () => {
    const created = createErrorType(db, { key: "link", label: "L", description: null }, NOW);
    const outletId = createId();
    db.insert(outlets).values({ id: outletId, name: "X", primaryDomain: "x.de", createdAt: NOW }).run();
    db.insert(corrections)
      .values({
        id: createId(),
        ref: "K7QW3M",
        idempotencyKey: "idem-1",
        createdAt: NOW,
        dispatchMode: "smtp",
        articleUrl: "https://x.de/a",
        articleUrlCanon: "https://x.de/a",
        outletId,
        errorTypeId: created!.id,
        severity: 2,
        quoteBefore: "Zitat",
        suggestionAfter: "Vorschlag",
        recipientEmail: "leserbriefe@x.de",
        source: "web",
      })
      .run();

    expect(removeErrorType(db, created!.id)).toBe("archived");
    expect(listErrorTypes(db)).toHaveLength(0);
    expect(listErrorTypes(db, { includeArchived: true })).toHaveLength(1);
  });
});
