import { MATURITY_SECONDS } from "@korrektur/shared";
import { createId } from "@paralleldrive/cuid2";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, runMigrations, type Db } from "../db/client.js";
import { articleChecks, corrections, errorTypes, outlets, responseEvents } from "../db/schema.js";
import { applyViews } from "../db/views.js";
import { outletStats } from "./stats.js";

const NOW = Math.floor(Date.now() / 1000);
const MATURE = NOW - MATURITY_SECONDS - 86_400;
const FRESH = NOW - 3600;

let db: Db;
let outletId: string;
let errorTypeId: string;

function addCorrection(overrides: Partial<typeof corrections.$inferInsert> = {}): string {
  const id = createId();
  db.insert(corrections)
    .values({
      id,
      ref: `K${id.slice(0, 5).toUpperCase().replace(/[ILOU]/g, "X")}`,
      idempotencyKey: id,
      createdAt: MATURE,
      dispatchMode: "smtp",
      articleUrl: "https://beispiel-zeitung.de/a",
      articleUrlCanon: "https://beispiel-zeitung.de/a",
      outletId,
      errorTypeId,
      severity: 2,
      quoteBefore: "Zitat",
      suggestionAfter: "Vorschlag",
      recipientEmail: "leserbriefe@beispiel-zeitung.de",
      dispatchStatus: "sent",
      sentAt: MATURE,
      source: "web",
      ...overrides,
    })
    .run();
  return id;
}

beforeEach(() => {
  db = createDb(":memory:");
  runMigrations(db);
  applyViews(db);

  outletId = createId();
  errorTypeId = createId();
  db.insert(outlets)
    .values({ id: outletId, name: "Beispiel-Zeitung", primaryDomain: "beispiel-zeitung.de", createdAt: NOW })
    .run();
  db.insert(errorTypes)
    .values({ id: errorTypeId, key: "zahl", label: "Zahl", sortOrder: 10, createdAt: NOW })
    .run();
});

describe("Kennzahlen-Views", () => {
  it("zählt eine reife, zugestellte, manuell bestätigte Korrektur", () => {
    addCorrection({ correctedAt: MATURE + 3600, verification: "manual", outcome: "corrected" });
    const [row] = outletStats(db);
    expect(row?.nCorrectionBase).toBe(1);
    expect(row?.nCorrected).toBe(1);
  });

  it("hält eine frische Meldung aus jedem Nenner heraus", () => {
    addCorrection({ createdAt: FRESH, sentAt: FRESH });
    const [row] = outletStats(db);
    expect(row?.nReports).toBe(1);
    expect(row?.nReplyBase).toBe(0);
    expect(row?.nCorrectionBase).toBe(0);
  });

  it("hält eine gebouncte Meldung aus jedem Nenner heraus", () => {
    addCorrection({ dispatchStatus: "bounced" });
    const [row] = outletStats(db);
    expect(row?.nReplyBase).toBe(0);
  });

  it("hält eine nur vorbereitete Meldung aus jedem Nenner heraus", () => {
    addCorrection({ dispatchStatus: "prepared", sentAt: null });
    const [row] = outletStats(db);
    expect(row?.nReplyBase).toBe(0);
  });

  it("wertet eine Autoreply nicht als Antwort", () => {
    const id = addCorrection();
    db.insert(responseEvents)
      .values({ id: createId(), correctionId: id, kind: "autoreply", receivedAt: MATURE + 60 })
      .run();
    const [row] = outletStats(db);
    expect(row?.nReplyBase).toBe(1);
    expect(row?.nReplied).toBe(0);
  });

  it("wertet eine echte Antwort als Antwort", () => {
    const id = addCorrection();
    db.insert(responseEvents)
      .values({ id: createId(), correctionId: id, kind: "reply", receivedAt: MATURE + 60 })
      .run();
    const [row] = outletStats(db);
    expect(row?.nReplied).toBe(1);
  });

  it("hält eine nicht abrufbare Seite aus dem Korrektur-Nenner heraus", () => {
    const id = addCorrection();
    db.insert(articleChecks)
      .values({ id: createId(), correctionId: id, checkedAt: MATURE + 86_400, quoteState: "unreachable" })
      .run();
    const [row] = outletStats(db);
    expect(row?.nCorrectionBase).toBe(0);
    expect(row?.nReplyBase).toBe(1);
  });

  it("zählt mailto-Meldungen nicht in den Antwort-Nenner", () => {
    addCorrection({ dispatchMode: "mailto" });
    const [row] = outletStats(db);
    expect(row?.nReplyBase).toBe(0);
  });

  it("unterdrückt die Quote bei n unter der Mindestfallzahl", () => {
    addCorrection({ correctedAt: MATURE + 3600, verification: "manual" });
    const [row] = outletStats(db);
    expect(row?.correctionRate).toBeNull();
  });

  it("liefert die Quote ab der Mindestfallzahl", () => {
    for (let i = 0; i < 10; i++) {
      addCorrection(i < 4 ? { correctedAt: MATURE + 3600, verification: "manual" } : {});
    }
    const [row] = outletStats(db);
    expect(row?.nCorrectionBase).toBe(10);
    expect(row?.correctionRate).toBeCloseTo(0.4, 6);
  });
});
