import { beforeEach, describe, expect, it } from "vitest";
import { createDb, runMigrations, type Db } from "../db/client.js";
import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { corrections, errorTypes, outlets } from "../db/schema.js";
import { seed } from "../db/seed.js";
import {
  ergaenzeKontaktadressen,
  importiereEntscheidungen,
  type ReviewEntscheidung,
} from "./backfillImport.js";

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

  it("laesst bestehende Meldungen anderer Herkunft unberuehrt", () => {
    // Eine Meldung, wie sie ueber das Formular entsteht — der Import darf sie
    // weder aendern noch loeschen (§11.5: er ergaenzt, er ersetzt nicht).
    const bestand = createId();
    db.insert(corrections)
      .values({
        id: bestand,
        ref: "KWEB01",
        idempotencyKey: "web-vorhanden",
        createdAt: NOW,
        dispatchMode: "smtp",
        articleUrl: "https://beispiel-zeitung.de/live",
        articleUrlCanon: "https://beispiel-zeitung.de/live",
        outletId: db.select().from(outlets).all()[0]?.id ?? "",
        errorTypeId: db.select().from(errorTypes).all()[0]?.id ?? "",
        severity: 2,
        quoteBefore: "aus dem Formular",
        suggestionAfter: "unveraendert",
        recipientEmail: "redaktion@beispiel-zeitung.de",
        dispatchStatus: "sent",
        sentAt: NOW,
        source: "web",
      })
      .run();

    importiereEntscheidungen(db, [entscheidung()], NOW);

    const alle = db.select().from(corrections).all();
    expect(alle).toHaveLength(2);
    const unveraendert = alle.find((zeile) => zeile.id === bestand);
    expect(unveraendert?.source).toBe("web");
    expect(unveraendert?.quoteBefore).toBe("aus dem Formular");
    expect(unveraendert?.ref).toBe("KWEB01");
  });

  it("traegt Medien ohne Adresse die zuletzt benutzte nach", () => {
    // Zweimal an die alte Adresse, danach einmal an die neue: Die juengste
    // gewinnt, auch wenn die alte oefter vorkommt.
    const mail = (nr: number, adresse: string, datum: string): ReviewEntscheidung => {
      const eintrag = entscheidung({ datei: `${nr}.eml`, messageId: `<m${nr}@x.invalid>` });
      eintrag.empfaenger = adresse;
      eintrag.gesendetAm = datum;
      if (eintrag.felder) eintrag.felder.artikelUrl = `https://beispiel-zeitung.de/a${nr}`;
      return eintrag;
    };
    importiereEntscheidungen(
      db,
      [
        mail(1, "alt@beispiel-zeitung.de", "2024-01-05T10:00:00.000Z"),
        mail(2, "alt@beispiel-zeitung.de", "2024-03-05T10:00:00.000Z"),
        mail(3, "neu@beispiel-zeitung.de", "2025-11-05T10:00:00.000Z"),
      ],
      NOW,
    );

    expect(ergaenzeKontaktadressen(db)).toBeGreaterThan(0);
    const outlet = db.select().from(outlets).all().find((o) => o.primaryDomain === "beispiel-zeitung.de");
    expect(outlet?.contactEmails).toEqual(["neu@beispiel-zeitung.de"]);
  });

  it("laesst eine gepflegte Adresse unangetastet", () => {
    importiereEntscheidungen(db, [entscheidung()], NOW);
    const outlet = db.select().from(outlets).all().find((o) => o.primaryDomain === "beispiel-zeitung.de");
    if (!outlet) throw new Error("Outlet fehlt");
    db.update(outlets)
      .set({ contactEmails: ["von-hand@beispiel-zeitung.de"] })
      .where(eq(outlets.id, outlet.id))
      .run();

    ergaenzeKontaktadressen(db);
    const danach = db.select().from(outlets).all().find((o) => o.id === outlet.id);
    expect(danach?.contactEmails).toEqual(["von-hand@beispiel-zeitung.de"]);
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
