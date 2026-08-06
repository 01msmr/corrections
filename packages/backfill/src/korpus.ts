import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ImapFlow } from "imapflow";

/**
 * Korpus-Export (Spec §11.1): zieht einmalig alle Mails aus dem
 * Gesendet-Ordner als .eml nach fixtures.local/korpus — read-only (PEEK,
 * keine Flag-Aenderungen) und idempotent: bereits exportierte Nachrichten
 * werden anhand von UIDVALIDITY+UID uebersprungen, ein Wiederanlauf nach
 * Abbruch holt nur den Rest. Danach arbeitet der Parser ausschliesslich
 * gegen diese Dateien, nie wiederholt gegen IMAP.
 *
 * Zugangsdaten aus .env.local: IMAP_HOST/IMAP_USER/IMAP_PASSWORD, ersatzweise
 * die SMTP_-Werte (gleiches netcup-Postfach); IMAP_PORT (Vorgabe 993) und
 * IMAP_SENT_MAILBOX (Vorgabe: der als \\Sent markierte Ordner) sind optional.
 */

const ZIEL = fileURLToPath(new URL("../../../fixtures.local/korpus", import.meta.url));

function zugang(name: string, ersatz: string): string {
  const wert = process.env[name] ?? process.env[ersatz];
  if (!wert) throw new Error(`Weder ${name} noch ${ersatz} gesetzt — .env.local pruefen`);
  return wert;
}

async function main(): Promise<void> {
  const client = new ImapFlow({
    host: zugang("IMAP_HOST", "SMTP_HOST"),
    port: Number(process.env["IMAP_PORT"] ?? 993),
    secure: true,
    auth: {
      user: zugang("IMAP_USER", "SMTP_USER"),
      pass: zugang("IMAP_PASSWORD", "SMTP_PASSWORD"),
    },
    logger: false,
  });

  await client.connect();
  try {
    let ordner = process.env["IMAP_SENT_MAILBOX"];
    if (!ordner) {
      const liste = await client.list();
      ordner = liste.find((eintrag) => eintrag.specialUse === "\\Sent")?.path;
    }
    if (!ordner) {
      const liste = await client.list();
      const namen = liste.map((eintrag) => eintrag.path).join(", ");
      throw new Error(`Kein Gesendet-Ordner gefunden — IMAP_SENT_MAILBOX setzen. Vorhanden: ${namen}`);
    }

    const schloss = await client.getMailboxLock(ordner, { readOnly: true });
    try {
      const postfach = client.mailbox;
      if (postfach === false) throw new Error("Postfach ließ sich nicht öffnen");
      console.log(`Ordner "${ordner}": ${postfach.exists} Nachrichten, Ziel ${ZIEL}`);
      if (postfach.exists === 0) return;

      mkdirSync(ZIEL, { recursive: true });
      let neu = 0;
      let uebersprungen = 0;
      for await (const nachricht of client.fetch("1:*", { uid: true, source: true })) {
        const datei = path.join(ZIEL, `${postfach.uidValidity}-${nachricht.uid}.eml`);
        if (existsSync(datei)) {
          uebersprungen += 1;
          continue;
        }
        if (!nachricht.source) {
          console.warn(`UID ${nachricht.uid}: keine Quelle geliefert, übersprungen`);
          continue;
        }
        writeFileSync(datei, nachricht.source);
        neu += 1;
        if (neu % 25 === 0) console.log(`… ${neu} exportiert`);
      }
      console.log(`Fertig: ${neu} neu exportiert, ${uebersprungen} lagen schon da.`);
    } finally {
      schloss.release();
    }
  } finally {
    await client.logout();
  }
}

main().catch((fehler: unknown) => {
  console.error(fehler instanceof Error ? fehler.message : fehler);
  process.exitCode = 1;
});
