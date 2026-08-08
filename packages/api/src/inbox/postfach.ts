import { ImapFlow } from "imapflow";
import type { Env } from "../env.js";
import { istEingangsbestaetigung } from "./bestaetigung.js";

/**
 * IO-Schicht des Postfachs (Gegenstueck zu dispatch/send.ts): verbindet sich
 * per IMAP, sichtet den Posteingang der letzten Wochen und verschiebt
 * erkannte Eingangsbestaetigungen in den Papierkorb — nie endgueltig
 * loeschen, endgueltig raeumt der Provider nach seiner Frist.
 *
 * Die Erkennung selbst ist rein und liegt in bestaetigung.ts.
 */

export interface AufraeumErgebnis {
  gesichtet: number;
  verschoben: number;
}

/** Nur die juengeren Mails sichten — aeltere hat ein frueherer Lauf gesehen. */
const SICHT_TAGE = 21;

export async function raeumeBestaetigungenAuf(
  env: Env,
  bekannteMessageIds: ReadonlySet<string>,
): Promise<AufraeumErgebnis> {
  if (!env.IMAP_HOST || !env.IMAP_USER || !env.IMAP_PASSWORD) {
    return { gesichtet: 0, verschoben: 0 };
  }

  const client = new ImapFlow({
    host: env.IMAP_HOST,
    port: env.IMAP_PORT,
    secure: true,
    auth: { user: env.IMAP_USER, pass: env.IMAP_PASSWORD },
    logger: false,
  });

  const seit = new Date(Date.now() - SICHT_TAGE * 24 * 60 * 60 * 1000);
  const ergebnis: AufraeumErgebnis = { gesichtet: 0, verschoben: 0 };

  await client.connect();
  try {
    const schloss = await client.getMailboxLock("INBOX");
    try {
      const treffer: number[] = [];
      for await (const nachricht of client.fetch(
        { since: seit },
        { uid: true, envelope: true, bodyParts: ["text"] },
      )) {
        ergebnis.gesichtet += 1;
        const textAnfang = nachricht.bodyParts
          ?.get("text")
          ?.toString("utf8")
          .slice(0, 2000) ?? "";
        const inReplyTo = nachricht.envelope?.inReplyTo?.replace(/[<>]/g, "").trim() || null;
        const merkmale = {
          betreff: nachricht.envelope?.subject ?? "",
          textAnfang,
          inReplyTo,
        };
        if (istEingangsbestaetigung(merkmale, bekannteMessageIds)) {
          treffer.push(nachricht.uid);
        }
      }
      if (treffer.length > 0) {
        await client.messageMove(treffer, env.IMAP_TRASH, { uid: true });
        ergebnis.verschoben = treffer.length;
      }
    } finally {
      schloss.release();
    }
  } finally {
    await client.logout();
  }
  return ergebnis;
}
