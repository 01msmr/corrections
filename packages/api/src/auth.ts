import { basicAuth } from "hono/basic-auth";
import { getCookie, setCookie } from "hono/cookie";
import type { Context, MiddlewareHandler } from "hono";
import type { Env } from "./env.js";

/**
 * Schutz auf Anwendungsebene (§13). Auf gemanagtem Hosting gibt es keinen
 * eigenen Reverse Proxy zum Konfigurieren; TLS liefert Plesk.
 */
export function adminAuth(env: Env): MiddlewareHandler {
  return basicAuth({ username: env.ADMIN_USER, password: env.ADMIN_PASSWORD });
}

/**
 * Bequemlichkeits-Weiche, keine Sicherheit: Das Cookie entscheidet nur, ob
 * die Navigation "Neue Korrektur" zum Formular oder ins mailto fuehrt. Wer
 * es faelscht, sieht lediglich den Passwort-Dialog des Formulars — deshalb
 * genuegt ein fester Wert.
 */
const BETREIBER_COOKIE = "betreiber";

export function betreiberErkennung(): MiddlewareHandler {
  return async (c, next) => {
    await next();
    if (c.res.status < 400) {
      setCookie(c, BETREIBER_COOKIE, "1", {
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
        /* Ohne Secure-Flag: die lokale Entwicklung laeuft ueber http. */
        maxAge: 31_536_000,
      });
    }
  };
}

export function istBetreiber(c: Context): boolean {
  return getCookie(c, BETREIBER_COOKIE) === "1";
}
