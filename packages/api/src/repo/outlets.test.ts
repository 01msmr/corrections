import { createId } from "@paralleldrive/cuid2";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, runMigrations, type Db } from "../db/client.js";
import { corrections, errorTypes } from "../db/schema.js";
import {
  addDomain,
  createOutlet,
  ensureOutletForHost,
  listOutlets,
  removeDomain,
  removeOutlet,
  resolveOutletByHost,
  updateOutlet,
} from "./outlets.js";

const NOW = 1_800_000_000;
let db: Db;

beforeEach(() => {
  db = createDb(":memory:");
  runMigrations(db);
});

function baseInput(name: string, domain: string) {
  return {
    name,
    primaryDomain: domain,
    publisher: null,
    country: "DE",
    notes: null,
    contactEmails: ["leserbriefe@" + domain],
  };
}

describe("Outlet-Auflösung", () => {
  it("findet ein Outlet über eine Nebendomain", () => {
    const outlet = createOutlet(db, baseInput("Beispiel-Zeitung", "beispiel-zeitung.de"), NOW);
    addDomain(db, outlet.id, "magazin.beispiel-zeitung.de");

    expect(resolveOutletByHost(db, "magazin.beispiel-zeitung.de")?.id).toBe(outlet.id);
    expect(resolveOutletByHost(db, "unbekannt.de")).toBeNull();
  });

  it("legt bei unbekanntem Host ein Outlet an und meldet das", () => {
    const first = ensureOutletForHost(db, "neue-zeitung.de", NOW);
    expect(first.created).toBe(true);
    expect(first.outlet.name).toBe("neue-zeitung.de");
    expect(first.outlet.domains).toEqual(["neue-zeitung.de"]);

    const second = ensureOutletForHost(db, "neue-zeitung.de", NOW);
    expect(second.created).toBe(false);
    expect(second.outlet.id).toBe(first.outlet.id);
  });

  it("verweigert eine Domain, die schon zu einem anderen Outlet gehört", () => {
    const a = createOutlet(db, baseInput("A", "a.de"), NOW);
    createOutlet(db, baseInput("B", "b.de"), NOW);
    expect(addDomain(db, a.id, "b.de")).toBe(false);
  });

  it("meldet Erfolg, wenn die Domain bereits zu diesem Outlet gehört", () => {
    const a = createOutlet(db, baseInput("A", "a.de"), NOW);
    // Idempotent: erneutes Hinzufügen derselben Domain ist kein Fehler und
    // erzeugt keine zweite Zeile.
    expect(addDomain(db, a.id, "a.de")).toBe(true);
    expect(listOutlets(db)[0]?.domains).toEqual(["a.de"]);
  });

  it("entfernt eine zusätzliche Domain, aber nie die letzte", () => {
    const a = createOutlet(db, baseInput("A", "a.de"), NOW);
    addDomain(db, a.id, "magazin.a.de");

    expect(removeDomain(db, a.id, "magazin.a.de")).toBe(true);
    expect(listOutlets(db)[0]?.domains).toEqual(["a.de"]);

    // Ohne Domain waere das Outlet nie wieder ueber eine URL auffindbar.
    expect(removeDomain(db, a.id, "a.de")).toBe(false);
    expect(listOutlets(db)[0]?.domains).toEqual(["a.de"]);
  });
});

describe("Outlet-Pflege", () => {
  it("ändert Stammdaten und Kontaktadressen", () => {
    const outlet = createOutlet(db, baseInput("Alt", "alt.de"), NOW);
    const updated = updateOutlet(db, outlet.id, {
      ...baseInput("Neu", "alt.de"),
      contactEmails: ["redaktion@alt.de", "leserbriefe@alt.de"],
    });
    expect(updated?.name).toBe("Neu");
    expect(updated?.contactEmails).toHaveLength(2);
  });

  it("löscht ein Outlet ohne Referenzen hart", () => {
    const outlet = createOutlet(db, baseInput("Leer", "leer.de"), NOW);
    expect(removeOutlet(db, outlet.id)).toBe("deleted");
    expect(listOutlets(db, { includeArchived: true })).toHaveLength(0);
  });

  it("archiviert ein referenziertes Outlet, statt es zu löschen", () => {
    const outlet = createOutlet(db, baseInput("Benutzt", "benutzt.de"), NOW);
    const errorTypeId = createId();
    db.insert(errorTypes)
      .values({ id: errorTypeId, key: "zahl", label: "Zahl", sortOrder: 10, createdAt: NOW })
      .run();
    db.insert(corrections)
      .values({
        id: createId(),
        ref: "K7QW3M",
        idempotencyKey: "idem-1",
        createdAt: NOW,
        dispatchMode: "smtp",
        articleUrl: "https://benutzt.de/a",
        articleUrlCanon: "https://benutzt.de/a",
        outletId: outlet.id,
        errorTypeId,
        severity: 2,
        quoteBefore: "Zitat",
        suggestionAfter: "Vorschlag",
        recipientEmail: "leserbriefe@benutzt.de",
        source: "web",
      })
      .run();

    expect(removeOutlet(db, outlet.id)).toBe("archived");
    expect(listOutlets(db)).toHaveLength(0);
    expect(listOutlets(db, { includeArchived: true })).toHaveLength(1);
  });

  it("meldet missing bei unbekannter Kennung", () => {
    expect(removeOutlet(db, "gibt-es-nicht")).toBe("missing");
  });
});
