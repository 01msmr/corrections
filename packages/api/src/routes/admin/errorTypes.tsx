import { errorTypeInputSchema, errorTypeUpdateSchema } from "@korrektur/shared";
import { Hono } from "hono";
import type { Db } from "../../db/client.js";
import {
  createErrorType,
  listErrorTypes,
  removeErrorType,
  updateErrorType,
} from "../../repo/errorTypes.js";
import { ErrorTypeEdit, ErrorTypeList } from "../../views/errorTypes.js";

const BASE = "/admin/fehlerarten";

export function errorTypeAdminRoutes(db: Db, now: () => number): Hono {
  const app = new Hono();

  app.get(BASE, (c) =>
    c.html(<ErrorTypeList types={listErrorTypes(db)} hinweis={c.req.query("hinweis") ?? undefined} />),
  );

  app.get(`${BASE}/:id`, (c) => {
    const type = listErrorTypes(db, { includeArchived: true }).find((t) => t.id === c.req.param("id"));
    if (!type) return c.notFound();
    return c.html(<ErrorTypeEdit type={type} />);
  });

  app.post(BASE, async (c) => {
    const parsed = errorTypeInputSchema.safeParse(await c.req.parseBody());
    if (!parsed.success) {
      return c.html(
        <ErrorTypeList types={listErrorTypes(db)} fehler={parsed.error.issues[0]?.message ?? "Eingabe ungültig"} />,
        400,
      );
    }

    const created = createErrorType(db, parsed.data, now());
    if (!created) {
      return c.html(
        <ErrorTypeList types={listErrorTypes(db)} fehler={`Der Schlüssel ${parsed.data.key} ist bereits vergeben.`} />,
        400,
      );
    }
    return c.redirect(`${BASE}?hinweis=Angelegt`, 302);
  });

  app.post(`${BASE}/:id`, async (c) => {
    const parsed = errorTypeUpdateSchema.safeParse(await c.req.parseBody());
    if (!parsed.success) {
      return c.html(
        <ErrorTypeList types={listErrorTypes(db)} fehler={parsed.error.issues[0]?.message ?? "Eingabe ungültig"} />,
        400,
      );
    }
    updateErrorType(db, c.req.param("id"), parsed.data);
    return c.redirect(`${BASE}?hinweis=Gespeichert`, 302);
  });

  app.post(`${BASE}/:id/loeschen`, (c) => {
    const outcome = removeErrorType(db, c.req.param("id"));
    const hinweis =
      outcome === "archived"
        ? "Fehlerart archiviert, weil Meldungen darauf verweisen"
        : outcome === "deleted"
          ? "Fehlerart geloescht"
          : "Fehlerart nicht gefunden";
    return c.redirect(`${BASE}?hinweis=${encodeURIComponent(hinweis)}`, 302);
  });

  return app;
}
