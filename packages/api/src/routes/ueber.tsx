import { Hono } from "hono";
import { UeberSeite } from "../views/ueber.js";

export function ueberRoutes(): Hono {
  const app = new Hono();
  app.get("/", (c) => c.html(<UeberSeite />));
  return app;
}
