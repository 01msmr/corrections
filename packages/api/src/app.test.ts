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

type FetchArticle = Parameters<typeof createApp>[0]["fetchArticle"];

function app(ueber: { fetchArticle?: FetchArticle } = {}) {
  const db = createDb(":memory:");
  runMigrations(db);
  applyViews(db);
  seed(db);
  return createApp({
    env: ENV,
    db,
    mailer: createJsonMailer(ENV.MAIL_FROM),
    fetchArticle: ueber.fetchArticle ?? (async () => ({ ok: false, status: null, reason: "network" })),
    now: () => 1_800_000_000,
  });
}

/** Eine Seite, die den Abruf beantwortet, aber statt des Textes Abo-Werbung zeigt. */
const BEZAHLSCHRANKE_HTML = `<html><body><article>
<h1>Missliche Plakatwerbung des Spitzenkandidaten</h1>
<p>Diesen Artikel weiterlesen mit SPIEGEL+. Sie haben bereits ein Digital-Abo?
Zum Login. Nur für Neukunden: vier Wochen für einen Euro, danach fünf Euro
pro Woche. Jederzeit kündbar.</p>
</article></body></html>`;

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
    expect(html).toContain("Im Mail-Programm senden");
    expect(html).not.toContain("Korrektur senden");
    // Ohne Kennung: kein "Kennung stehen lassen"-Satz und kein [VORSCHAU]-Token.
    expect(html).not.toContain("Lassen Sie die Kennung");
    expect(html).not.toContain("[VORSCHAU]");
  });
});

