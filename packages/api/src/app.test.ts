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
