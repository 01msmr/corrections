import { createId } from "@paralleldrive/cuid2";
import { Hono } from "hono";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, runMigrations, type Db } from "../../db/client.js";
import { articleChecks, corrections, errorTypes, outlets, responseEvents } from "../../db/schema.js";
import { seed } from "../../db/seed.js";
import type { Env } from "../../env.js";
import { PALETTE } from "@korrektur/shared";
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
    /* Wie in der Mail: Fehlstelle hell auf Karmin bzw. Gruen, der Teilsatz
       darum fett. */
    expect(detail).toContain(
      `background:${PALETTE.korrektur};color:${PALETTE.papier};font-weight:700;padding:1px 4px">Mietwgaen</span>`,
    );
    expect(detail).toContain(
      `background:${PALETTE.vorschlag};color:${PALETTE.papier};font-weight:700;padding:1px 4px">Mietwagen</span>`,
    );
    expect(detail).toMatch(/<strong style="font-weight:700">[^<]*stand bereit\./);
    expect(detail).toContain("Korrekturfahne:");
  });

  it("meldet Unbekanntes als 404", async () => {
    const res = await app.request("/admin/meldungen/fehlt", { headers: { authorization: AUTH } });
    expect(res.status).toBe(404);
  });
});

describe("Blaettern", () => {
  it("zeigt die aktive Seite eingedrueckt und ohne Link", async () => {
    for (let i = 0; i < 202; i++) meldung({ sentAt: JETZT + i });
    const html = await (
      await app.request("/admin/meldungen?seite=2", { headers: { authorization: AUTH } })
    ).text();
    expect(html).toContain('class="seitenblaettern"');
    expect(html).toContain('<span class="seitenknopf-aktiv" aria-current="page">2</span>');
    expect(html).not.toContain('">2</a>');
    expect(html).toContain(">zurück</a>");
    expect(html).toContain(">vor</a>");
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

describe("Ausgang im Detail", () => {
  it("nimmt bei fehlendem Korrekturdatum den Tag der Antwort", async () => {
    const id = meldung();
    const antwort = await app.request(`/admin/meldungen/${id}/ausgang`, {
      method: "POST",
      headers: { authorization: AUTH, "content-type": "application/x-www-form-urlencoded" },
      body: "ausgang=corrected&antwortAm=2026-07-30",
    });
    expect(antwort.status).toBe(303);
    expect(antwort.headers.get("location")).toContain("datum=1");

    const zeile = db.select().from(corrections).all().find((c) => c.id === id);
    expect(zeile?.correctedAt).toBe(zeile?.respondedAt);
    /* Erst damit zaehlt die Korrekturquote den Fall. */
    expect(zeile?.verification).toBe("manual");
  });

  it("laesst ohne Korrektur-Ausgang alles wie eingetragen", async () => {
    const id = meldung();
    await app.request(`/admin/meldungen/${id}/ausgang`, {
      method: "POST",
      headers: { authorization: AUTH, "content-type": "application/x-www-form-urlencoded" },
      body: "ausgang=rejected&antwortAm=2026-07-30",
    });
    const zeile = db.select().from(corrections).all().find((c) => c.id === id);
    expect(zeile?.correctedAt).toBeNull();
    expect(zeile?.verification).toBe("none");
  });
});

describe("Ausgangs-Abgleich", () => {
  /** Meldung mit Antwort und Pruefbefund, wie der Abgleich sie erwartet. */
  function mitBelegen(
    auszug: string,
    befund: "changed_as_suggested" | "unchanged",
    sicherheit = 100,
    ankerguete: "exact" | "context" | "none" = "exact",
  ): string {
    const id = meldung({ outcome: "acknowledged", respondedAt: JETZT, anchorQuality: ankerguete });
    db.insert(responseEvents)
      .values({
        id: createId(),
        correctionId: id,
        kind: "reply",
        receivedAt: JETZT,
        rawMessageId: createId(),
        fromAddr: "leserservice@alpha-blatt.de",
        excerpt: auszug,
      })
      .run();
    db.insert(articleChecks)
      .values({
        id: createId(),
        correctionId: id,
        checkedAt: JETZT + 1000,
        httpStatus: 200,
        quoteState: befund,
        matchConfidence: sicherheit,
      })
      .run();
    return id;
  }

  it("nimmt nur auf, wo Antwort und Pruefung dasselbe sagen", async () => {
    const doppelt = mitBelegen("Wir haben den Fehler korrigiert.", "changed_as_suggested");
    mitBelegen("Wir haben Ihren Hinweis erhalten.", "changed_as_suggested");
    mitBelegen("Wir haben den Fehler korrigiert.", "unchanged");
    const antwort = await app.request("/admin/abgleich", { headers: { authorization: AUTH } });
    expect(antwort.status).toBe(200);
    const html = await antwort.text();
    expect(html).toContain("1 von 1");
    expect(html).toContain(`/admin/abgleich/${doppelt}`);
  });

  it("setzt den Ausgang und nimmt den Fall aus der Liste", async () => {
    const id = mitBelegen("Wir haben den Fehler korrigiert.", "changed_as_suggested");

    const gesetzt = await app.request(`/admin/abgleich/${id}?stelle=0`, {
      method: "POST",
      headers: { authorization: AUTH },
    });
    expect(gesetzt.status).toBe(303);

    const zeile = db.select().from(corrections).all().find((c) => c.id === id);
    expect(zeile?.outcome).toBe("corrected");
    /* Das Datum der Antwort, nicht das der Pruefung (JETZT + 1000). */
    expect(zeile?.correctedAt).toBe(JETZT);
    expect(zeile?.respondedAt).toBe(JETZT);
    /* Ohne die manuelle Bestaetigung zaehlt die Korrekturquote den Fall
       nicht -- die Kennzahlen-Views verlangen Datum UND verification. */
    expect(zeile?.verification).toBe("manual");

    const danach = await app.request("/admin/abgleich", { headers: { authorization: AUTH } });
    expect(await danach.text()).toContain("keine Meldung");
  });

  it("trennt Belegmarke und Satz mit einem Leerzeichen", async () => {
    mitBelegen("Wir haben den Fehler korrigiert.", "changed_as_suggested");
    const html = await (
      await app.request("/admin/abgleich", { headers: { authorization: AUTH } })
    ).text();
    /* Ohne das kleben Datum und Satz beim Kopieren und im Vorlesen aneinander. */
    for (const marke of html.matchAll(/class="belegmarke">.*?<\/span>(.)/g)) {
      expect(marke[1]).toBe(" ");
    }
    expect(html).toContain("</span> Fundstelle");
  });

  /* Ohne Anker ist der Rueckfall nicht die schwaechere, sondern die einzig
     moegliche Methode -- der Fall gehoert in die Warteschlange, benannt. */
  it("nimmt den Altbestand ohne Anker auf und benennt ihn", async () => {
    mitBelegen("Wir haben den Fehler korrigiert.", "changed_as_suggested", 50, "none");
    const html = await (
      await app.request("/admin/abgleich", { headers: { authorization: AUTH } })
    ).text();
    expect(html).toContain("1 von 1");
    expect(html).toContain("keine Anker");
  });

  it("benennt gerissene Anker als solche", async () => {
    mitBelegen("Wir haben den Fehler korrigiert.", "changed_as_suggested", 50, "exact");
    const html = await (
      await app.request("/admin/abgleich", { headers: { authorization: AUTH } })
    ).text();
    expect(html).toContain("greifen aber nicht mehr");
  });

  it("erklaert die leere Warteschlange mit Zahlen", async () => {
    /* Beide fallen durch: der eine am Befund, der andere am Wortlaut. */
    mitBelegen("Wir haben den Fehler korrigiert.", "unchanged");
    mitBelegen("Wir haben Ihren Hinweis erhalten.", "changed_as_suggested");

    const html = await (
      await app.request("/admin/abgleich", { headers: { authorization: AUTH } })
    ).text();
    expect(html).toContain("Nichts abzugleichen");
    const zahl = (zeile: string): string =>
      html.split(zeile)[1]?.match(/<td>(\d+)<\/td>/)?.[1] ?? "";
    expect(zahl("Antwort erhalten")).toBe("2");
    expect(zahl("nennt die Antwort eine Korrektur")).toBe("1");
    expect(zahl("Anker gegriffen")).toBe("0");
    expect(zahl("ohne greifende Anker")).toBe("0");
    expect(zahl("anderer Befund")).toBe("1");
    expect(zahl("Stelle unverändert")).toBe("1");
    expect(zahl("Bezahlschranke")).toBe("0");
  });

  it("legt in der offenen Schlange auch das Widersprechende vor", async () => {
    /* Kein Doppelbeleg: Pruefung sagt unveraendert, Antwort sagt korrigiert. */
    mitBelegen("Wir haben den Fehler korrigiert.", "unchanged");
    const eng = await (
      await app.request("/admin/abgleich", { headers: { authorization: AUTH } })
    ).text();
    expect(eng).toContain("Nichts abzugleichen");

    const html = await (
      await app.request("/admin/abgleich?alle=1", { headers: { authorization: AUTH } })
    ).text();
    expect(html).toContain("1 von 1");
    expect(html).toContain("die Antwort sagt etwas anderes");
    expect(html).toContain("als richtig benannt");
  });

  it("setzt in der offenen Schlange den gewaehlten Ausgang", async () => {
    const id = mitBelegen("Wir bleiben bei unserer Fassung.", "unchanged");
    const antwort = await app.request(`/admin/abgleich/${id}?stelle=0&alle=1`, {
      method: "POST",
      headers: { authorization: AUTH, "content-type": "application/x-www-form-urlencoded" },
      body: "ausgang=rejected",
    });
    expect(antwort.status).toBe(303);

    const zeile = db.select().from(corrections).all().find((c) => c.id === id);
    expect(zeile?.outcome).toBe("rejected");
    /* Keine Korrektur, also kein Korrekturdatum und keine Bestaetigung. */
    expect(zeile?.correctedAt).toBeNull();
    expect(zeile?.verification).toBe("none");
  });

  it("haelt die neue Fassung fest und warnt ohne Beleg", async () => {
    const id = mitBelegen("Wir haben das bereits korrigiert.", "unchanged");
    const html = await (
      await app.request("/admin/abgleich?alle=1", { headers: { authorization: AUTH } })
    ).text();
    expect(html).toContain("Höflichkeitsformel");

    await app.request(`/admin/abgleich/${id}?stelle=0&alle=1`, {
      method: "POST",
      headers: { authorization: AUTH, "content-type": "application/x-www-form-urlencoded" },
      body: "ausgang=corrected_other&korrigierterText=entscheiden%20k%C3%B6nnen%20wird.",
    });
    const zeile = db.select().from(corrections).all().find((c) => c.id === id);
    expect(zeile?.outcome).toBe("corrected_other");
    expect(zeile?.correctedText).toBe("entscheiden können wird.");
  });

  it("sperrt auch den Abgleich ohne Auth", async () => {
    expect((await app.request("/admin/abgleich")).status).toBe(401);
  });
});
