import { timingSafeEqual } from "node:crypto";
import { Hono } from "hono";
import type { Db } from "../db/client.js";
import type { Env } from "../env.js";
import { posteingangLauf } from "../inbox/lauf.js";
import { fehlerDetails } from "../inbox/postfach.js";

/**
 * Anstoss von aussen fuer den Posteingang-Gang. Noetig, weil auf dem Server
 * keine Node-Laufzeit fuer geplante Aufgaben bereitsteht (der nodenv-Shim
 * greift ins Leere) — Plesk kann aber stuendlich eine Adresse abrufen.
 *
 * Ohne WORKER_TOKEN gibt es die Route nicht. Falscher Token: 404, damit ihre
 * Existenz nichts verraet.
 */
function gleich(a: string, b: string): boolean {
  const links = Buffer.from(a);
  const rechts = Buffer.from(b);
  return links.length === rechts.length && timingSafeEqual(links, rechts);
}

export function internRoutes(db: Db, env: Env): Hono {
  const app = new Hono();
  /* Ein Lauf zur Zeit: der stuendliche Abruf soll sich nicht mit einem noch
     laufenden ueberholen. */
  let laeuft = false;

  app.get("/intern/posteingang", async (c) => {
    const token = env.WORKER_TOKEN;
    const gegeben = c.req.query("token") ?? "";
    if (!token || !gleich(token, gegeben)) return c.notFound();

    if (laeuft) return c.json({ hinweis: "laeuft bereits" }, 409);
    laeuft = true;
    try {
      const ergebnis = await posteingangLauf(db, env);
      if (ergebnis === null) return c.json({ hinweis: "IMAP nicht konfiguriert" });
      return c.json(ergebnis);
    } catch (fehler: unknown) {
      return c.json({ fehler: String(fehler), ...fehlerDetails(fehler) }, 500);
    } finally {
      laeuft = false;
    }
  });

  return app;
}
