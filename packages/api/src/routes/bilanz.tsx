import { Hono } from "hono";
import type { Db } from "../db/client.js";
import { ladeBilanz } from "../repo/bilanz.js";
import { BilanzSeite } from "../views/bilanz.js";

/**
 * Die Bilanz ist oeffentlich: sie ist der Zweck des Blatts (§10). Sie zeigt
 * ausschliesslich Aggregate — keine Fundstellen, keine Adressen, keine
 * Antwortwortlaute.
 */
export function bilanzRoutes(db: Db, now: () => number): Hono {
  const app = new Hono();
  app.get("/bilanz", (c) => c.html(<BilanzSeite bilanz={ladeBilanz(db, now())} />));
  return app;
}
