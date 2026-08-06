import { domainSchema, outletInputSchema } from "@korrektur/shared";
import { Hono } from "hono";
import type { Db } from "../../db/client.js";
import {
  addDomain,
  createOutlet,
  listOutlets,
  removeOutlet,
  updateOutlet,
} from "../../repo/outlets.js";
import { OutletEdit, OutletList, type OutletFormValues } from "../../views/outlets.js";

const BASE = "/admin/redaktionen";

/** Zeichencode statt Regex, damit kein Steuerzeichen-Literal im Quelltext steht. */
function enthaeltSteuerzeichen(wert: string): boolean {
  for (let i = 0; i < wert.length; i++) {
    const code = wert.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

/**
 * Der Rueckweg kommt aus der Abfrage und darf deshalb nur auf das
 * Erfassungsformular zeigen. Ohne diese Pruefung waere die Route eine offene
 * Weiterleitung — ein praeparierter Link koennte auf eine fremde Seite fuehren.
 */
function sicherereRueckweg(wert: string | undefined): string | undefined {
  if (wert === undefined || !wert.startsWith("/neu?")) return undefined;
  // Steuerzeichen ebenfalls abweisen: ein eingebetteter Zeilenumbruch besteht
  // die Praefixpruefung, laesst aber das Setzen des Location-Headers mit einer
  // unbehandelten Ausnahme scheitern — 500 statt sanftem Rueckfall.
  if (enthaeltSteuerzeichen(wert)) return undefined;
  return wert;
}

function parseEmails(raw: unknown): string[] {
  if (typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function stringFeld(raw: unknown): string | undefined {
  return typeof raw === "string" ? raw : undefined;
}

/** Baut die Formularwerte aus dem rohen Body, damit eine fehlgeschlagene
 *  Validierung die Eingabe zurueckgibt statt sie zu verwerfen. */
function eingabeAusRoh(raw: Record<string, unknown>): OutletFormValues {
  return {
    name: stringFeld(raw["name"]),
    primaryDomain: stringFeld(raw["primaryDomain"]),
    publisher: stringFeld(raw["publisher"]),
    country: stringFeld(raw["country"]),
    contactEmails: stringFeld(raw["contactEmails"]),
    notes: stringFeld(raw["notes"]),
  };
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
    const zurueck = sicherereRueckweg(
      typeof raw["zurueck"] === "string" ? raw["zurueck"] : undefined,
    );
    const parsed = outletInputSchema.safeParse({ ...raw, contactEmails: parseEmails(raw["contactEmails"]) });
    if (!parsed.success) {
      return c.html(
        <OutletList
          outlets={listOutlets(db)}
          fehler={parsed.error.issues[0]?.message ?? "Eingabe ungültig"}
          eingabe={eingabeAusRoh(raw)}
          zurueck={zurueck}
        />,
        400,
      );
    }
    createOutlet(db, parsed.data, now());
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
    const parsed = domainSchema.safeParse(raw["domain"]);
    if (!parsed.success) {
      const hinweis = "Domain ungueltig";
      return c.redirect(`${BASE}?hinweis=${encodeURIComponent(hinweis)}`, 302);
    }
    const ergebnis = addDomain(db, c.req.param("id"), parsed.data);
    /* Wandern Meldungen mit, wird das genannt: Sonst bliebe unklar, wohin die
       Historie der Domain gegangen ist. */
    const mitgewandert =
      ergebnis.uebernommeneKorrekturen === 1
        ? ", eine Korrektur übernommen"
        : ergebnis.uebernommeneKorrekturen > 1
          ? `, ${ergebnis.uebernommeneKorrekturen} Korrekturen übernommen`
          : "";
    const hinweis = ergebnis.ok
      ? `Domain ergänzt${mitgewandert}`
      : "Domain gehört bereits zu einem anderen Medium";
    return c.redirect(`${BASE}?hinweis=${encodeURIComponent(hinweis)}`, 302);
  });

  app.post(`${BASE}/:id/loeschen`, (c) => {
    const outcome = removeOutlet(db, c.req.param("id"));
    const hinweis =
      outcome === "archived"
        ? "Titel archiviert, weil Hinweise darauf verweisen"
        : outcome === "deleted"
          ? "Titel gelöscht"
          : "Titel nicht gefunden";
    return c.redirect(`${BASE}?hinweis=${encodeURIComponent(hinweis)}`, 302);
  });

  return app;
}
