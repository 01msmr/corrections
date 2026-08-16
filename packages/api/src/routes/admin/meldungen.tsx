import { QUOTE_MAX_LENGTH } from "@korrektur/shared";
import { Hono } from "hono";
import { adminAuth } from "../../auth.js";
import type { Db } from "../../db/client.js";
import type { Env } from "../../env.js";
import {
  ladeAbgleichKandidaten,
  ladeAbgleichLage,
  ladeAlleBeantworteten,
} from "../../repo/abgleich.js";
import { listErrorTypes } from "../../repo/errorTypes.js";
import {
  istAusgang,
  leseMeldung,
  listeMeldungen,
  SEITENGROESSE,
  setzeAusgang,
  zaehleMeldungen,
  type MeldungsFilter,
} from "../../repo/meldungen.js";
import { listOutlets } from "../../repo/outlets.js";
import { AbgleichSeite } from "../../views/abgleich.js";
import { MeldungsAnsicht, MeldungsListe } from "../../views/meldungen.js";

/**
 * Die Meldungshistorie ist grundsaetzlich nicht oeffentlich (Plan
 * 2026-08-13): Zitate, Anker und Versanddaten gehoeren nur dem Betreiber.
 *
 * Verteidigung in der Tiefe: app.ts legt die Auth bereits ueber /admin/*,
 * aber dieser Router verlaesst sich nicht darauf -- er traegt seine eigene
 * Schicht. Faellt die aeussere durch einen Programmierfehler weg (ein
 * geaendertes Pfadmuster genuegt), sperrt die innere weiter. Der Test
 * montiert den Router deshalb auch ohne app.ts und erwartet 401.
 */
