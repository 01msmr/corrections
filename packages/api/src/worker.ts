import { isNotNull } from "drizzle-orm";
import { createDb, runMigrations } from "./db/client.js";
import { corrections } from "./db/schema.js";
import { loadEnv } from "./env.js";
import { raeumeBestaetigungenAuf } from "./inbox/postfach.js";

/**
 * Wird vom Plesk-Cronjob aufgerufen (stuendlich), laeuft kurz und endet.
 * Heute: Eingangsbestaetigungen in den Papierkorb (Spec 2026-08-08).
 * Spaeter: IMAP-Abgleich (P3), Artikel-Checks (P5).
 */
async function main(): Promise<void> {
  const env = loadEnv();

  if (!env.IMAP_HOST) {
    console.log(
      JSON.stringify({ level: "info", msg: "worker gelaufen", tasks: [], hinweis: "IMAP nicht konfiguriert" }),
    );
    return;
  }

  const db = createDb(env.DATABASE_PATH);
  runMigrations(db, env.MIGRATIONS_DIR);
  /* Bekannte Message-IDs unserer versendeten Korrekturen: der Bezugs-Anker
     der Erkennung (In-Reply-To). */
  const bekannte = new Set(
    db
      .select({ messageId: corrections.messageId })
      .from(corrections)
      .where(isNotNull(corrections.messageId))
      .all()
      .map((zeile) => zeile.messageId ?? "")
      .filter((id) => id.length > 0)
      .map((id) => id.replace(/[<>]/g, "")),
  );

  const ergebnis = await raeumeBestaetigungenAuf(env, bekannte);
  console.log(
    JSON.stringify({ level: "info", msg: "worker gelaufen", tasks: ["bestaetigungen"], ...ergebnis }),
  );
}

main().catch((fehler: unknown) => {
  console.error(JSON.stringify({ level: "error", msg: "worker gescheitert", fehler: String(fehler) }));
  process.exitCode = 1;
});
