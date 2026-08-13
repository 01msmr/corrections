import { eq, isNotNull } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { corrections, imapCursor } from "../db/schema.js";
import type { WorkerEnv } from "../env.js";
import { ladeAntwortKandidaten, vermerkeAntwort } from "../repo/antworten.js";
import { findeZuordnung } from "./antworten.js";
import { verarbeitePosteingang } from "./postfach.js";

/**
 * Ein Gang durch den Posteingang — dieselbe Arbeit, gleich von wo angestossen:
 * vom Worker (Kommandozeile) oder von der internen Route, wenn keine
 * Node-Laufzeit fuer geplante Aufgaben bereitsteht.
 */
export interface LaufErgebnis {
  gesichtet: number;
  bestaetigungen: number;
  antworten: number;
}

export async function posteingangLauf(db: Db, env: WorkerEnv): Promise<LaufErgebnis | null> {
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
  if (ergebnis === null) return null;

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

  return {
    gesichtet: ergebnis.gesichtet,
    bestaetigungen: ergebnis.verschoben,
    antworten: ergebnis.zugeordnet,
  };
}
