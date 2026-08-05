import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { leseAltmeldung } from "./lesen.js";

/**
 * Probelauf des Parsers ueber den ganzen Korpus: gibt ausschliesslich
 * Aggregatzahlen und Label-Namen aus, keine Mailinhalte. Dient dazu, die
 * Vorlagen-Deckung zu pruefen, bevor die Review-Queue gebaut wird.
 */
const KORPUS = fileURLToPath(new URL("../../../fixtures.local/korpus", import.meta.url));

async function main(): Promise<void> {
  const dateien = readdirSync(KORPUS).filter((name) => name.endsWith(".eml"));
  const zaehler = { sicher: 0, pruefen: 0, verworfen: 0 };
  const ungemappt = new Map<string, number>();
  const fehlend = { url: 0, falsch: 0, richtig: 0, ueberschrift: 0, messageId: 0, empfaenger: 0 };

  for (const name of dateien) {
    const meldung = await leseAltmeldung(readFileSync(path.join(KORPUS, name)));
    zaehler[meldung.konfidenz] += 1;
    if (meldung.artikelUrl === null) fehlend.url += 1;
    if (meldung.falsch === null) fehlend.falsch += 1;
    if (meldung.richtig === null) fehlend.richtig += 1;
    if (meldung.ueberschrift === null) fehlend.ueberschrift += 1;
    if (meldung.messageId === null) fehlend.messageId += 1;
    if (meldung.empfaenger === null) fehlend.empfaenger += 1;
    if (meldung.konfidenz === "pruefen" && meldung.fehlerartRoh !== null) {
      ungemappt.set(meldung.fehlerartRoh, (ungemappt.get(meldung.fehlerartRoh) ?? 0) + 1);
    }
  }

  console.log(`${dateien.length} Mails gelesen`);
  console.log(`sicher: ${zaehler.sicher}  pruefen: ${zaehler.pruefen}  verworfen: ${zaehler.verworfen}`);
  console.log("fehlende Felder:", fehlend);
  const haeufigste = [...ungemappt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  console.log("haeufigste ungemappte Labels:");
  for (const [label, anzahl] of haeufigste) console.log(`  ${anzahl}× ${label}`);
}

main().catch((fehler: unknown) => {
  console.error(fehler instanceof Error ? fehler.message : fehler);
  process.exitCode = 1;
});
