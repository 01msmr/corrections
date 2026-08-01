import { outletInputSchema } from "@korrektur/shared";
import { Hono } from "hono";
import type { Db } from "../../db/client.js";
import {
  addDomain,
  createOutlet,
  listOutlets,
  removeOutlet,
  updateOutlet,
} from "../../repo/outlets.js";
import { OutletEdit, OutletList } from "../../views/outlets.js";

const BASE = "/admin/redaktionen";

/**
 * Der Rueckweg kommt aus der Abfrage und darf deshalb nur auf das
 * Erfassungsformular zeigen. Ohne diese Pruefung waere die Route eine offene
 * Weiterleitung — ein praeparierter Link koennte auf eine fremde Seite fuehren.
 */
function sicherereRueckweg(wert: string | undefined): string | undefined {
  return wert?.startsWith("/neu?") ? wert : undefined;
}

function parseEmails(raw: unknown): string[] {
  if (typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export function outletAdminRoutes(db: Db, now: () => number): Hono {
  const app = new Hono();

  app.get(BASE, (c) =>
    c.html(
      <OutletList
        outlets={listOutlets(db, { includeArchived: false })}
        hinweis={c.req.query("hinweis") ?? undefined}
        vorgabeDomain={c.req.query("domain") ?? undefined}
        zurueck={sicherereRueckweg(c.req.query("zurueck"))}
      />,
    ),
  );

  app.get(`${BASE}/:id`, (c) => {
    const outlet = listOutlets(db, { includeArchived: true }).find((o) => o.id === c.req.param("id"));
    if (!outlet) return c.notFound();
    return c.html(<OutletEdit outlet={outlet} />);
  });

  app.post(BASE, async (c) => {
    const raw = await c.req.parseBody();
    const parsed = outletInputSchema.safeParse({ ...raw, contactEmails: parseEmails(raw["contactEmails"]) });
    if (!parsed.success) {
      return c.html(
        <OutletList outlets={listOutlets(db)} fehler={parsed.error.issues[0]?.message ?? "Eingabe ungültig"} />,
        400,
      );
    }
    createOutlet(db, parsed.data, now());
    const zurueck = sicherereRueckweg(
      typeof raw["zurueck"] === "string" ? raw["zurueck"] : undefined,
    );
    return c.redirect(zurueck ?? `${BASE}?hinweis=Angelegt`, 302);
  });

  app.post(`${BASE}/:id`, async (c) => {
    const raw = await c.req.parseBody();
    const parsed = outletInputSchema.safeParse({ ...raw, contactEmails: parseEmails(raw["contactEmails"]) });
    if (!parsed.success) {
      return c.html(
        <OutletList outlets={listOutlets(db)} fehler={parsed.error.issues[0]?.message ?? "Eingabe ungültig"} />,
        400,
      );
    }
    updateOutlet(db, c.req.param("id"), parsed.data);
    return c.redirect(`${BASE}?hinweis=Gespeichert`, 302);
  });

  app.post(`${BASE}/:id/domains`, async (c) => {
    const raw = await c.req.parseBody();
    const domain = typeof raw["domain"] === "string" ? raw["domain"] : "";
    const ok = addDomain(db, c.req.param("id"), domain);
    const hinweis = ok ? "Domain ergaenzt" : "Domain gehoert bereits zu einer anderen Redaktion";
    return c.redirect(`${BASE}?hinweis=${encodeURIComponent(hinweis)}`, 302);
  });

  app.post(`${BASE}/:id/loeschen`, (c) => {
    const outcome = removeOutlet(db, c.req.param("id"));
    const hinweis =
      outcome === "archived"
        ? "Redaktion archiviert, weil Meldungen darauf verweisen"
        : outcome === "deleted"
          ? "Redaktion geloescht"
          : "Redaktion nicht gefunden";
    return c.redirect(`${BASE}?hinweis=${encodeURIComponent(hinweis)}`, 302);
  });

  return app;
}
