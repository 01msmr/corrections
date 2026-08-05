import { beforeEach, describe, expect, it } from "vitest";
import { createDb, runMigrations, type Db } from "../../db/client.js";
import { corrections } from "../../db/schema.js";
import { seed } from "../../db/seed.js";
import { backfillAdminRoutes } from "./backfill.js";

const NOW = 1_800_000_000;

let db: Db;

beforeEach(() => {
  db = createDb(":memory:");
  runMigrations(db);
  seed(db);
});

function entscheidung(messageId: string): string {
  return JSON.stringify({
    datei: `${messageId}.eml`,
    entscheidung: "uebernommen",
    felder: {
      ueberschrift: "Probeartikel",
      artikelUrl: "https://beispiel-zeitung.de/a",
      fehlerartKey: "zeichen_fehlt",
      anzahl: "2",
      zeichen: null,
      falsch: "Das Hs ist alt.",
      richtig: "Das Haus ist alt.",
    },
    messageId: `<${messageId}@beispiel.invalid>`,
    gesendetAm: "2024-01-05T10:00:00.000Z",
    empfaenger: "korrektur@beispiel-zeitung.de",
  });
}

async function hochladen(inhalt: string): Promise<Response> {
  const daten = new FormData();
  daten.append("datei", new File([inhalt], "review-entscheidungen.jsonl", { type: "application/jsonl" }));
  return backfillAdminRoutes(db, () => NOW).request("/admin/backfill", {
    method: "POST",
    body: daten,
  });
}

describe("Adminseite Altbestand", () => {
  it("zeigt das Hochladeformular", async () => {
    const res = await backfillAdminRoutes(db, () => NOW).request("/admin/backfill");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('type="file"');
    expect(html).toContain("enctype=\"multipart/form-data\"");
  });

  it("weist eine leere Übermittlung ab, ohne etwas anzulegen", async () => {
    const res = await backfillAdminRoutes(db, () => NOW).request("/admin/backfill", {
      method: "POST",
      body: new FormData(),
    });
    expect(res.status).toBe(400);
    expect(db.select().from(corrections).all()).toHaveLength(0);
  });

  it("importiert die hochgeladenen Entscheidungen", async () => {
    const res = await hochladen([entscheidung("a"), entscheidung("b")].join("\n"));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Übernommen");
    expect(db.select().from(corrections).all()).toHaveLength(2);
  });

  it("laesst einen zweiten Lauf wirkungslos", async () => {
    await hochladen(entscheidung("a"));
    await hochladen(entscheidung("a"));
    expect(db.select().from(corrections).all()).toHaveLength(1);
  });

  it("ueberspringt kaputte Zeilen und importiert den Rest", async () => {
    const res = await hochladen([entscheidung("a"), "{kaputt", entscheidung("b")].join("\n"));
    expect(res.status).toBe(200);
    await expect(res.text()).resolves.toContain("kein gültiges JSON");
    expect(db.select().from(corrections).all()).toHaveLength(2);
  });

  it("meldet eine Datei ohne brauchbaren Inhalt", async () => {
    const res = await hochladen("kein json\nauch nicht");
    expect(res.status).toBe(400);
    await expect(res.text()).resolves.toContain("keine lesbaren Entscheidungen");
  });
});
