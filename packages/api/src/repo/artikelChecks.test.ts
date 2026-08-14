import { createId } from "@paralleldrive/cuid2";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, runMigrations, type Db } from "../db/client.js";
import { articleChecks, corrections, errorTypes, outlets } from "../db/schema.js";
import { seed } from "../db/seed.js";
import { createOutlet } from "./outlets.js";
import { faelligeChecks, vermerkeCheck } from "./artikelChecks.js";

const TAG = 86_400;
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

function meldung(sentAt: number | null, host = "alpha-blatt.de"): string {
  const id = createId();
  const outletId = db.select().from(outlets).all()[0]?.id;
  const errorTypeId = db.select().from(errorTypes).all()[0]?.id;
  if (!outletId || !errorTypeId) throw new Error("Stammdaten fehlen");
  db.insert(corrections)
    .values({
      id,
      ref: `K${id.slice(0, 5).toUpperCase()}`,
      idempotencyKey: id,
      createdAt: sentAt ?? JETZT,
      dispatchMode: "smtp",
      articleUrl: `https://${host}/artikel-${id}`,
      articleUrlCanon: `https://${host}/artikel-${id}`,
      outletId,
      errorTypeId,
      severity: 2,
      quoteBefore: "rund 4,2 Millionen",
      suggestionAfter: "rund 2,4 Millionen",
      recipientEmail: "red@alpha-blatt.de",
      source: "web",
      dispatchStatus: sentAt ? "sent" : "failed",
      sentAt,
    })
    .run();
  return id;
}

describe("faelligeChecks", () => {
  it("laesst eine frisch versendete Meldung noch in Ruhe", () => {
    meldung(JETZT - 3600);
    expect(faelligeChecks(db, JETZT)).toHaveLength(0);
  });

  it("nimmt sie nach dem ersten Tag", () => {
    meldung(JETZT - TAG - 60);
    expect(faelligeChecks(db, JETZT)).toHaveLength(1);
  });

  it("uebergeht Meldungen ohne erfolgreichen Versand", () => {
    meldung(null);
    expect(faelligeChecks(db, JETZT)).toHaveLength(0);
  });

  it("prueft nach einem Lauf erst am naechsten Meilenstein wieder", () => {
    const id = meldung(JETZT - TAG - 60);
    vermerkeCheck(db, id, { checkedAt: JETZT, httpStatus: 200, zustand: "unchanged", beobachtet: null, sicherheit: 100 });
    expect(faelligeChecks(db, JETZT)).toHaveLength(0);
    /* Tag 3 ist noch nicht erreicht … */
    expect(faelligeChecks(db, JETZT + TAG)).toHaveLength(0);
    /* … aber danach schon. */
    expect(faelligeChecks(db, JETZT + 2 * TAG + 60)).toHaveLength(1);
  });

  it("holt einen Altbestand nur ein einziges Mal nach", () => {
    /* Bei einer 200 Tage alten Meldung sind alle Meilensteine vorbei --
       daraus darf keine Serie von fuenf Abrufen werden. */
    const id = meldung(JETZT - 200 * TAG);
    expect(faelligeChecks(db, JETZT)).toHaveLength(1);
    vermerkeCheck(db, id, { checkedAt: JETZT, httpStatus: 200, zustand: "unchanged", beobachtet: null, sicherheit: 100 });
    expect(faelligeChecks(db, JETZT)).toHaveLength(0);
  });

  it("nimmt je Lauf hoechstens eine Meldung pro Domain", () => {
    meldung(JETZT - TAG - 60);
    meldung(JETZT - 2 * TAG);
    meldung(JETZT - TAG - 60, "beta-blatt.de");
    const faellig = faelligeChecks(db, JETZT);
    expect(faellig).toHaveLength(2);
    expect(new Set(faellig.map((f) => new URL(f.articleUrlCanon).host)).size).toBe(2);
  });
});

describe("vermerkeCheck", () => {
  it("schreibt den Befund und haelt fest, was beobachtet wurde", () => {
    const id = meldung(JETZT - TAG - 60);
    vermerkeCheck(db, id, {
      checkedAt: JETZT,
      httpStatus: 200,
      zustand: "changed_otherwise",
      beobachtet: "etwa vier Millionen",
      sicherheit: 80,
    });
    const zeile = db.select().from(articleChecks).all()[0];
    expect(zeile?.quoteState).toBe("changed_otherwise");
    expect(zeile?.observedText).toBe("etwa vier Millionen");
    expect(zeile?.matchConfidence).toBe(80);
  });
});
