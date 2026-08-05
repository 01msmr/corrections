import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, runMigrations, type Db } from "../db/client.js";
import { corrections } from "../db/schema.js";
import { seed } from "../db/seed.js";
import { createJsonMailer } from "../dispatch/send.js";
import { resolveOutletByHost, updateOutlet } from "../repo/outlets.js";
import type { CreateDeps } from "../repo/corrections.js";
import { captureRoutes } from "./capture.js";

const NOW = 1_800_000_000;
const HTML = readFileSync(resolve(process.cwd(), "tests/fixtures/artikel-standard.html"), "utf8");

let db: Db;
let deps: CreateDeps;

beforeEach(() => {
  db = createDb(":memory:");
  runMigrations(db);
  seed(db);
  // seed() legt "beispiel-zeitung.de" bereits ohne Kontaktadresse an (DEFAULT_OUTLETS
  // in db/seed.ts); ein zweites createOutlet() fuer dieselbe Domain wuerde die
  // Unique-Constraint auf outlet_domains.domain verletzen (siehe repo/corrections.test.ts).
  // Stattdessen wird die Kontaktadresse auf dem vorhandenen Outlet nachgetragen.
  const seeded = resolveOutletByHost(db, "beispiel-zeitung.de");
  if (!seeded) throw new Error("Seed-Outlet fehlt");
  updateOutlet(db, seeded.id, {
    name: seeded.name,
    primaryDomain: seeded.primaryDomain,
    publisher: seeded.publisher,
    country: seeded.country,
    notes: seeded.notes,
    contactEmails: ["leserbriefe@beispiel-zeitung.de"],
  });
  deps = {
    db,
    mailer: createJsonMailer("korrektur@example.tld"),
    fetchArticle: async () => ({ ok: true, status: 200, html: HTML }),
    now: () => NOW,
    baseUrl: "https://korrektur.example.tld",
  };
});

function form(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  const fields: Record<string, string> = {
    idempotencyKey: "abcdef0123456789",
    articleUrl: "https://beispiel-zeitung.de/politik/artikel-123",
    headline: "",
    errorTypeKey: "falsche_zahl",
    severity: "2",
    quoteBefore: "rund 4,2 Millionen Menschen",
    suggestionAfter: "rund 2,4 Millionen Menschen",
    comment: "",
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

describe("GET /neu", () => {
  it("rendert das Formular mit allen Fehlerarten", async () => {
    const res = await captureRoutes(deps).request("/neu");
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('name="quoteBefore"');
    expect(html).toContain("ein Komma fehlt");
    expect(html).toMatch(/name="idempotencyKey" value="[a-z0-9]{16,}"/);
  });

  it("füllt URL und markierten Text aus der Abfrage vor", async () => {
    const res = await captureRoutes(deps).request(
      "/neu?url=https%3A%2F%2Fbeispiel-zeitung.de%2Fa&text=rund%204%2C2%20Millionen",
    );
    const html = await res.text();
    expect(html).toContain('value="https://beispiel-zeitung.de/a"');
    expect(html).toContain("rund 4,2 Millionen");
  });
});

describe("POST /neu/kategorie", () => {
  it("schlägt die erkannte Kategorie vor", async () => {
    const res = await captureRoutes(deps).request("/neu/kategorie", {
      method: "POST",
      body: new URLSearchParams({ falsch: "Der Hundd bellt.", richtig: "Der Hund bellt." }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ kategorie: "zeichen_zu_viel" });
  });

  it("liefert null, wenn nichts Sicheres erkennbar ist", async () => {
    const res = await captureRoutes(deps).request("/neu/kategorie", {
      method: "POST",
      body: new URLSearchParams({ falsch: "Ganz anderer Text.", richtig: "Voellig neue Fassung hier." }),
    });
    expect(await res.json()).toEqual({ kategorie: null });
  });
});

describe("POST /neu", () => {
  it("legt die Meldung an und bestätigt mit dem Referenz-Token", async () => {
    const res = await captureRoutes(deps).request("/neu", { method: "POST", body: form() });
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toMatch(/K[0-9A-HJKMNP-TV-Z]{5}/);
    expect(db.select().from(corrections).all()).toHaveLength(1);
  });

  it("zeigt Eingabefehler an, ohne zu speichern", async () => {
    const res = await captureRoutes(deps).request("/neu", {
      method: "POST",
      body: form({ quoteBefore: "" }),
    });
    expect(res.status).toBe(400);
    await expect(res.text()).resolves.toContain("quoteBefore");
    expect(db.select().from(corrections).all()).toHaveLength(0);
  });

  it("führt bei fehlender Kontaktadresse zu Impressum und Anlage-Formular", async () => {
    const res = await captureRoutes(deps).request("/neu", {
      method: "POST",
      body: form({ articleUrl: "https://neue-zeitung.de/a" }),
    });
    expect(res.status).toBe(400);
    const html = await res.text();

    expect(html).toContain("neue-zeitung.de");
    // Impressum in neuem Tab, mit noopener gegen Zugriff auf das Ursprungsfenster.
    expect(html).toContain('href="https://neue-zeitung.de/impressum"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    // Anlage-Formular mit vorbefüllter Domain und Rückweg.
    expect(html).toContain("/admin/redaktionen?domain=neue-zeitung.de");
    expect(html).toContain("zurueck=");
  });

  it("warnt, wenn die Fundstelle nicht verankert werden konnte", async () => {
    const res = await captureRoutes({
      ...deps,
      fetchArticle: async () => ({ ok: false, status: 403, reason: "http" }),
    }).request("/neu", { method: "POST", body: form() });
    await expect(res.text()).resolves.toContain("konnte nicht im Artikel verankert werden");
  });
});
