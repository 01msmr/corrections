import { WEICHE_FEHLERARTEN } from "@korrektur/shared";
import { Hono } from "hono";
import { istBetreiber } from "../auth.js";
import type { Db } from "../db/client.js";
import { ladeBilanz } from "../repo/bilanz.js";
import { listErrorTypes } from "../repo/errorTypes.js";
import { BilanzSeite } from "../views/bilanz.js";

/**
 * Die Bilanz ist oeffentlich: sie ist der Zweck des Blatts (§10). Sie zeigt
 * ausschliesslich Aggregate — keine Fundstellen, keine Adressen, keine
 * Antwortwortlaute.
 */
export function bilanzRoutes(db: Db, now: () => number): Hono {
  const app = new Hono();
  app.get("/bilanz", (c) => {
    const mitWeichen = c.req.query("alle") === "1";
    const weicheLabels = listErrorTypes(db)
      .filter((typ) => (WEICHE_FEHLERARTEN as readonly string[]).includes(typ.key))
      .map((typ) => typ.label);
    return c.html(
      <BilanzSeite
        bilanz={ladeBilanz(db, now(), { mitWeichen })}
        betreiber={istBetreiber(c)}
        mitWeichen={mitWeichen}
        weicheLabels={weicheLabels}
      />,
    );
  });
  return app;
}
