import { createId } from "@paralleldrive/cuid2";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, runMigrations, type Db } from "../db/client.js";
import { articleChecks, corrections, errorTypes, outlets, responseEvents } from "../db/schema.js";
import { seed } from "../db/seed.js";
import { createOutlet } from "./outlets.js";
import {
  leseMeldung,
  listeMeldungen,
  SEITENGROESSE,
  setzeAusgang,
  zaehleMeldungen,
} from "./meldungen.js";

const JETZT = 1_800_000_000;

let db: Db;

beforeEach(() => {
  db = createDb(":memory:");
  runMigrations(db);
  seed(db);
  for (const [name, domain] of [
    ["Alpha-Blatt", "alpha-blatt.de"],
    ["Beta-Bote", "beta-bote.de"],
  ] as const) {
    createOutlet(
      db,
      { name, primaryDomain: domain, publisher: null, country: null, notes: null, contactEmails: [] },
      JETZT,
    );
  }
});

function medium(name: string): string {
  const zeile = db.select().from(outlets).all().find((o) => o.name === name);
  if (!zeile) throw new Error(`Medium ${name} fehlt`);
  return zeile.id;
}

function fehlerart(index = 0): string {
  const zeile = db.select().from(errorTypes).all()[index];
  if (!zeile) throw new Error("Seed ohne Fehlerarten");
  return zeile.id;
}

function meldung(overrides: Partial<typeof corrections.$inferInsert> = {}): string {
  const id = createId();
  db.insert(corrections)
    .values({
      id,
      ref: `K${id.slice(0, 5).toUpperCase()}`,
      idempotencyKey: id,
      createdAt: JETZT,
      dispatchMode: "smtp",
      articleUrl: "https://alpha-blatt.de/a",
      articleUrlCanon: "https://alpha-blatt.de/a",
      outletId: medium("Alpha-Blatt"),
      errorTypeId: fehlerart(),
      severity: 2,
      quoteBefore: "falsch",
      suggestionAfter: "richtig",
      recipientEmail: "korrektur@alpha-blatt.de",
      dispatchStatus: "sent",
      sentAt: JETZT,
      source: "web",
      ...overrides,
    })
    .run();
  return id;
}

describe("listeMeldungen", () => {
  it("nummeriert chronologisch und laesst die Nummern beim Filtern stehen", () => {
    meldung({ sentAt: JETZT - 300 });
    const mittlere = meldung({ sentAt: JETZT - 200, outletId: medium("Beta-Bote") });
    meldung({ sentAt: JETZT - 100 });

    const alle = listeMeldungen(db);
    expect(alle.map((z) => z.nummer)).toEqual([3, 2, 1]);

    /* Filter erzeugen Luecken, keine Umnummerierung. */
    const nurBeta = listeMeldungen(db, { outletId: medium("Beta-Bote") });
    expect(nurBeta).toHaveLength(1);
    expect(nurBeta[0]?.nummer).toBe(2);
    expect(nurBeta[0]?.id).toBe(mittlere);
  });

  it("filtert nach Kategorie, Ausgang und Freitext", () => {
    meldung({ headline: "Der Mietwagen-Test", errorTypeId: fehlerart(0) });
    const andere = meldung({
      headline: "Zug faellt aus",
      errorTypeId: fehlerart(1),
      outcome: "rejected",
    });

    expect(listeMeldungen(db, { errorTypeId: fehlerart(1) }).map((z) => z.id)).toEqual([andere]);
    expect(listeMeldungen(db, { ausgang: "rejected" }).map((z) => z.id)).toEqual([andere]);
    expect(listeMeldungen(db, { suche: "mietwagen" })).toHaveLength(1);
    expect(listeMeldungen(db, { suche: "faellt" }).map((z) => z.id)).toEqual([andere]);
    /* LIKE-Sonderzeichen sind Text, kein Muster. */
    expect(listeMeldungen(db, { suche: "%" })).toHaveLength(0);
    expect(zaehleMeldungen(db, { ausgang: "rejected" })).toBe(1);
  });

  it("blaettert seitenweise", () => {
    for (let i = 0; i < SEITENGROESSE + 2; i++) meldung({ sentAt: JETZT + i });
    expect(listeMeldungen(db)).toHaveLength(SEITENGROESSE);
    const zweite = listeMeldungen(db, {}, 2);
    expect(zweite).toHaveLength(2);
    expect(zweite.map((z) => z.nummer)).toEqual([2, 1]);
  });
});

describe("leseMeldung", () => {
  it("liefert Kopf, Meldung und Ereignisse zeitlich sortiert", () => {
    const id = meldung();
    db.insert(responseEvents)
      .values({
        id: createId(),
        correctionId: id,
        kind: "reply",
        receivedAt: JETZT + 200,
        excerpt: "Danke, wird korrigiert.",
      })
      .run();
    db.insert(articleChecks)
      .values({
        id: createId(),
        correctionId: id,
        checkedAt: JETZT + 100,
        httpStatus: 200,
        quoteState: "unchanged",
      })
      .run();

    const detail = leseMeldung(db, id);
    expect(detail?.nummer).toBe(1);
    expect(detail?.medium).toBe("Alpha-Blatt");
    expect(detail?.ereignisse.map((e) => e.art)).toEqual(["unchanged", "reply"]);
  });

  it("gibt null fuer unbekannte ids", () => {
    expect(leseMeldung(db, "gibt-es-nicht")).toBeNull();
  });
});

describe("setzeAusgang", () => {
  it("schreibt Ausgang und Daten, lehnt Unbekanntes ab", () => {
    const id = meldung();
    expect(
      setzeAusgang(db, id, { outcome: "corrected_other", respondedAt: JETZT + 500, correctedAt: JETZT + 600 }),
    ).toBe(true);
    const zeile = db.select().from(corrections).all()[0];
    expect(zeile?.outcome).toBe("corrected_other");
    expect(zeile?.respondedAt).toBe(JETZT + 500);
    expect(zeile?.correctedAt).toBe(JETZT + 600);

    expect(setzeAusgang(db, "fehlt", { outcome: "open", respondedAt: null, correctedAt: null })).toBe(false);
  });
});
