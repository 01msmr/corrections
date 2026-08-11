import { createId } from "@paralleldrive/cuid2";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, runMigrations, type Db } from "../db/client.js";
import { corrections, errorTypes, outlets, responseEvents } from "../db/schema.js";
import { seed } from "../db/seed.js";
import { createOutlet } from "./outlets.js";
import { ladeAntwortKandidaten, vermerkeAntwort } from "./antworten.js";

const JETZT = 1_800_000_000;

let db: Db;

beforeEach(() => {
  db = createDb(":memory:");
  runMigrations(db);
  seed(db);
  createOutlet(
    db,
    {
      name: "Alpha-Blatt",
      primaryDomain: "alpha-blatt.de",
      publisher: null,
      country: null,
      notes: null,
      contactEmails: [],
    },
    JETZT,
  );
});

function meldung(overrides: Partial<typeof corrections.$inferInsert> = {}): string {
  const id = createId();
  const outletId = db.select().from(outlets).all()[0]?.id;
  const errorTypeId = db.select().from(errorTypes).all()[0]?.id;
  if (!outletId || !errorTypeId) throw new Error("Stammdaten fehlen");
  db.insert(corrections)
    .values({
      id,
      ref: `K${id.slice(0, 5).toUpperCase()}`,
      idempotencyKey: id,
      createdAt: JETZT,
      dispatchMode: "smtp",
      articleUrl: "https://alpha-blatt.de/a",
      articleUrlCanon: "https://alpha-blatt.de/a",
      outletId,
      errorTypeId,
      severity: 2,
      quoteBefore: "falsch",
      suggestionAfter: "richtig",
      recipientEmail: "korrektur@alpha-blatt.de",
      dispatchStatus: "sent",
      sentAt: JETZT,
      source: "backfill",
      headline: "Kann die Bahn ihn wiederbeleben?",
      messageId: "<abc123@korrekturen.msmr.co>",
      ...overrides,
    })
    .run();
  return id;
}

describe("ladeAntwortKandidaten", () => {
  it("liefert Kennung, blanke Message-ID, normierten Titel und Domains", () => {
    meldung();
    const [kandidat] = ladeAntwortKandidaten(db);
    expect(kandidat?.messageId).toBe("abc123@korrekturen.msmr.co");
    expect(kandidat?.headlineNorm).toBe("kann die bahn ihn wiederbeleben?");
    expect(kandidat?.domains).toContain("alpha-blatt.de");
  });
});

describe("vermerkeAntwort", () => {
  const VERMERK = {
    receivedAt: JETZT + 500,
    rawMessageId: "antwort-1@alpha-blatt.de",
    fromAddr: "redaktion@alpha-blatt.de",
    excerpt: "Danke, wir haben es korrigiert.",
  };

  it("haelt die Antwort fest und stellt offene Meldungen auf Antwort erhalten", () => {
    const id = meldung();
    expect(vermerkeAntwort(db, id, VERMERK)).toBe(true);

    const zeile = db.select().from(corrections).all()[0];
    expect(zeile?.outcome).toBe("acknowledged");
    expect(zeile?.respondedAt).toBe(JETZT + 500);
    expect(db.select().from(responseEvents).all()).toHaveLength(1);
  });

  it("ist ueber die Message-ID idempotent", () => {
    const id = meldung();
    expect(vermerkeAntwort(db, id, VERMERK)).toBe(true);
    expect(vermerkeAntwort(db, id, VERMERK)).toBe(false);
    expect(db.select().from(responseEvents).all()).toHaveLength(1);
  });

  it("laesst einen gesetzten Ausgang unangetastet", () => {
    /* Was aus der Antwort folgt, entscheidet der Betreiber — eine spaeter
       eintreffende Mail darf "korrigiert" nicht zuruecksetzen. */
    const id = meldung({ outcome: "corrected", respondedAt: JETZT + 100 });
    expect(vermerkeAntwort(db, id, { ...VERMERK, rawMessageId: "antwort-2@alpha-blatt.de" })).toBe(true);
    const zeile = db.select().from(corrections).all()[0];
    expect(zeile?.outcome).toBe("corrected");
    expect(zeile?.respondedAt).toBe(JETZT + 100);
    expect(db.select().from(responseEvents).all()).toHaveLength(1);
  });
});
