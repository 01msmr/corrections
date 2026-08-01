import { basicAuth } from "hono/basic-auth";
import type { MiddlewareHandler } from "hono";
import type { Env } from "./env.js";

/**
 * Schutz auf Anwendungsebene (§13). Auf gemanagtem Hosting gibt es keinen
 * eigenen Reverse Proxy zum Konfigurieren; TLS liefert Plesk.
 */
export function adminAuth(env: Env): MiddlewareHandler {
  return basicAuth({ username: env.ADMIN_USER, password: env.ADMIN_PASSWORD });
}
