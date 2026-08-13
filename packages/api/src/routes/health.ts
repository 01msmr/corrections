import { Hono } from "hono";
import type { Env } from "../env.js";

/* `anstoss` sagt, ob WORKER_TOKEN im Prozess angekommen ist -- ohne ihn gibt
   es /intern/posteingang nicht. Verraet nur ja/nein, nie das Wort. */
export function healthRoutes(env: Env): Hono {
  return new Hono().get("/healthz", (c) =>
    c.json({ status: "ok", anstoss: env.WORKER_TOKEN ? "bereit" : "kein token" }),
  );
}
