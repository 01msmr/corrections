import { createId } from "@paralleldrive/cuid2";
import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, runMigrations, type Db } from "../../db/client.js";
import { corrections, errorTypes, outlets } from "../../db/schema.js";
import { seed } from "../../db/seed.js";
import type { Env } from "../../env.js";
import { createOutlet } from "../../repo/outlets.js";
import { meldungenRoutes } from "./meldungen.js";

const JETZT = 1_800_000_000;

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

const AUTH = `Basic ${Buffer.from("admin:geheimes-passwort").toString("base64")}`;

let db: Db;
let app: Hono;

function meldung(overrides: Partial<typeof corrections.$inferInsert> = {}): string {
  const id = createId();
  const outletId = db.select().from(outlets).all()[0]?.id;
  const errorTypeId = db.select().from(errorTypes).all()[0]?.id;
  if (!outletId || !errorTypeId) throw new Error("Stammdaten fehlen");
  db.insert(corrections)
    .values({
      id,
      ref: `K${id.slice(0, 5).toUpperCase()}`,
      idempotencyKey: id,
      createdAt: JETZT,
      dispatchMode: "smtp",
      articleUrl: "https://alpha-blatt.de/a",
      articleUrlCanon: "https://alpha-blatt.de/a",
      outletId,
      errorTypeId,
      severity: 2,
      quoteBefore: "Der Mietwgaen stand bereit.",
      suggestionAfter: "Der Mietwagen stand bereit.",
      recipientEmail: "korrektur@alpha-blatt.de",
      dispatchStatus: "sent",
      sentAt: JETZT,
      source: "web",
      ...overrides,
    })
    .run();
  return id;
}

beforeEach(() => {
  db = createDb(":memory:");
  runMigrations(db);
  seed(db);
  createOutlet(
    db,
    {
      name: "Alpha-Blatt",
      primaryDomain: "alpha-blatt.de",
      publisher: null,
      country: null,
      notes: null,
      contactEmails: [],
    },
    JETZT,
  );
  /* Absichtlich OHNE die /admin/*-Schicht aus app.ts montiert: der Router
     muss sich selbst sperren (Verteidigung in der Tiefe). */
  app = new Hono();
  app.route("/", meldungenRoutes({ db, env: ENV }));
});

describe("Zugriffsschutz", () => {
  it("sperrt alle Wege auch ohne die aeussere Auth-Schicht", async () => {
    const id = meldung();
    for (const [methode, pfad] of [
      ["GET", "/admin/meldungen"],
      ["GET", `/admin/meldungen/${id}`],
      ["POST", `/admin/meldungen/${id}/ausgang`],
    ] as const) {
      const res = await app.request(pfad, { method: methode });
      expect(res.status, `${methode} ${pfad}`).toBe(401);
    }
  });

  it("verbietet das Zwischenspeichern der Antworten", async () => {
    const res = await app.request("/admin/meldungen", { headers: { authorization: AUTH } });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

describe("Liste und Detail", () => {
  it("zeigt Nummer, Kennung und Ausgang; Filter wirken", async () => {
    meldung({ headline: "Mietwagen-Test" });
    const abgelehnt = meldung({ headline: "Zugausfall", outcome: "rejected", sentAt: JETZT + 10 });

    const liste = await (
      await app.request("/admin/meldungen", { headers: { authorization: AUTH } })
    ).text();
    expect(liste).toContain("Mietwagen-Test");
    expect(liste).toContain("ohne Rückmeldung");
    expect(liste).toContain("als richtig benannt");

    const gefiltert = await (
      await app.request("/admin/meldungen?ausgang=rejected", { headers: { authorization: AUTH } })
    ).text();
    expect(gefiltert).toContain("Zugausfall");
    expect(gefiltert).not.toContain("Mietwagen-Test");

    const detail = await (
      await app.request(`/admin/meldungen/${abgelehnt}`, { headers: { authorization: AUTH } })
    ).text();
    expect(detail).toContain("Der Mietwgaen stand bereit.");
    expect(detail).toContain("Der Mietwagen stand bereit.");
    expect(detail).toContain("Korrekturfahne:");
  });

  it("meldet Unbekanntes als 404", async () => {
    const res = await app.request("/admin/meldungen/fehlt", { headers: { authorization: AUTH } });
    expect(res.status).toBe(404);
  });
});

describe("Ausgang setzen", () => {
  it("schreibt Ausgang samt Daten und leitet aufs Detail zurueck", async () => {
    const id = meldung();
    const res = await app.request(`/admin/meldungen/${id}/ausgang`, {
      method: "POST",
      headers: {
        authorization: AUTH,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        ausgang: "corrected_other",
        antwortAm: "2026-08-10",
        korrigiertAm: "2026-08-12",
      }),
    });
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(`/admin/meldungen/${id}?gesetzt=1`);

    const zeile = db.select().from(corrections).all()[0];
    expect(zeile?.outcome).toBe("corrected_other");
    expect(zeile?.respondedAt).toBe(Math.floor(Date.parse("2026-08-10T12:00:00Z") / 1000));
    expect(zeile?.correctedAt).toBe(Math.floor(Date.parse("2026-08-12T12:00:00Z") / 1000));
  });

  it("weist unbekannte Ausgaenge ab", async () => {
    const id = meldung();
    const res = await app.request(`/admin/meldungen/${id}/ausgang`, {
      method: "POST",
      headers: { authorization: AUTH, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ ausgang: "erfunden" }),
    });
    expect(res.status).toBe(400);
  });
});
