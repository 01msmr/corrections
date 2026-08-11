import { Hono } from "hono";
import { adminAuth } from "../../auth.js";
import type { Db } from "../../db/client.js";
import type { Env } from "../../env.js";
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
  for (const pfad of ["/admin/meldungen", "/admin/meldungen/*"]) {
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
        hinweis={c.req.query("gesetzt") === "1" ? "Ausgang gespeichert." : undefined}
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

    const gesetzt = setzeAusgang(deps.db, id, {
      outcome: ausgang,
      respondedAt: epoche("antwortAm"),
      correctedAt: epoche("korrigiertAm"),
    });
    if (!gesetzt) return c.notFound();
    return c.redirect(`/admin/meldungen/${id}?gesetzt=1`, 303);
  });

  return app;
}
