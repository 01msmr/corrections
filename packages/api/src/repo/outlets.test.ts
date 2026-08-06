import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, runMigrations, type Db } from "../db/client.js";
import { corrections, errorTypes, outlets } from "../db/schema.js";
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
    expect(addDomain(db, a.id, "b.de").ok).toBe(false);
  });

  it("meldet Erfolg, wenn die Domain bereits zu diesem Outlet gehört", () => {
    const a = createOutlet(db, baseInput("A", "a.de"), NOW);
    // Idempotent: erneutes Hinzufügen derselben Domain ist kein Fehler und
    // erzeugt keine zweite Zeile.
    expect(addDomain(db, a.id, "a.de").ok).toBe(true);
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

  it("gibt die Domains eines archivierten Outlets frei", () => {
    // Ein archiviertes Outlet ist aus der Liste verschwunden. Behielte es seine
    // Domains, blockierte es sie unsichtbar: Der naechste Versuch, dieselbe
    // Domain einem anderen Titel zu geben, scheiterte ohne erkennbaren Grund.
    const magazin = createOutlet(db, baseInput("Magazin", "magazin.blatt.de"), NOW);
    const haupt = createOutlet(db, baseInput("Hauptblatt", "blatt.de"), NOW);
    const errorTypeId = createId();
    db.insert(errorTypes)
      .values({ id: errorTypeId, key: "zahl", label: "Zahl", sortOrder: 10, createdAt: NOW })
      .run();
    db.insert(corrections)
      .values({
        id: createId(),
        ref: "K7QW3N",
        idempotencyKey: "idem-2",
        createdAt: NOW,
        dispatchMode: "smtp",
        articleUrl: "https://magazin.blatt.de/a",
        articleUrlCanon: "https://magazin.blatt.de/a",
        outletId: magazin.id,
        errorTypeId,
        severity: 2,
        quoteBefore: "Zitat",
        suggestionAfter: "Vorschlag",
        recipientEmail: "leserbriefe@magazin.blatt.de",
        source: "web",
      })
      .run();

    expect(removeOutlet(db, magazin.id)).toBe("archived");
    // Die Domain ist jetzt frei und laesst sich dem Hauptblatt geben.
    expect(addDomain(db, haupt.id, "magazin.blatt.de").ok).toBe(true);
    expect(resolveOutletByHost(db, "magazin.blatt.de")?.id).toBe(haupt.id);
  });

  it("nimmt beim Uebertragen die Korrekturen dieser Domain mit", () => {
    const magazin = createOutlet(db, baseInput("Magazin", "magazin.blatt.de"), NOW);
    const haupt = createOutlet(db, baseInput("Hauptblatt", "blatt.de"), NOW);
    const errorTypeId = createId();
    db.insert(errorTypes)
      .values({ id: errorTypeId, key: "zahl", label: "Zahl", sortOrder: 10, createdAt: NOW })
      .run();

    const meldung = (ref: string, url: string, outletId: string): string => {
      const id = createId();
      db.insert(corrections)
        .values({
          id,
          ref,
          idempotencyKey: ref,
          createdAt: NOW,
          dispatchMode: "smtp",
          articleUrl: url,
          articleUrlCanon: url,
          outletId,
          errorTypeId,
          severity: 2,
          quoteBefore: "Zitat",
          suggestionAfter: "Vorschlag",
          recipientEmail: "leserbriefe@magazin.blatt.de",
          source: "web",
        })
        .run();
      return id;
    };

    // Zwei Meldungen zur Magazin-Domain, eine zu einer anderen Domain
    // desselben Mediums — nur die ersten beiden duerfen mitwandern.
    addDomain(db, magazin.id, "extra.blatt.de");
    const a = meldung("KAAAA1", "https://magazin.blatt.de/eins", magazin.id);
    const b = meldung("KAAAA2", "https://magazin.blatt.de/zwei", magazin.id);
    const fremd = meldung("KAAAA3", "https://extra.blatt.de/drei", magazin.id);

    removeOutlet(db, magazin.id);
    expect(addDomain(db, haupt.id, "magazin.blatt.de").ok).toBe(true);

    const gelesen = (id: string): string | undefined =>
      db.select().from(corrections).where(eq(corrections.id, id)).get()?.outletId;
    expect(gelesen(a)).toBe(haupt.id);
    expect(gelesen(b)).toBe(haupt.id);
    expect(gelesen(fremd)).toBe(magazin.id);
  });

  it("uebernimmt eine Domain, die noch an einem archivierten Outlet haengt", () => {
    // Bestandsfall: archiviert wurde, bevor die Freigabe eingebaut war.
    const alt = createOutlet(db, baseInput("Alt", "alt.de"), NOW);
    const neu = createOutlet(db, baseInput("Neu", "neu.de"), NOW);
    db.update(outlets).set({ archived: true }).where(eq(outlets.id, alt.id)).run();

    expect(addDomain(db, neu.id, "alt.de").ok).toBe(true);
    expect(resolveOutletByHost(db, "alt.de")?.id).toBe(neu.id);
  });

  it("laesst eine Domain eines aktiven Outlets unangetastet", () => {
    const a = createOutlet(db, baseInput("A", "aktiv-a.de"), NOW);
    const b = createOutlet(db, baseInput("B", "aktiv-b.de"), NOW);
    expect(addDomain(db, b.id, "aktiv-a.de").ok).toBe(false);
    expect(resolveOutletByHost(db, "aktiv-a.de")?.id).toBe(a.id);
  });

  it("meldet missing bei unbekannter Kennung", () => {
    expect(removeOutlet(db, "gibt-es-nicht")).toBe("missing");
  });
});