export function meldungenRoutes(deps: { db: Db; env: Env }): Hono {
  const app = new Hono();

  /* Auf die eigenen Pfade begrenzt: der Router wird an der Wurzel montiert,
     ein use("*") sperrte sonst die ganze Seite. Beide Muster je Pfad, weil
     /admin/meldungen/* den Pfad ohne Schraegstrich nicht abdeckt. */
  for (const pfad of [
    "/admin/meldungen",
    "/admin/meldungen/*",
    "/admin/abgleich",
    "/admin/abgleich/*",
  ]) {
    app.use(pfad, adminAuth(deps.env));
    /* Nichts hiervon darf in einem Zwischenspeicher landen. */
    app.use(pfad, async (c, next) => {
      await next();
      c.res.headers.set("cache-control", "no-store");
    });
  }

  app.get("/admin/meldungen", (c) => {
    const q = (name: string): string | undefined => {
      const wert = c.req.query(name)?.trim();
      return wert ? wert : undefined;
    };
    const ausgangRoh = q("ausgang");
    const filter: MeldungsFilter = {
      outletId: q("medium"),
      errorTypeId: q("kategorie"),
      ausgang: ausgangRoh !== undefined && istAusgang(ausgangRoh) ? ausgangRoh : undefined,
      suche: q("suche"),
    };
    const gesamt = zaehleMeldungen(deps.db, filter);
    const seiten = Math.max(1, Math.ceil(gesamt / SEITENGROESSE));
    const seite = Math.min(seiten, Math.max(1, Number.parseInt(q("seite") ?? "1", 10) || 1));
    return c.html(
      <MeldungsListe
        zeilen={listeMeldungen(deps.db, filter, seite)}
        gesamt={gesamt}
        seite={seite}
        seiten={seiten}
        filter={filter}
        outlets={listOutlets(deps.db)}
        errorTypes={listErrorTypes(deps.db)}
      />,
    );
  });

  app.get("/admin/meldungen/:id", (c) => {
    const detail = leseMeldung(deps.db, c.req.param("id"));
    if (!detail) return c.notFound();
    return c.html(
      <MeldungsAnsicht
        detail={detail}
        hinweis={
          c.req.query("gesetzt") === "1"
            ? c.req.query("datum") === "1"
              ? "Ausgang gespeichert; als Korrekturdatum gilt der Tag der Antwort."
              : "Ausgang gespeichert."
            : undefined
        }
      />,
    );
  });

  app.post("/admin/meldungen/:id/ausgang", async (c) => {
    const id = c.req.param("id");
    const body = await c.req.parseBody();
    const ausgang = typeof body["ausgang"] === "string" ? body["ausgang"] : "";
    if (!istAusgang(ausgang)) return c.text("Unbekannter Ausgang", 400);

    /* Datumseingaben (JJJJ-MM-TT) zur UTC-Epoche; 12:00 UTC, damit kein
       Zeitzonenversatz den Tag kippt. Leer heisst: kein Datum. */
    const epoche = (name: string): number | null => {
      const wert = typeof body[name] === "string" ? body[name].trim() : "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(wert)) return null;
      const ms = Date.parse(`${wert}T12:00:00Z`);
      return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
    };

    /* Steht ein Korrektur-Ausgang ohne Datum da, gilt der Tag der Antwort:
       dort hat die Redaktion die Korrektur gemeldet. Ohne Datum bliebe die
       manuelle Bestaetigung aus und die Quote zaehlte den Fall nicht --
       eine stille Falle, denn der Ausgang stuende ja gesetzt da. */
    const korrigiert = ausgang === "corrected" || ausgang === "corrected_other";
    const antwortAm = epoche("antwortAm");
    const angegeben = epoche("korrigiertAm");
    const korrigiertAm = korrigiert ? (angegeben ?? antwortAm) : angegeben;

    const roher = typeof body["korrigierterText"] === "string" ? body["korrigierterText"].trim() : "";
    const gesetzt = setzeAusgang(deps.db, id, {
      outcome: ausgang,
      respondedAt: antwortAm,
      correctedAt: korrigiertAm,
      correctedText: roher.length > 0 ? roher.slice(0, QUOTE_MAX_LENGTH) : null,
    });
    if (!gesetzt) return c.notFound();
    const uebernommen = korrigiert && angegeben === null && korrigiertAm !== null;
    return c.redirect(`/admin/meldungen/${id}?gesetzt=1${uebernommen ? "&datum=1" : ""}`, 303);
  });

  /**
   * Ausgangs-Abgleich, ein Fall je Bildschirm. Die Stelle steht in der
   * Adresse statt in einer Sitzung: Uebernehmen nimmt den Fall aus der
   * Liste, danach steht an derselben Stelle der naechste -- Weiter zaehlt
   * eins hoch. Damit ist die Seite anhaltbar und ohne Zustand.
   */
  app.get("/admin/abgleich", (c) => {
    const offen = c.req.query("alle") === "1";
    const faelle = offen ? ladeAlleBeantworteten(deps.db) : ladeAbgleichKandidaten(deps.db);
    const roh = Number.parseInt(c.req.query("stelle") ?? "0", 10);
    const stelle = Number.isFinite(roh) && roh > 0 ? roh : 0;
    return c.html(
      <AbgleichSeite
        faelle={faelle}
        lage={ladeAbgleichLage(deps.db)}
        stelle={stelle}
        offen={offen}
        hinweis={c.req.query("gesetzt") === "1" ? "Ausgang gesetzt." : undefined}
      />,
    );
  });

  app.post("/admin/abgleich/:id", async (c) => {
    const id = c.req.param("id");
    const offen = c.req.query("alle") === "1";
    const fall = (offen ? ladeAlleBeantworteten(deps.db) : ladeAbgleichKandidaten(deps.db)).find(
      (k) => k.id === id,
    );
    if (!fall) return c.notFound();

    /* Die strenge Schlange kennt nur einen Ausgang, die offene drei. */
    const body = await c.req.parseBody();
    const gewaehlt = typeof body["ausgang"] === "string" ? body["ausgang"] : "corrected";
    if (!istAusgang(gewaehlt)) return c.text("Unbekannter Ausgang", 400);

    /* Korrigiert wurde, als die Redaktion es schrieb -- nicht, als unsere
       Pruefung es bemerkte. Die Antwort in dieser Warteschlange nennt die
       Korrektur (sonst waere der Fall nicht hier), taugt also als Datum;
       die Pruefung laeuft erst Tage spaeter und verzerrte die Dauer. */
    /* Ein Korrekturdatum nur, wo tatsaechlich korrigiert wurde -- "als
       richtig benannt" ist eine Antwort, aber keine Korrektur. */
    const korrigiert = gewaehlt === "corrected" || gewaehlt === "corrected_other";
    const fassung = typeof body["korrigierterText"] === "string" ? body["korrigierterText"].trim() : "";
    const gesetzt = setzeAusgang(deps.db, id, {
      outcome: gewaehlt,
      respondedAt: fall.antwortAm,
      correctedAt: korrigiert ? fall.antwortAm : null,
      correctedText: fassung.length > 0 ? fassung.slice(0, QUOTE_MAX_LENGTH) : null,
    });
    if (!gesetzt) return c.notFound();
    const stelle = c.req.query("stelle") ?? "0";
    const modus = offen ? "&alle=1" : "";
    return c.redirect(`/admin/abgleich?stelle=${stelle}${modus}&gesetzt=1`, 303);
  });

  return app;
}
