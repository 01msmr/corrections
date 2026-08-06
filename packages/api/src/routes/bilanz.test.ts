import { MATURITY_SECONDS } from "@korrektur/shared";
import { createId } from "@paralleldrive/cuid2";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, runMigrations, type Db } from "../db/client.js";
import { articleChecks, corrections, errorTypes, outlets } from "../db/schema.js";
import { seed } from "../db/seed.js";
import { bilanzRoutes } from "./bilanz.js";

const JETZT = 1_800_000_000;
const ALT = JETZT - MATURITY_SECONDS - 86_400;

/** Seiteninhalt ohne das eingebettete Stylesheet: dessen Kommentare und
 *  Mischungsangaben („80 % Schwarz") gehören nicht zum sichtbaren Text. */
function ohneStil(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/g, "");
}

let db: Db;

beforeEach(() => {
  db = createDb(":memory:");
  runMigrations(db);
  seed(db);
});

function meldung(anzahl: number): void {
  const outletId = db.select().from(outlets).all()[0]?.id;
  const errorTypeId = db.select().from(errorTypes).all()[0]?.id;
  if (!outletId || !errorTypeId) throw new Error("Seed unvollstaendig");
  for (let i = 0; i < anzahl; i++) {
    const id = createId();
    db.insert(corrections)
      .values({
        id,
        ref: `K${i}${id.slice(0, 4).toUpperCase()}`,
        idempotencyKey: id,
        createdAt: ALT,
        dispatchMode: "smtp",
        articleUrl: "https://beispiel-zeitung.de/a",
        articleUrlCanon: "https://beispiel-zeitung.de/a",
        outletId,
        errorTypeId,
        severity: 2,
        quoteBefore: "falsch",
        suggestionAfter: "richtig",
        recipientEmail: "korrektur@beispiel-zeitung.de",
        dispatchStatus: "sent",
        sentAt: ALT,
        source: "backfill",
      })
      .run();
  }
}

describe("GET /bilanz", () => {
  it("ist ohne Anmeldung erreichbar und nennt den Methodik-Abschnitt", async () => {
    const res = await bilanzRoutes(db, () => JETZT).request("/bilanz");
    expect(res.status).toBe(200);
    await expect(res.text()).resolves.toContain("Was diese Zahlen nicht sagen");
  });

  it("meldet einen leeren Bestand, statt Nullen zu behaupten", async () => {
    const html = await (await bilanzRoutes(db, () => JETZT).request("/bilanz")).text();
    expect(html).toContain("Noch nichts erfasst");
    // Der Kennzahlen-Block bleibt ganz weg; "Korrekturquote" kommt im
    // Methodik-Text trotzdem vor, deshalb wird auf den Abschnitt geprueft.
    expect(html).not.toContain("Was daraus wurde");
    // Auf das Markup pruefen, nicht auf den Klassennamen: der steht ohnehin
    // im mitgelieferten Stylesheet.
    expect(html).not.toContain('<span class="kennzahl-titel">');
  });

  it("zeigt Rohzahlen und keine Quote, solange die Fallzahl zu klein ist", async () => {
    meldung(3);
    const html = await (await bilanzRoutes(db, () => JETZT).request("/bilanz")).text();
    expect(html).toContain("Was daraus wurde");
    expect(html).toContain("noch keine Aussage");
    // Bei n = 3 darf nirgends ein Prozentwert stehen.
    expect(ohneStil(html)).not.toMatch(/\d+ %/);
  });

  it("behauptet ohne Artikel-Pruefung keine Korrekturquote von 0 %", async () => {
    meldung(12);
    const html = await (await bilanzRoutes(db, () => JETZT).request("/bilanz")).text();
    expect(html).toContain("noch kein Artikel nachgeprüft");
    expect(html).toContain("noch kein Postfach-Abgleich gelaufen");
    expect(ohneStil(html)).not.toMatch(/\d+ %/);
  });

  it("rechnet die Quote, sobald genug geprueft wurde, und nennt sie nie ohne ihr n", async () => {
    meldung(12);
    for (const zeile of db.select().from(corrections).all()) {
      db.insert(articleChecks)
        .values({
          id: createId(),
          correctionId: zeile.id,
          checkedAt: ALT + 100,
          quoteState: "unchanged",
        })
        .run();
    }
    const html = await (await bilanzRoutes(db, () => JETZT).request("/bilanz")).text();
    expect(html).toContain("0 %");
    expect(html).toContain("0 von 12");
  });

  it("weist die Medien alphabetisch aus und ordnet die Zahl ein", async () => {
    meldung(2);
    const html = await (await bilanzRoutes(db, () => JETZT).request("/bilanz")).text();
    expect(html).toContain("Beispiel-Zeitung");
    expect(html).toContain("wo viel gelesen und gemeldet wurde");
  });
});
