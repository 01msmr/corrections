import { createHmac } from "node:crypto";
import { basicAuth } from "hono/basic-auth";
import { getCookie, setCookie } from "hono/cookie";
import type { Context, MiddlewareHandler } from "hono";
import type { Env } from "./env.js";

/**
 * Schutz auf Anwendungsebene (§13). Auf gemanagtem Hosting gibt es keinen
 * eigenen Reverse Proxy zum Konfigurieren; TLS liefert Plesk.
 *
 * Einmal anmelden statt staendig: iOS-Safari vergisst Basic-Auth-Zugaenge
 * schnell wieder. Nach der ersten erfolgreichen Anmeldung setzt die Auth
 * deshalb ein Sitzungs-Cookie und laesst es 90 Tage gelten. Der Wert ist
 * ein HMAC ueber die Zugangsdaten -- nicht erratbar, aber absichtlich
 * deterministisch: ein neues Passwort macht alle Sitzungen ungueltig,
 * gespeichert werden muss nichts.
 */
const SITZUNG_COOKIE = "sitzung";
const SITZUNG_TAGE = 90;

function sitzungsWert(env: Env): string {
  return createHmac("sha256", `${env.ADMIN_USER}\u0000${env.ADMIN_PASSWORD}`)
    .update("betreiber-sitzung")
    .digest("hex");
}

export function adminAuth(env: Env): MiddlewareHandler {
  const basic = basicAuth({ username: env.ADMIN_USER, password: env.ADMIN_PASSWORD });
  const wert = sitzungsWert(env);
  /* Secure nur, wo die Seite ueber TLS laeuft -- lokal (http) bliebe ein
     Secure-Cookie sonst einfach ungespeichert. */
  const secure = env.PUBLIC_BASE_URL.startsWith("https");
  return async (c, next) => {
    if (getCookie(c, SITZUNG_COOKIE) === wert) {
      await next();
      return;
    }
    await basic(c, async () => {
      setCookie(c, SITZUNG_COOKIE, wert, {
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
        secure,
        maxAge: SITZUNG_TAGE * 24 * 60 * 60,
      });
      await next();
    });
  };
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
