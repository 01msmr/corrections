import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDb, runMigrations, type Db } from "../db/client.js";
import { seed } from "../db/seed.js";
import { corrections } from "../db/schema.js";
import { createJsonMailer, type Mailer } from "../dispatch/send.js";
import type { FetchResult } from "../article/fetch.js";
import { createOutlet } from "./outlets.js";
import { createCorrection, getCorrectionByRef, type CreateDeps } from "./corrections.js";

const NOW = 1_800_000_000;
const HTML = readFileSync(resolve(process.cwd(), "tests/fixtures/artikel-standard.html"), "utf8");

let db: Db;

const INPUT = {
  idempotencyKey: "abcdef0123456789",
  articleUrl: "https://beispiel-zeitung.de/politik/artikel-123?utm_source=x",
  headline: null,
  errorTypeKey: "falsche_zahl",
  severity: 2,
  quoteBefore: "rund 4,2 Millionen Menschen",
  suggestionAfter: "rund 2,4 Millionen Menschen",
  comment: null,
};

function deps(overrides: Partial<CreateDeps> = {}): CreateDeps {
  return {
    db,
    mailer: createJsonMailer("korrektur@example.tld"),
    fetchArticle: async (): Promise<FetchResult> => ({ ok: true, status: 200, html: HTML }),
    now: () => NOW,
    baseUrl: "https://korrektur.example.tld",
    ...overrides,
  };
}

beforeEach(() => {
  db = createDb(":memory:");
  runMigrations(db);
  seed(db);
  // seed() saet nur Fehlerarten; das Testmedium samt Kontaktadresse entsteht hier.
  createOutlet(db, {
    name: "Beispiel-Zeitung",
    primaryDomain: "beispiel-zeitung.de",
    publisher: null,
    country: null,
    notes: null,
    contactEmails: ["leserbriefe@beispiel-zeitung.de"],
  }, Math.floor(Date.now() / 1000));
});

