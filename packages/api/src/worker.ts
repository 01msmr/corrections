import { eq, isNotNull } from "drizzle-orm";
import { createDb, runMigrations } from "./db/client.js";
import { corrections, imapCursor } from "./db/schema.js";
import { loadWorkerEnv } from "./env.js";
import { findeZuordnung } from "./inbox/antworten.js";
import { verarbeitePosteingang } from "./inbox/postfach.js";
import { ladeAntwortKandidaten, vermerkeAntwort } from "./repo/antworten.js";

/**
 * Wird vom Plesk-Cronjob aufgerufen (stuendlich), laeuft kurz und endet.
 * Heute: ein Gang durch den Posteingang — Eingangsbestaetigungen in den
 * Papierkorb, Redaktionsantworten zuordnen und vermerken (P3). Der erste
 * Lauf liest das ganze Postfach und holt damit auch die Antworten aus den
 * Jahren vor diesem Projekt herein; danach traegt der UID-Cursor.
 * Spaeter: Artikel-Checks (P5).
 */
async function main(): Promise<void> {
  const env = loadWorkerEnv();

  if (!env.IMAP_HOST) {
    console.log(
      JSON.stringify({ level: "info", msg: "worker gelaufen", tasks: [], hinweis: "IMAP nicht konfiguriert" }),
    );
    return;
  }

  const db = createDb(env.DATABASE_PATH);
  runMigrations(db, env.MIGRATIONS_DIR);

  /* Bekannte Message-IDs unserer versendeten Korrekturen: der Bezugs-Anker
     der Bestaetigungs-Erkennung (In-Reply-To). */
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

  const kandidaten = ladeAntwortKandidaten(db);
  const cursor = db.select().from(imapCursor).where(eq(imapCursor.folder, "INBOX")).get();

  const ergebnis = await verarbeitePosteingang(env, cursor?.lastUid ?? 0, {
    bekannteMessageIds: bekannte,
    ordneZu: (mail) => findeZuordnung(mail, kandidaten)?.id ?? null,
    vermerke: (meldungId, vermerk) => vermerkeAntwort(db, meldungId, vermerk),
  });

  if (ergebnis === null) {
    console.log(JSON.stringify({ level: "info", msg: "worker gelaufen", tasks: [], hinweis: "IMAP unvollstaendig" }));
    return;
  }

  /* Cursor fortschreiben; wechselt die UIDVALIDITY, beginnt der naechste
     Lauf von vorn — Antworten vermerken ist idempotent, das ist gefahrlos. */
  if (cursor && cursor.uidvalidity !== ergebnis.uidValidity) {
    db.update(imapCursor)
      .set({ uidvalidity: ergebnis.uidValidity, lastUid: 0 })
      .where(eq(imapCursor.folder, "INBOX"))
      .run();
  } else if (cursor) {
    db.update(imapCursor)
      .set({ lastUid: ergebnis.hoechsteUid })
      .where(eq(imapCursor.folder, "INBOX"))
      .run();
  } else {
    db.insert(imapCursor)
      .values({ folder: "INBOX", uidvalidity: ergebnis.uidValidity, lastUid: ergebnis.hoechsteUid })
      .run();
  }

  console.log(
    JSON.stringify({
      level: "info",
      msg: "worker gelaufen",
      tasks: ["posteingang"],
      gesichtet: ergebnis.gesichtet,
      bestaetigungen: ergebnis.verschoben,
      antworten: ergebnis.zugeordnet,
    }),
  );
}

main().catch((fehler: unknown) => {
  console.error(JSON.stringify({ level: "error", msg: "worker gescheitert", fehler: String(fehler) }));
  process.exitCode = 1;
});
