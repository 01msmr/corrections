import { Hono } from "hono";
import { istBetreiber } from "../auth.js";
import { UeberSeite } from "../views/ueber.js";

export function ueberRoutes(): Hono {
  const app = new Hono();
  app.get("/", (c) => c.html(<UeberSeite betreiber={istBetreiber(c)} />));
  return app;
}
