import { beforeEach, describe, expect, it } from "vitest";
import { createDb, runMigrations, type Db } from "../db/client.js";
import { corrections } from "../db/schema.js";
import { seed } from "../db/seed.js";
import { importiereEntscheidungen, type ReviewEntscheidung } from "./backfillImport.js";

const NOW = 1_800_000_000;

let db: Db;

beforeEach(() => {
  db = createDb(":memory:");
  runMigrations(db);
  seed(db);
});

function entscheidung(overrides: Partial<ReviewEntscheidung> = {}): ReviewEntscheidung {
  return {
    datei: "1-1.eml",
    entscheidung: "uebernommen",
    felder: {
      ueberschrift: "Probeartikel",
      artikelUrl: "https://beispiel-zeitung.de/politik/artikel-1",
      fehlerartKey: "zeichen_fehlt",
      anzahl: "2",
      zeichen: null,
      falsch: "Das Hs ist alt.",
      richtig: "Das Haus ist alt.",
    },
    messageId: "<alt-1@beispiel.invalid>",
    gesendetAm: "2024-01-05T10:00:00.000Z",
    empfaenger: "korrektur@beispiel-zeitung.de",
    ...overrides,
  };
}

describe("importiereEntscheidungen", () => {
  it("legt aus einer uebernommenen Entscheidung einen Backfill-Datensatz an", () => {
    const ergebnis = importiereEntscheidungen(db, [entscheidung()], NOW);
    expect(ergebnis).toEqual({ uebernommen: 1, uebersprungen: 0, nichtUebernommen: 0, fehler: [] });

    const zeile = db.select().from(corrections).all()[0];
    expect(zeile).toBeDefined();
    expect(zeile?.source).toBe("backfill");
    expect(zeile?.dispatchStatus).toBe("sent");
    expect(zeile?.sentAt).toBe(Math.floor(Date.parse("2024-01-05T10:00:00.000Z") / 1000));
    expect(zeile?.errorCount).toBe(2);
    expect(zeile?.messageId).toBe("<alt-1@beispiel.invalid>");
    expect(zeile?.anchorQuality).toBe("none");
    expect(zeile?.verification).toBe("none");
    expect(zeile?.needsReview).toBe(false);
  });

  it("ist idempotent ueber die Message-ID und ueberspringt Verworfenes", () => {
    importiereEntscheidungen(db, [entscheidung()], NOW);
    const zweiter = importiereEntscheidungen(
      db,
      [entscheidung(), { datei: "2-2.eml", entscheidung: "verworfen" }],
      NOW,
    );
    expect(zweiter).toEqual({ uebernommen: 0, uebersprungen: 1, nichtUebernommen: 1, fehler: [] });
    expect(db.select().from(corrections).all()).toHaveLength(1);
  });

  it("meldet fehlende Pflichtfelder statt zu raten", () => {
    const kaputt = entscheidung();
    if (kaputt.felder) kaputt.felder.artikelUrl = null;
    const ergebnis = importiereEntscheidungen(db, [kaputt], NOW);
    expect(ergebnis.fehler).toHaveLength(1);
    expect(db.select().from(corrections).all()).toHaveLength(0);
  });

  it("uebernimmt das konkrete Satzzeichen", () => {
    const komma = entscheidung();
    if (komma.felder) {
      komma.felder.fehlerartKey = "komma_zu_viel";
      komma.felder.anzahl = "1";
      komma.felder.zeichen = ",";
      komma.felder.falsch = "Er kam, und ging.";
      komma.felder.richtig = "Er kam und ging.";
    }
    importiereEntscheidungen(db, [komma], NOW);
    expect(db.select().from(corrections).all()[0]?.errorChar).toBe(",");
  });
});
