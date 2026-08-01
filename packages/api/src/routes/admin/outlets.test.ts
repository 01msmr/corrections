import { createId } from "@paralleldrive/cuid2";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, runMigrations, type Db } from "../../db/client.js";
import { corrections, errorTypes } from "../../db/schema.js";
import { createOutlet, listOutlets } from "../../repo/outlets.js";
import { outletAdminRoutes } from "./outlets.js";

const NOW = 1_800_000_000;
let db: Db;

function app() {
  return outletAdminRoutes(db, () => NOW);
}

function body(fields: Record<string, string>): URLSearchParams {
  return new URLSearchParams(fields);
}

function post(path: string, fields: Record<string, string>) {
  return app().request(path, {
    method: "POST",
    body: body(fields),
    headers: { "content-type": "application/x-www-form-urlencoded" },
  });
}

beforeEach(() => {
  db = createDb(":memory:");
  runMigrations(db);
});

describe("Adminoberfläche Redaktionen", () => {
  it("listet Redaktionen alphabetisch", async () => {
    createOutlet(db, { name: "Zeta", primaryDomain: "zeta.de", publisher: null, country: null, notes: null, contactEmails: [] }, NOW);
    createOutlet(db, { name: "Alpha", primaryDomain: "alpha.de", publisher: null, country: null, notes: null, contactEmails: [] }, NOW);

    const html = await (await app().request("/admin/redaktionen")).text();
    expect(html.indexOf("Alpha")).toBeLessThan(html.indexOf("Zeta"));
  });

  it("legt eine Redaktion mit Kontaktadressen an", async () => {
    const res = await post("/admin/redaktionen", {
      name: "Beispiel-Zeitung",
      primaryDomain: "Beispiel-Zeitung.DE",
      contactEmails: "leserbriefe@beispiel-zeitung.de, redaktion@beispiel-zeitung.de",
    });
    expect(res.status).toBe(302);

    const [outlet] = listOutlets(db);
    expect(outlet?.primaryDomain).toBe("beispiel-zeitung.de");
    expect(outlet?.contactEmails).toHaveLength(2);
    expect(outlet?.domains).toEqual(["beispiel-zeitung.de"]);
  });

  it("weist eine ungültige Kontaktadresse ab", async () => {
    const res = await post("/admin/redaktionen", {
      name: "X",
      primaryDomain: "x.de",
      contactEmails: "keine-adresse",
    });
    expect(res.status).toBe(400);
    expect(listOutlets(db)).toHaveLength(0);
  });

  it("übernimmt eine vorgegebene Domain und leitet danach zurück", async () => {
    const zurueck = "/neu?url=https%3A%2F%2Fneue-zeitung.de%2Fa&text=Zitat";
    const html = await (
      await app().request(
        `/admin/redaktionen?domain=neue-zeitung.de&zurueck=${encodeURIComponent(zurueck)}`,
      )
    ).text();
    expect(html).toContain('value="neue-zeitung.de"');
    // Hono escaped Attributwerte (& -> &amp;); der rohe Rueckweg-String mit "&"
    // kann deshalb nicht woertlich im Markup stehen. Das ist korrekt und
    // gewuenscht (siehe Vorgabe: Werte muessen HTML-escaped sein) — die
    // Erwartung im Brief ging von unescaped Ausgabe aus.
    expect(html).toContain(zurueck.replaceAll("&", "&amp;"));

    const res = await post("/admin/redaktionen", {
      name: "Neue Zeitung",
      primaryDomain: "neue-zeitung.de",
      contactEmails: "leserbriefe@neue-zeitung.de",
      zurueck,
    });
    expect(res.headers.get("location")).toBe(zurueck);
  });

  it("rendert einen fremden Rückweg nicht in das versteckte Feld", async () => {
    // Die Absicherung muss auf beiden Wegen greifen: hier beim Rendern,
    // im Test darunter beim Weiterleiten. Geprueft wird gezielt das
    // versteckte Feld (nicht die ganze Seite): "/admin/redaktionen" taucht
    // z. B. im Nav-Link und im Formular-"action" der Seite ohnehin immer auf,
    // unabhaengig vom Rueckweg — ein Volltextvergleich waere fuer diesen Wert
    // nie erfuellbar und truege eine Pruefung der Absicherung nur vor.
    for (const boese of ["https://boese.example/", "//boese.example/", "/admin/redaktionen"]) {
      const html = await (
        await app().request(`/admin/redaktionen?zurueck=${encodeURIComponent(boese)}`)
      ).text();
      expect(html).not.toContain(`name="zurueck" value="${boese}"`);
    }
  });

  it("weist einen Rückweg mit Steuerzeichen ab, statt abzustürzen", async () => {
    const res = await post("/admin/redaktionen", {
      name: "X",
      primaryDomain: "steuerzeichen.de",
      contactEmails: "",
      zurueck: "/neu?a=1\r\nSet-Cookie: evil=1",
    });
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("/admin/redaktionen?hinweis=");
  });

  it("weist einen fremden Rückweg ab", async () => {
    const res = await post("/admin/redaktionen", {
      name: "X",
      primaryDomain: "x.de",
      contactEmails: "",
      zurueck: "https://boese.example/",
    });
    // Offene Weiterleitung verhindert: es geht zur Liste, nicht nach draussen.
    expect(res.headers.get("location")).toContain("/admin/redaktionen?hinweis=");
  });

  it("ergänzt eine weitere Domain", async () => {
    const outlet = createOutlet(db, { name: "X", primaryDomain: "x.de", publisher: null, country: null, notes: null, contactEmails: [] }, NOW);
    await post(`/admin/redaktionen/${outlet.id}/domains`, { domain: "magazin.x.de" });
    expect(listOutlets(db)[0]?.domains).toContain("magazin.x.de");
  });

  it("löscht eine unbenutzte Redaktion", async () => {
    const outlet = createOutlet(db, { name: "X", primaryDomain: "x.de", publisher: null, country: null, notes: null, contactEmails: [] }, NOW);
    await post(`/admin/redaktionen/${outlet.id}/loeschen`, {});
    expect(listOutlets(db, { includeArchived: true })).toHaveLength(0);
  });

  it("archiviert eine benutzte Redaktion und sagt das auch", async () => {
    const outlet = createOutlet(db, { name: "X", primaryDomain: "x.de", publisher: null, country: null, notes: null, contactEmails: [] }, NOW);
    const errorTypeId = createId();
    db.insert(errorTypes).values({ id: errorTypeId, key: "zahl", label: "Zahl", sortOrder: 10, createdAt: NOW }).run();
    db.insert(corrections)
      .values({
        id: createId(), ref: "K7QW3M", idempotencyKey: "idem-1", createdAt: NOW, dispatchMode: "smtp",
        articleUrl: "https://x.de/a", articleUrlCanon: "https://x.de/a", outletId: outlet.id,
        errorTypeId, severity: 2, quoteBefore: "Z", suggestionAfter: "V",
        recipientEmail: "leserbriefe@x.de", source: "web",
      })
      .run();

    const res = await post(`/admin/redaktionen/${outlet.id}/loeschen`, {});
    expect(res.headers.get("location")).toContain("archiviert");
    expect(listOutlets(db)).toHaveLength(0);
    expect(listOutlets(db, { includeArchived: true })).toHaveLength(1);
  });
});
