import { Hono } from "hono";
import { health } from "./routes/health.js";

export function createApp(): Hono {
  const app = new Hono();
  app.route("/", health);
  return app;
}