describe("Base64-Vorbefuellung (?b=)", () => {
  it("entpackt url und text aus dem b-Parameter", async () => {
    const nutzlast = JSON.stringify({
      u: "https://beispiel.de/artikel",
      t: "Wer nicht aufpasst, könnte Daten hinterlassen.",
    });
    const b64 = Buffer.from(nutzlast, "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const html = await (await app().request(`/hinweis?b=${b64}`)).text();
    expect(html).toContain('value="https://beispiel.de/artikel"');
    expect(html).toContain("Wer nicht aufpasst, könnte Daten hinterlassen.");
  });

  it("ignoriert unlesbare b-Parameter, statt zu scheitern", async () => {
    expect((await app().request("/hinweis?b=%%%kaputt")).status).toBe(200);
  });

  it("nimmt die markierte Stelle als q entgegen (App-Weg)", async () => {
    /* base64url, weil Anfuehrungszeichen in Zitaten die Regel sind -- als
       JSON zusammengesetzt zerbraeche daran die Vorbefuellung, und
       prozentkodiert loest die "URL oeffnen"-Aktion sie wieder auf. */
    const stelle = 'Er sagte: "Der Mietwgaen steht bereit."\nUnd ging.';
    const q = Buffer.from(stelle, "utf8").toString("base64url");
    const html = await (
      await app().request(`/hinweis?url=${encodeURIComponent("https://www.spiegel.de/a-1.html")}&q=${q}`)
    ).text();
    /* Vorbefuellt steht die kanonische Adresse: ohne www. */
    expect(html).toContain('value="https://spiegel.de/a-1.html"');
    expect(html).toContain("Der Mietwgaen steht bereit.");
  });

  it("kuerzt die vorbefuellte Adresse auf die kanonische Form ohne Abfrage", async () => {
    /* Die SPIEGEL-App haengt beim Teilen ?sara_ref=… an. Der Kurzbefehl soll
       das nicht selbst wegschneiden muessen -- die Logik liegt im Server.
       Gekappt wird alles ab dem "?", nicht nur bekannte Tracker. */
    const geteilt = "https://www.spiegel.de/politik/artikel-a-ba1a07ac?sara_ref=re-so-app-sh";
    const html = await (
      await app().request(`/hinweis?url=${encodeURIComponent(geteilt)}`)
    ).text();
    expect(html).toContain('value="https://spiegel.de/politik/artikel-a-ba1a07ac"');
    expect(html).not.toContain("sara_ref");

    const mitAbfrage = "https://beispiel.de/artikel?id=7&x=1";
    const html2 = await (
      await app().request(`/hinweis?url=${encodeURIComponent(mitAbfrage)}`)
    ).text();
    expect(html2).toContain('value="https://beispiel.de/artikel"');
  });

  it("glaettet doppelte Leerzeichen in der Fundstelle", async () => {
    /* Verlinkungssymbole im Artikel verschwinden im Reintext und
       hinterlassen doppelte Leerzeichen. */
    const stelle = "Regierungschef  eines Bundeslands";
    const q = Buffer.from(stelle, "utf8").toString("base64url");
    const html = await (await app().request(`/hinweis?url=https://x.test/a&q=${q}`)).text();
    expect(html).toContain("Regierungschef eines Bundeslands");
    expect(html).not.toContain("Regierungschef  eines");
  });

  it("verwirft RTF aus der Zwischenablage, statt es ins Feld zu stellen", async () => {
    /* Apps legen Kopiertes oft als Rich Text ab; ein Kurzbefehl ohne
       Text-Umwandlung schickt dann RTF-Quelltext. Der nuetzt niemandem. */
    const rtf = "{\\rtf1\\ansi\\ansicpg1252 Der eigentliche Satz}";
    const q = Buffer.from(rtf, "utf8").toString("base64url");
    const html = await (await app().request(`/hinweis?url=https://x.test/a&q=${q}`)).text();
    expect(html).toMatch(/id="quoteBefore"[^>]*><\/textarea>/);
  });

  it("laesst ohne q die Fundstelle leer -- die Adresse steht trotzdem", async () => {
    const html = await (
      await app().request("/hinweis?url=" + encodeURIComponent("https://www.spiegel.de/a-1.html"))
    ).text();
    expect(html).toContain('value="https://spiegel.de/a-1.html"');
    expect(html).toMatch(/id="quoteBefore"[^>]*><\/textarea>/);
  });

  it("laesst b vor url gelten, wenn beides mitkommt", async () => {
    const b64 = Buffer.from(JSON.stringify({ u: "https://aus-b.test/x", t: "Fundstelle" }), "utf8")
      .toString("base64url");
    const html = await (await app().request(`/hinweis?b=${b64}&url=https://aus-url.test/y`)).text();
    expect(html).toContain('value="https://aus-b.test/x"');
    expect(html).not.toContain("aus-url.test");
  });
});

describe("Sitzung nach Anmeldung", () => {
  it("setzt nach Basic Auth ein Sitzungs-Cookie und laesst es allein gelten", async () => {
    const a = app();
    /* Erste Anfrage mit Zugangsdaten: die Antwort bringt die Sitzung mit. */
    const erste = await a.request("/neu", { headers: { authorization: AUTH } });
    expect(erste.status).toBe(200);
    const cookie = erste.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("sitzung=");
    expect(cookie).toContain("HttpOnly");

    /* Ab dann traegt das Cookie allein -- ohne Authorization-Kopf. */
    const sitzung = cookie.split(";")[0]!;
    const zweite = await a.request("/neu", { headers: { cookie: sitzung } });
    expect(zweite.status).toBe(200);
  });

  it("weist ein gefaelschtes Sitzungs-Cookie ab", async () => {
    const res = await app().request("/neu", { headers: { cookie: "sitzung=abc123" } });
    expect(res.status).toBe(401);
  });
});

describe("Icons und Manifest", () => {
  it("liefert Favicon, Manifest und Service Worker ohne Anmeldung", async () => {
    const a = app();
    const erwartet: [string, string][] = [
      ["/favicon.ico", "image/x-icon"],
      ["/icon.svg", "image/svg+xml"],
      ["/apple-touch-icon.png", "image/png"],
      ["/icon-192.png", "image/png"],
      ["/icon-512.png", "image/png"],
      ["/site.webmanifest", "application/manifest+json"],
      ["/sw.js", "text/javascript; charset=utf-8"],
    ];
    for (const [pfad, typ] of erwartet) {
      const res = await a.request(pfad);
      expect(res.status, pfad).toBe(200);
      expect(res.headers.get("content-type"), pfad).toBe(typ);
    }
  });

  it("nennt im Manifest beide Groessen und eine maskierbare Fassung", async () => {
    /* Android verlangt 192 und 512; ohne "maskable" schneidet es das Icon in
       einen weissen Kreis statt in die Systemform. */
    const res = await app().request("/site.webmanifest");
    const manifest = (await res.json()) as {
      icons: { sizes: string; purpose?: string }[];
      start_url: string;
    };
    expect(manifest.start_url).toBe("/");
    expect(manifest.icons.map((i) => i.sizes)).toEqual(
      expect.arrayContaining(["192x192", "512x512"]),
    );
    expect(manifest.icons.some((i) => i.purpose === "maskable")).toBe(true);
  });
});

describe("Fehlerpruefung (/pruefen)", () => {
  const FORM = { "content-type": "application/x-www-form-urlencoded" };
  const anfrage = (body: Record<string, string>) => ({
    method: "POST",
    body: new URLSearchParams(body),
    headers: FORM,
  });

  it("liegt fuer den Betreiber hinter der Auth und kennt kein Kontingent", async () => {
    const a = app();
    expect((await a.request("/neu/pruefen", anfrage({ url: "https://x.test/a" }))).status).toBe(401);

    /* Ohne erreichbaren Artikel kommt eine leere Liste, nie ein Fehler —
       und das beliebig oft. */
    for (let i = 0; i < 5; i++) {
      const res = await a.request("/neu/pruefen", {
        ...anfrage({ url: "https://x.test/a" }),
        headers: { ...FORM, authorization: AUTH },
      });
      expect(res.status).toBe(200);
      /* Der Grund reist mit: das Formular unterscheidet Panne und Schranke. */
      await expect(res.json()).resolves.toEqual({
        funde: [],
        quelle: "keine",
        grund: "nicht_lesbar",
      });
    }
  });

  it("prueft ersatzweise die Fundstelle, wenn der Artikel nicht zu lesen ist", async () => {
    /* Viele Seiten liefern Servern nur ein Zustimmungsfenster aus. Dann darf
       die Antwort nicht "nichts gefunden" heissen -- geprueft wird, was im
       Formular steht. */
    const res = await app().request("/neu/pruefen", {
      ...anfrage({ url: "https://x.test/a", text: "Der Mietwgaen stand bereit." }),
      headers: { ...FORM, authorization: AUTH },
    });
    expect(res.status).toBe(200);
    const daten = (await res.json()) as { quelle: string };
    expect(daten.quelle).toBe("fundstelle");
  });

  it("benennt die Bezahlschranke, statt sie wie eine Panne aussehen zu lassen", async () => {
    /* Der Abruf gelingt, aber es kommt nur Abo-Werbung. Das ist kein
       Zustimmungsfenster und keine Panne -- und der Unterschied entscheidet,
       welchen Ausweg das Formular anbietet. */
    const a = app({
      fetchArticle: async () => ({
        ok: true,
        status: 200,
        html: BEZAHLSCHRANKE_HTML,
        url: "https://x.test/a",
      }),
    });
    const res = await a.request("/neu/pruefen", {
      ...anfrage({ url: "https://x.test/a", text: "Der Mietwgaen stand bereit." }),
      headers: { ...FORM, authorization: AUTH },
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      quelle: "fundstelle",
      grund: "bezahlschranke",
    });
  });

  it("prueft den eingefuegten Artikeltext, ohne ihn zu holen", async () => {
    /* Der Weg fuer Artikel hinter einer Schranke: der angemeldete Mensch
       liefert den Text, der Server holt gar nicht erst. */
    let abgerufen = 0;
    const a = app({
      fetchArticle: async () => {
        abgerufen++;
        return { ok: false, status: null, reason: "network" };
      },
    });
    const artikelText = "Ein langer Artikelabsatz. ".repeat(60);
    const res = await a.request("/neu/pruefen", {
      ...anfrage({ url: "https://x.test/a", text: "Der Mietwgaen stand bereit.", artikelText }),
      headers: { ...FORM, authorization: AUTH },
    });
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ quelle: "eingefuegt" });
    expect(abgerufen).toBe(0);
  });

  it("gibt Besuchern zwei Pruefungen am Tag und lehnt die dritte ab", async () => {
    const a = app();
    const kopf = { ...FORM, "x-forwarded-for": "203.0.113.9" };
    for (let i = 0; i < 2; i++) {
      const res = await a.request("/hinweis/pruefen", {
        ...anfrage({ url: "https://x.test/a" }),
        headers: kopf,
      });
      expect(res.status).toBe(200);
    }
    const dritte = await a.request("/hinweis/pruefen", {
      ...anfrage({ url: "https://x.test/a" }),
      headers: kopf,
    });
    expect(dritte.status).toBe(429);
    await expect(dritte.json()).resolves.toMatchObject({ grund: "kontingent" });
  });

  it("zaehlt Besucher getrennt", async () => {
    const a = app();
    for (let i = 0; i < 2; i++) {
      await a.request("/hinweis/pruefen", {
        ...anfrage({ url: "https://x.test/a" }),
        headers: { ...FORM, "x-forwarded-for": "203.0.113.9" },
      });
    }
    const andere = await a.request("/hinweis/pruefen", {
      ...anfrage({ url: "https://x.test/a" }),
      headers: { ...FORM, "x-forwarded-for": "198.51.100.2" },
    });
    expect(andere.status).toBe(200);
  });
});
