import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { createDb, runMigrations } from "./db/client.js";
import { applyViews } from "./db/views.js";
import { seed } from "./db/seed.js";
import { createJsonMailer } from "./dispatch/send.js";
import type { Env } from "./env.js";

const ENV = {
  PORT: 3000,
  DATABASE_PATH: ":memory:",
  ADMIN_USER: "admin",
  ADMIN_PASSWORD: "geheimes-passwort",
  PUBLIC_BASE_URL: "https://korrekturen.msmr.co",
  SMTP_HOST: "mail.example.tld",
  SMTP_PORT: 587,
  SMTP_USER: "korrektur@example.tld",
  SMTP_PASSWORD: "x",
  MAIL_FROM: "korrektur@example.tld",
} satisfies Env;

function app() {
  const db = createDb(":memory:");
  runMigrations(db);
  applyViews(db);
  seed(db);
  return createApp({
    env: ENV,
    db,
    mailer: createJsonMailer(ENV.MAIL_FROM),
    fetchArticle: async () => ({ ok: false, status: null, reason: "network" }),
    now: () => 1_800_000_000,
  });
}

const AUTH = `Basic ${Buffer.from("admin:geheimes-passwort").toString("base64")}`;

describe("App-Verdrahtung", () => {
  it("lässt den Healthcheck ohne Anmeldung durch", async () => {
    const res = await app().request("/healthz");
    expect(res.status).toBe(200);
  });

  it("schützt das Erfassungsformular", async () => {
    expect((await app().request("/neu")).status).toBe(401);
    expect((await app().request("/neu", { headers: { authorization: AUTH } })).status).toBe(200);
  });

  it("schützt beide Adminbereiche", async () => {
    expect((await app().request("/admin/redaktionen")).status).toBe(401);
    expect((await app().request("/admin/fehlerarten")).status).toBe(401);
    // Das Backfill-Werkzeug schreibt in die Datenbank — erst recht geschützt,
    // auch beim Hochladen.
    expect((await app().request("/admin/backfill")).status).toBe(401);
    expect((await app().request("/admin/backfill", { method: "POST" })).status).toBe(401);
    expect(
      (await app().request("/admin/fehlerarten", { headers: { authorization: AUTH } })).status,
    ).toBe(200);
  });

  it("gibt ohne Anmeldung nirgends im Adminbereich Inhalte heraus", async () => {
    // Der Praefixabgleich /admin/* deckt den Pfad ohne Schraegstrich nicht ab,
    // und Hono unterscheidet Gross- und Kleinschreibung. Beides darf nicht dazu
    // fuehren, dass eine Seite ohne Anmeldung ausgeliefert wird.
    for (const pfad of [
      "/admin",
      "/admin/",
      "/admin/redaktionen",
      "/ADMIN/redaktionen",
      "/admin/fehlerarten",
      "/admin/gibt-es-nicht",
    ]) {
      const res = await app().request(pfad);
      expect(res.status).not.toBe(200);
    }
  });

  it("zeigt auf der Wurzel die öffentliche Startseite", async () => {
    const res = await app().request("/");
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("In eigener Sache");
    expect(html).toContain("Textfehler");
  });
});

describe("Hybrid-Ressort Neue Korrektur", () => {
  it("setzt das Betreiber-Cookie nur nach erfolgreichem Admin-Zugriff", async () => {
    const a = app();
    const abgewiesen = await a.request("/neu");
    expect(abgewiesen.headers.get("set-cookie")).toBeNull();
    const erlaubt = await a.request("/neu", { headers: { authorization: AUTH } });
    expect(erlaubt.headers.get("set-cookie")).toContain("betreiber=1");
  });

  it("verlinkt Besucher auf /hinweis, Betreiber auf /neu", async () => {
    const a = app();
    const besucher = await (await a.request("/bilanz")).text();
    expect(besucher).toContain('href="/hinweis"');
    expect(besucher).not.toContain('href="/neu"');
    const betreiber = await (
      await a.request("/bilanz", { headers: { cookie: "betreiber=1" } })
    ).text();
    expect(betreiber).toContain('href="/neu"');
  });

  it("laesst das Besucher-Formular ohne Anmeldung durch", async () => {
    const a = app();
    expect((await a.request("/hinweis")).status).toBe(200);
    const html = await (await a.request("/hinweis")).text();
    expect(html).toContain('action="/hinweis/vorschau"');
  });

  it("liefert Besuchern eine Vorschau mit mailto statt Senden-Knopf und schreibt nichts", async () => {
    const a = app();
    const form = new URLSearchParams({
      idempotencyKey: "egal-aber-lang-genug",
      articleUrl: "https://beispiel-zeitung.de/politik/artikel-1",
      quoteBefore: "ein Fehler",
      suggestionAfter: "kein Fehler",
      errorTypeKey: "komma_fehlt",
      severity: "2",
    });
    const res = await a.request("/hinweis/vorschau", {
      method: "POST",
      body: form,
      headers: { "content-type": "application/x-www-form-urlencoded" },
    });
    expect(res.status).toBe(200);
    const html = await res.text();
    // Kein Medium zur Domain hinterlegt: der Hinweis faellt auf MAIL_FROM zurueck.
    expect(html).toContain(`mailto:${ENV.MAIL_FROM}?subject=`);
    expect(html).toContain("Im Mail-Programm öffnen");
    expect(html).not.toContain("Korrektur senden");
    // Ohne Kennung: kein "Kennung stehen lassen"-Satz und kein [VORSCHAU]-Token.
    expect(html).not.toContain("Lassen Sie die Kennung");
    expect(html).not.toContain("[VORSCHAU]");
  });
});
