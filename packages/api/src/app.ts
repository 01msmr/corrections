import { Hono } from "hono";
import type { FetchResult } from "./article/fetch.js";
import { adminAuth, betreiberErkennung } from "./auth.js";
import type { Db } from "./db/client.js";
import type { Mailer } from "./dispatch/send.js";
import type { Env } from "./env.js";
import { errorTypeAdminRoutes } from "./routes/admin/errorTypes.js";
import { outletAdminRoutes } from "./routes/admin/outlets.js";
import { backfillAdminRoutes } from "./routes/admin/backfill.js";
import { bilanzRoutes } from "./routes/bilanz.js";
import { captureRoutes } from "./routes/capture.js";
import { health } from "./routes/health.js";
import { ueberRoutes } from "./routes/ueber.js";
import { setzeHinweisMailto } from "./views/layout.js";

export interface AppOptions {
  env: Env;
  db: Db;
  mailer: Mailer;
  fetchArticle: (url: string) => Promise<FetchResult>;
  now?: () => number;
}

export function createApp(options: AppOptions): Hono {
  const now = options.now ?? (() => Math.floor(Date.now() / 1000));
  const app = new Hono();

  /* Das Besucher-mailto kennt seine Adresse erst zur Laufzeit. */
  setzeHinweisMailto(options.env.MAIL_FROM);

  app.route("/", health);

  /* Erkennung vor der Auth registriert: ihr next() umschliesst die Auth,
     eine 401 bekommt also kein Betreiber-Cookie. */
  for (const pfad of ["/neu", "/neu/*", "/admin", "/admin/*"]) {
    // Beide Muster je Bereich: /admin/* deckt den Pfad ohne Schraegstrich nicht ab.
    app.use(pfad, betreiberErkennung());
    app.use(pfad, adminAuth(options.env));
  }

  app.route(
    "/",
    captureRoutes({
      db: options.db,
      mailer: options.mailer,
      fetchArticle: options.fetchArticle,
      now,
      baseUrl: options.env.PUBLIC_BASE_URL,
    }),
  );
  app.route("/", outletAdminRoutes(options.db, now));
  app.route("/", errorTypeAdminRoutes(options.db, now));
  // Einmalwerkzeug: nach dem Altbestand-Import kann diese Zeile entfallen (§11.5).
  app.route("/", backfillAdminRoutes(options.db, now));

  // Die Startseite ist oeffentlich: die Fusszeile jeder Korrekturmail verweist
  // hierher, und der Empfaenger soll ohne Zugang lesen koennen, worum es geht.
  // Dasselbe gilt fuer die Bilanz — sie ist der Zweck des Blatts (§10).
  app.route("/", ueberRoutes());
  app.route("/", bilanzRoutes(options.db, now));
  return app;
}
