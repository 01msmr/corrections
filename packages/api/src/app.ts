import { Hono } from "hono";
import type { FetchResult } from "./article/fetch.js";
import { adminAuth } from "./auth.js";
import type { Db } from "./db/client.js";
import type { Mailer } from "./dispatch/send.js";
import type { Env } from "./env.js";
import { errorTypeAdminRoutes } from "./routes/admin/errorTypes.js";
import { outletAdminRoutes } from "./routes/admin/outlets.js";
import { bilanzRoutes } from "./routes/bilanz.js";
import { captureRoutes } from "./routes/capture.js";
import { health } from "./routes/health.js";
import { ueberRoutes } from "./routes/ueber.js";

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

  app.route("/", health);

  app.use("/neu", adminAuth(options.env));
  app.use("/neu/*", adminAuth(options.env));
  // Beide Muster: /admin/* deckt den Pfad ohne abschliessenden Schraegstrich nicht ab.
  app.use("/admin", adminAuth(options.env));
  app.use("/admin/*", adminAuth(options.env));

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

  // Die Startseite ist oeffentlich: die Fusszeile jeder Korrekturmail verweist
  // hierher, und der Empfaenger soll ohne Zugang lesen koennen, worum es geht.
  // Dasselbe gilt fuer die Bilanz — sie ist der Zweck des Blatts (§10).
  app.route("/", ueberRoutes());
  app.route("/", bilanzRoutes(options.db, now));
  return app;
}
