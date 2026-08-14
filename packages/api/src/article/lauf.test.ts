import { createId } from "@paralleldrive/cuid2";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, runMigrations, type Db } from "../db/client.js";
import { articleChecks, corrections, errorTypes, outlets } from "../db/schema.js";
import { seed } from "../db/seed.js";
import { createOutlet } from "../repo/outlets.js";
import { artikelLauf } from "./lauf.js";

const TAG = 86_400;
const JETZT = 1_800_000_000;
const RUMPF = "Im vergangenen Jahr nutzten MITTE das Angebot. ".repeat(30);

let db: Db;

beforeEach(() => {
  db = createDb(":memory:");
  runMigrations(db);
  seed(db);
  createOutlet(
    db,
    { name: "Alpha", primaryDomain: "alpha.test", publisher: null, country: null, notes: null, contactEmails: [] },
    JETZT,
  );
});

function meldung(): string {
  const id = createId();
  const outletId = db.select().from(outlets).all()[0]?.id ?? "";
  const errorTypeId = db.select().from(errorTypes).all()[0]?.id ?? "";
  db.insert(corrections)
    .values({
      id,
      ref: "KTEST1",
      idempotencyKey: id,
      createdAt: JETZT - 2 * TAG,
      dispatchMode: "smtp",
      articleUrl: "https://alpha.test/artikel",
      articleUrlCanon: "https://alpha.test/artikel",
      outletId,
      errorTypeId,
      severity: 2,
      quoteBefore: "rund 4,2 Millionen Menschen",
      quotePrefix: "Im vergangenen Jahr nutzten",
      quoteSuffix: "das Angebot.",
      suggestionAfter: "rund 2,4 Millionen Menschen",
      recipientEmail: "red@alpha.test",
      source: "web",
      dispatchStatus: "sent",
      sentAt: JETZT - 2 * TAG,
    })
    .run();
  return id;
}

const seite = (mitte: string) => ({
  ok: true as const,
  status: 200,
  html: `<html><body><article><p>${RUMPF.replaceAll("MITTE", mitte)}</p></article></body></html>`,
  url: "https://alpha.test/artikel",
});

describe("artikelLauf", () => {
  it("haelt fest, dass der Vorschlag uebernommen wurde", async () => {
    meldung();
    const ergebnis = await artikelLauf(db, {
      fetchArticle: async () => seite("rund 2,4 Millionen Menschen"),
      now: () => JETZT,
    });
    expect(ergebnis.geprueft).toBe(1);
    expect(db.select().from(articleChecks).all()[0]?.quoteState).toBe("changed_as_suggested");
  });

  it("vermerkt eine unerreichbare Seite, statt sie zu uebergehen", async () => {
    meldung();
    const ergebnis = await artikelLauf(db, {
      fetchArticle: async () => ({ ok: false as const, status: 403, reason: "http" as const }),
      now: () => JETZT,
    });
    expect(ergebnis.unerreichbar).toBe(1);
    expect(db.select().from(articleChecks).all()[0]?.quoteState).toBe("unreachable");
  });

  it("prueft dieselbe Meldung im selben Lauf nicht zweimal", async () => {
    meldung();
    const deps = { fetchArticle: async () => seite("rund 4,2 Millionen Menschen"), now: () => JETZT };
    await artikelLauf(db, deps);
    const zweiter = await artikelLauf(db, deps);
    expect(zweiter.geprueft).toBe(0);
    expect(db.select().from(articleChecks).all()).toHaveLength(1);
  });
});
