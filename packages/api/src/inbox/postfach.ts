import { ImapFlow } from "imapflow";
import type { Env } from "../env.js";
import type { EingehendeMail } from "./antworten.js";
import { istEingangsbestaetigung } from "./bestaetigung.js";

/**
 * IO-Schicht des Postfachs (Gegenstueck zu dispatch/send.ts): verbindet sich
 * per IMAP und geht den Posteingang in einem Gang durch:
 *
 * - Erkannte **Eingangsbestaetigungen** wandern in den Papierkorb — nie
 *   endgueltig loeschen, endgueltig raeumt der Provider nach seiner Frist.
 *   Sie zaehlen nicht als Antwort.
 * - Alle uebrigen Mails gehen an die Antwort-Zuordnung (Rueckruf des
 *   Aufrufers); zugeordnete bleiben unangetastet im Postfach liegen.
 *
 * Gelesen wird ab dem UID-Cursor des letzten Laufs: der erste Lauf sieht
 * damit das ganze Postfach — auch die Antworten aus den Jahren vor diesem
 * Projekt —, jeder weitere nur das Neue. Erkennung und Schreiben sind rein
 * bzw. liegen im Repo; hier ist nur der Transport.
 */

export interface PosteingangErgebnis {
  gesichtet: number;
  verschoben: number;
  zugeordnet: number;
  /** Fuer den Cursor des naechsten Laufs. */
  hoechsteUid: number;
  uidValidity: number;
}

export interface PosteingangRueckrufe {
  bekannteMessageIds: ReadonlySet<string>;
  /** Liefert die Meldungs-Id zur Mail — oder null, wenn nichts sicher passt. */
  ordneZu: (mail: EingehendeMail) => string | null;
  /** Haelt die Antwort fest; false, wenn sie schon vermerkt war. */
  vermerke: (
    meldungId: string,
    vermerk: { receivedAt: number; rawMessageId: string | null; fromAddr: string | null; excerpt: string | null },
  ) => boolean;
}

export async function verarbeitePosteingang(
  env: Env,
  abUid: number,
  rueckrufe: PosteingangRueckrufe,
): Promise<PosteingangErgebnis | null> {
  if (!env.IMAP_HOST || !env.IMAP_USER || !env.IMAP_PASSWORD) return null;

  const client = new ImapFlow({
    host: env.IMAP_HOST,
    port: env.IMAP_PORT,
    secure: true,
    auth: { user: env.IMAP_USER, pass: env.IMAP_PASSWORD },
    logger: false,
  });

  const ergebnis: PosteingangErgebnis = {
    gesichtet: 0,
    verschoben: 0,
    zugeordnet: 0,
    hoechsteUid: abUid,
    uidValidity: 0,
  };

  await client.connect();
  try {
    const schloss = await client.getMailboxLock("INBOX");
    try {
      const postfach = typeof client.mailbox === "object" ? client.mailbox : null;
      ergebnis.uidValidity = Number(postfach?.uidValidity ?? 0);

      const bestaetigungen: number[] = [];
      for await (const nachricht of client.fetch(
        `${abUid + 1}:*`,
        { uid: true, envelope: true, internalDate: true, bodyParts: ["text"] },
        { uid: true },
      )) {
        /* "n:*" liefert bei leerem Rest trotzdem die letzte Mail — die hat
           ein frueherer Lauf schon gesehen. */
        if (nachricht.uid <= abUid) continue;
        ergebnis.gesichtet += 1;
        ergebnis.hoechsteUid = Math.max(ergebnis.hoechsteUid, nachricht.uid);

        const betreff = nachricht.envelope?.subject ?? "";
        const textAnfang = nachricht.bodyParts?.get("text")?.toString("utf8").slice(0, 2000) ?? "";
        const inReplyTo = nachricht.envelope?.inReplyTo?.replace(/[<>]/g, "").trim() || null;
        const absender = nachricht.envelope?.from?.[0]?.address ?? null;

        /* Eigene Kopien sind weder Bestaetigung noch Antwort. */
        if (absender && absender.toLowerCase() === env.MAIL_FROM.toLowerCase()) continue;

        if (
          istEingangsbestaetigung({ betreff, textAnfang, inReplyTo }, rueckrufe.bekannteMessageIds)
        ) {
          bestaetigungen.push(nachricht.uid);
          continue;
        }

        const meldungId = rueckrufe.ordneZu({ betreff, inReplyTo, absender });
        if (!meldungId) continue;

        /* internalDate kommt je nach Server als Date oder String. */
        const roh = nachricht.internalDate ?? nachricht.envelope?.date ?? null;
        const datumMs = roh instanceof Date ? roh.getTime() : roh ? Date.parse(roh) : Number.NaN;
        const neu = rueckrufe.vermerke(meldungId, {
          receivedAt: Number.isFinite(datumMs) ? Math.floor(datumMs / 1000) : Math.floor(Date.now() / 1000),
          rawMessageId: nachricht.envelope?.messageId?.replace(/[<>]/g, "").trim() || null,
          fromAddr: absender,
          excerpt: textAnfang.slice(0, 300).trim() || null,
        });
        if (neu) ergebnis.zugeordnet += 1;
      }

      if (bestaetigungen.length > 0) {
        await client.messageMove(bestaetigungen, env.IMAP_TRASH, { uid: true });
        ergebnis.verschoben = bestaetigungen.length;
      }
    } finally {
      schloss.release();
    }
  } finally {
    await client.logout();
  }
  return ergebnis;
}
