import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { createDb, runMigrations } from "../db/client.js";
import { applyViews } from "../db/views.js";
import { seed } from "../db/seed.js";
import { createJsonMailer } from "../dispatch/send.js";
import type { Env } from "../env.js";

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

describe("GET /healthz", () => {
  it("antwortet mit 200 und Status ok", async () => {
    const res = await app().request("/healthz");
    expect(res.status).toBe(200);
    /* anstoss sagt, ob WORKER_TOKEN angekommen ist -- nie das Wort selbst. */
    await expect(res.json()).resolves.toEqual({ status: "ok", anstoss: "kein token" });
  });
});