describe("createCorrection", () => {
  it("legt eine Meldung an, versendet sie und leitet Anker ab", async () => {
    const result = await createCorrection(deps(), INPUT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.created).toBe(true);
    expect(result.dispatchStatus).toBe("sent");
    expect(result.anchorQuality).toBe("exact");
    expect(result.ref).toMatch(/^K[0-9A-HJKMNP-TV-Z]{5}$/);

    const row = getCorrectionByRef(db, result.ref);
    expect(row?.articleUrlCanon).toBe("https://beispiel-zeitung.de/politik/artikel-123");
    expect(row?.recipientEmail).toBe("leserbriefe@beispiel-zeitung.de");
    expect(row?.messageId).toMatch(/^<.+>$/);
    expect(row?.sentAt).toBe(NOW);
    expect(row?.quotePrefix).toContain("Im vergangenen Jahr nutzten");
  });

  it("erzeugt bei gleichem Idempotency-Key keinen zweiten Datensatz", async () => {
    const first = await createCorrection(deps(), INPUT);
    const second = await createCorrection(deps(), INPUT);

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.created).toBe(false);
    expect(second.ref).toBe(first.ref);
    expect(db.select().from(corrections).all()).toHaveLength(1);
  });

  it("speichert trotz fehlgeschlagenem Artikelabruf und markiert zur Prüfung", async () => {
    const result = await createCorrection(
      deps({ fetchArticle: async () => ({ ok: false, status: 403, reason: "http" }) }),
      INPUT,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.anchorQuality).toBe("none");

    const row = getCorrectionByRef(db, result.ref);
    expect(row?.needsReview).toBe(true);
    expect(row?.dispatchStatus).toBe("sent");
  });

  it("markiert einen mehrdeutigen Fundort zur Prüfung", async () => {
    const html = "<html><body><article><h1>T</h1><p>Beta hier. Und Beta dort.</p></article></body></html>";
    const result = await createCorrection(
      deps({ fetchArticle: async () => ({ ok: true, status: 200, html }) }),
      { ...INPUT, quoteBefore: "Beta" },
    );
    expect(result.ok && result.anchorQuality).toBe("context");
    if (!result.ok) return;
    expect(getCorrectionByRef(db, result.ref)?.needsReview).toBe(true);
  });

  it("legt ein unbekanntes Outlet an, verweigert aber den Versand ohne Kontaktadresse", async () => {
    const result = await createCorrection(deps(), {
      ...INPUT,
      articleUrl: "https://neue-zeitung.de/a",
      idempotencyKey: "0123456789abcdef",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("no_recipient");
    expect(db.select().from(corrections).all()).toHaveLength(0);
  });

  it("meldet eine unbekannte Fehlerart", async () => {
    const result = await createCorrection(deps(), { ...INPUT, errorTypeKey: "gibt-es-nicht" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("unknown_error_type");
  });

  it("setzt bei Versandfehler failed, ohne den Datensatz zu verlieren", async () => {
    const failing: Mailer = { send: async () => ({ ok: false, error: "Relay verweigert" }) };
    const result = await createCorrection(deps({ mailer: failing }), INPUT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dispatchStatus).toBe("failed");

    const row = getCorrectionByRef(db, result.ref);
    expect(row?.sentAt).toBeNull();
    expect(row?.needsReview).toBe(true);
  });

  it("liest bei gleichzeitigen Anfragen mit gleichem Idempotency-Key den Gewinner, statt die Ref-Versuche zu verbrauchen", async () => {
    // Beide Anfragen bestehen die frühe Duplikatsprüfung (line ~80), weil keine von
    // beiden vor dem await auf fetchArticle bereits inserted hat. Die zweite
    // kollidiert danach beim Insert auf idempotency_key, nicht auf ref.
    const [first, second] = await Promise.all([
      createCorrection(deps(), INPUT),
      createCorrection(deps(), INPUT),
    ]);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    // Genau ein Datensatz, genau eine Mail (implizit: kein zweiter dispatchStatus).
    expect(db.select().from(corrections).all()).toHaveLength(1);
    expect(second.ref).toBe(first.ref);
    expect(second.id).toBe(first.id);
  });

  it("loggt bei einem unbehandelten Datenbankfehler keine Bind-Parameter (Empfänger, Zitat)", async () => {
    // Ein Trigger simuliert einen Datenbankfehler beim Insert, der keine der beiden
    // Unique-Constraints betrifft (z. B. "disk I/O error" in Wirklichkeit). Ohne
    // Absicherung haengt DrizzleQueryError query/params als eigene Eigenschaften an
    // den Fehler -- ein unbehandeltes console.error(err) gibt dann Empfaengeradresse
    // und Zitat aus (verifiziert vor der Änderung: exakt diese beiden Werte tauchten
    // im params-Array auf).
    db.$client.exec(
      "CREATE TRIGGER block_insert BEFORE INSERT ON corrections BEGIN SELECT RAISE(ABORT, 'simulierter Fehler'); END;",
    );
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(createCorrection(deps(), INPUT)).rejects.toThrow();

    expect(errSpy).toHaveBeenCalledTimes(1);
    const [loggedArg] = errSpy.mock.calls[0] ?? [];
    const logged = typeof loggedArg === "string" ? loggedArg : JSON.stringify(loggedArg);
    expect(logged).not.toContain("leserbriefe@beispiel-zeitung.de");
    expect(logged).not.toContain(INPUT.quoteBefore);
    expect(logged).not.toContain(INPUT.suggestionAfter);
    // Identifiziert den Fehlschlag trotzdem ausreichend fuer die Fehlersuche.
    expect(logged).toContain("insert correction");

    errSpy.mockRestore();
  });

  it("würfelt einen neuen ref, wenn der erste kollidiert", async () => {
    const folge = ["K7QW3M", "K7QW3M", "KAB2CD"];
    let index = 0;
    const makeRef = () => folge[index++] ?? "KZZZZZ";

    const first = await createCorrection(deps({ generateRef: makeRef }), INPUT);
    const second = await createCorrection(deps({ generateRef: makeRef }), {
      ...INPUT,
      idempotencyKey: "fedcba9876543210",
    });

    expect(first.ok && first.ref).toBe("K7QW3M");
    // Der zweite Versuch kollidiert, der dritte greift.
    expect(second.ok && second.ref).toBe("KAB2CD");
  });
});
