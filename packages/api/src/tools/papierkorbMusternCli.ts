import { ImapFlow } from "imapflow";
import { loadWorkerEnv } from "../env.js";
import { passtAufBestaetigungsmuster } from "../inbox/bestaetigung.js";
import { lesbarerText } from "../inbox/dekodieren.js";

/**
 * Einmalwerkzeug: zeigt, wie die Eingangsbestaetigungen im Papierkorb
 * formuliert sind — Grundlage fuer die Muster in BESTAETIGUNGS_MUSTER.
 * Liest nur; nichts wird verschoben oder geloescht.
 *
 * Ausgegeben werden Absender-Domain, Betreffanfang und die erste
 * inhaltliche Zeile. Keine Adressen, keine ganzen Texte.
 */
async function main(): Promise<void> {
  const env = loadWorkerEnv();
  if (!env.IMAP_HOST || !env.IMAP_USER || !env.IMAP_PASSWORD) {
    console.log(JSON.stringify({ level: "info", msg: "IMAP nicht konfiguriert" }));
    return;
  }

  const client = new ImapFlow({
    host: env.IMAP_HOST,
    port: env.IMAP_PORT,
    secure: true,
    auth: { user: env.IMAP_USER, pass: env.IMAP_PASSWORD },
    logger: false,
  });

  await client.connect();
  try {
    const schloss = await client.getMailboxLock(env.IMAP_TRASH);
    try {
      const gesehen = new Set<string>();
      for await (const nachricht of client.fetch(
        { all: true },
        { uid: true, envelope: true, bodyParts: ["text"] },
      )) {
        const betreff = nachricht.envelope?.subject ?? "";
        const text = lesbarerText(nachricht.bodyParts?.get("text")?.toString("utf8") ?? "");
        const domain = (nachricht.envelope?.from?.[0]?.address ?? "").split("@")[1] ?? "?";
        /* Erste Zeile mit Inhalt, Anrede uebersprungen. */
        const zeile =
          text
            .split(/\r?\n/)
            .map((z) => z.trim())
            .find(
              (z) =>
                z.length > 25 &&
                !z.startsWith("--") &&
                !/^[A-Za-z-]+:/.test(z) &&
                !/^(liebe|sehr geehrte|hallo|guten)/i.test(z),
            ) ?? "";
        const schluessel = `${domain}|${zeile.slice(0, 60)}`;
        if (gesehen.has(schluessel)) continue;
        gesehen.add(schluessel);
        console.log(
          JSON.stringify({
            domain,
            betreff: betreff.slice(0, 70),
            zeile: zeile.slice(0, 150),
            erkannt: passtAufBestaetigungsmuster(`${betreff}\n${text}`),
          }),
        );
      }
      console.log(JSON.stringify({ level: "info", msg: "papierkorb gesichtet", muster: gesehen.size }));
    } finally {
      schloss.release();
    }
  } finally {
    await client.logout();
  }
}

main().catch((fehler: unknown) => {
  console.error(JSON.stringify({ level: "error", msg: "gescheitert", fehler: String(fehler) }));
  process.exitCode = 1;
});
