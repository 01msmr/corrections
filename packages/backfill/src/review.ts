import { appendFileSync, existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { benenneFehlerart, istZaehlbareFehlerart, ZAHLWOERTER } from "@korrektur/shared";
import { Hono } from "hono";
import { leseAltmeldung, type Altmeldung } from "./lesen.js";

/**
 * Review-Queue (Spec §11.4): ein Bildschirm pro Meldung, entschluesselte
 * Mail links, geparste Felder rechts. Enter uebernimmt, E springt ins erste
 * Feld, X verwirft. Sortiert nach Konfidenz absteigend (erst die sicheren,
 * dann die zu pruefenden); bereits Entschiedenes wird beim Wiederanlauf
 * uebersprungen. Entscheidungen als JSONL neben dem Korpus — read-only
 * gegenueber den Mails, nichts davon beruehrt Git.
 */

const KORPUS = fileURLToPath(new URL("../../../fixtures.local/korpus", import.meta.url));
const ENTSCHEIDUNGEN = fileURLToPath(
  new URL("../../../fixtures.local/review-entscheidungen.jsonl", import.meta.url),
);
const PORT = 3223;

/** Heutige Fehlerarten fuer die Auswahl; Schluessel wie im Seed. Bewusst
 *  dupliziert statt aus dem api-Paket importiert — der Backfill teilt mit
 *  dem Dauerbetrieb nur `shared` (§11.5). */
const FEHLERARTEN: [string, string][] = [
  ["zeichen_fehlt", "Zeichen fehlen"],
  ["zeichen_zu_viel", "Zeichen zu viel"],
  ["leerzeichen_fehlt", "Leerzeichen fehlen"],
  ["leerzeichen_zu_viel", "Leerzeichen zu viel"],
  ["buchstabendreher", "ein Buchstabendreher"],
  ["komma_fehlt", "Satzzeichen fehlen"],
  ["komma_zu_viel", "Satzzeichen zu viel"],
  ["wort_fehlt", "Wörter fehlen"],
  ["wort_zu_viel", "Wörter zu viel"],
  ["falsche_wortwahl", "falsche Wortwahl"],
  ["satzbau", "falscher Satzbau"],
  ["schlechter_satzbau", "schlechter Satzbau"],
  ["inhaltsfehler", "Inhaltsfehler"],
  ["falsche_zahl", "eine falsche Zahl"],
  ["falsches_datum", "ein falsches Datum"],
  ["falscher_name", "ein falscher Name"],
  ["toter_link", "ein toter Link"],
  ["linktext", "nichtssagender Linktext"],
  ["sonstiges", "Sonstiges"],
];

interface Entscheidung {
  datei: string;
  entscheidung: "uebernommen" | "verworfen";
  felder?: Record<string, string | null>;
  messageId?: string | null;
  gesendetAm?: string | null;
  empfaenger?: string | null;
  geprueftAm: string;
}

function entschiedeneDateien(): Set<string> {
  if (!existsSync(ENTSCHEIDUNGEN)) return new Set();
  const zeilen = readFileSync(ENTSCHEIDUNGEN, "utf8").split("\n").filter(Boolean);
  return new Set(zeilen.map((zeile) => (JSON.parse(zeile) as Entscheidung).datei));
}

function escapeHtml(wert: string): string {
  return wert
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Warteschlange: sicher zuerst (Enter-Durchlauf), dann pruefen; verworfene
 *  Parser-Ergebnisse tauchen gar nicht erst auf (§11.4: verworfen statt
 *  geraten). Innerhalb einer Stufe chronologisch nach Dateiname (UID). */
async function warteschlange(): Promise<{ datei: string; meldung: Altmeldung }[]> {
  const entschieden = entschiedeneDateien();
  const eintraege: { datei: string; meldung: Altmeldung }[] = [];
  for (const datei of readdirSync(KORPUS).filter((n) => n.endsWith(".eml")).sort()) {
    if (entschieden.has(datei)) continue;
    const meldung = await leseAltmeldung(readFileSync(path.join(KORPUS, datei)));
    if (meldung.konfidenz === "verworfen") continue;
    eintraege.push({ datei, meldung });
  }
  const rang = { sicher: 0, pruefen: 1, verworfen: 2 };
  return eintraege.sort(
    (a, b) => rang[a.meldung.konfidenz] - rang[b.meldung.konfidenz] || a.datei.localeCompare(b.datei),
  );
}

function feld(name: string, beschriftung: string, wert: string | null, mehrzeilig = false): string {
  const inhalt = escapeHtml(wert ?? "");
  const eingabe = mehrzeilig
    ? `<textarea name="${name}" rows="3">${inhalt}</textarea>`
    : `<input name="${name}" value="${inhalt}">`;
  return `<label>${beschriftung}${eingabe}</label>`;
}

function seite(eintrag: { datei: string; meldung: Altmeldung }, offen: number, gesamt: number): string {
  const { datei, meldung } = eintrag;
  /* Jede Option traegt ihre Sprachformen, damit die Benennungszeile beim
     Aendern von Auswahl oder Anzahl ohne Server-Rundreise mitlaeuft. */
  const auswahl = FEHLERARTEN.map(([key, label]) => {
    const zaehlbar = istZaehlbareFehlerart(key);
    const eins = benenneFehlerart(key, label, 1).replace(/^ein /, "");
    const mehr = benenneFehlerart(key, label, 2).replace(/^zwei /, "");
    const daten = zaehlbar ? ` data-eins="${escapeHtml(eins)}" data-mehr="${escapeHtml(mehr)}"` : "";
    return `<option value="${key}"${key === meldung.fehlerartKey ? " selected" : ""}${daten}>${escapeHtml(label)}</option>`;
  }).join("");
  const listenLabel =
    FEHLERARTEN.find(([key]) => key === meldung.fehlerartKey)?.[1] ?? (meldung.fehlerartRoh ?? "—");
  const zaehlt = meldung.fehlerartKey !== null && istZaehlbareFehlerart(meldung.fehlerartKey);
  const ablage =
    (zaehlt && meldung.fehlerartAnzahl ? `(${meldung.fehlerartAnzahl}) ${listenLabel}` : listenLabel) +
    (meldung.fehlerartZeichen ? ` [${meldung.fehlerartZeichen}]` : "");
  const benennung = benenneFehlerart(
    meldung.fehlerartKey ?? "",
    listenLabel,
    meldung.fehlerartAnzahl,
    meldung.fehlerartZeichen,
  );
  const rohLabel = meldung.fehlerartRoh
    ? `<p class="roh">Label im Original: „${escapeHtml(meldung.fehlerartRoh)}“</p>`
    : "";
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><title>Review ${offen} von ${gesamt}</title>
<style>
  body { font: 15px/1.5 system-ui, sans-serif; margin: 0; display: grid;
    grid-template-columns: 1fr 1fr; gap: 1.5rem; height: 100vh; box-sizing: border-box;
    padding: 1rem 1.5rem; background: #f7f7f4; color: #1b1f23; }
  h1 { font-size: 1rem; margin: 0 0 .5rem; grid-column: 1 / -1; }
  h1 .konfidenz { color: #a3323b; font-weight: 700; }
  pre { overflow: auto; margin: 0; padding: .75rem; background: #fffffe;
    border: 1px solid #dcddd8; white-space: pre-wrap; font-size: .85rem; }
  form { display: flex; flex-direction: column; gap: .6rem; overflow: auto; }
  label { display: flex; flex-direction: column; gap: .15rem; font-weight: 600; font-size: .8rem; }
  input, textarea, select { font: inherit; font-weight: 400; padding: .3rem .4rem;
    border: 1px solid #6b7480; background: #fffffe; }
  .roh { margin: 0; font-size: .8rem; color: #6b7480; }
  .knoepfe { display: flex; gap: .75rem; margin-top: .25rem; }
  button { font: inherit; padding: .45rem 1rem; cursor: pointer; border: 2px solid #1b1f23;
    background: #fffffe; }
  button[value="uebernehmen"] { background: #2f6f4e; color: #fffffe; border-color: #2f6f4e; }
  button[value="verwerfen"] { color: #a3323b; border-color: #a3323b; }
  kbd { border: 1px solid #6b7480; border-radius: 3px; padding: 0 .3em; font-size: .75em; }
  .kategoriezeile { display: flex; gap: .5rem; }
  .kategoriezeile input { width: 4.5rem; flex: none; }
  .kategoriezeile input[name="zeichen"] { width: 3.2rem; }
  .kategoriezeile select { flex: 1; min-width: 0; }
</style></head><body>
  <h1>Noch ${offen} von ${gesamt} — <span class="konfidenz">${meldung.konfidenz}</span> · ${escapeHtml(datei)}
    · <kbd>Enter</kbd> übernehmen <kbd>E</kbd> bearbeiten <kbd>X</kbd> verwerfen</h1>
  <pre>${escapeHtml(
    [
      `Betreff: ${meldung.betreff ?? "—"}`,
      `An: ${meldung.empfaenger ?? "—"}`,
      `Datum: ${meldung.gesendetAm?.toISOString() ?? "—"}`,
      "",
      meldung.text,
    ].join("\n"),
  )}</pre>
  <form method="post" action="/entscheidung">
    <input type="hidden" name="datei" value="${escapeHtml(datei)}">
    ${feld("ueberschrift", "Überschrift", meldung.ueberschrift)}
    ${feld("artikelUrl", "Artikel-URL", meldung.artikelUrl)}
    <label>Fehlerart (Anzahl | Art)
      <span class="kategoriezeile">
        <input name="anzahl" type="number" min="1" max="999" value="${meldung.fehlerartAnzahl ?? ""}" aria-label="Anzahl">
        <input name="zeichen" maxlength="3" value="${escapeHtml(meldung.fehlerartZeichen ?? "")}" aria-label="Satzzeichen" placeholder="z. B. ,">
        <select name="fehlerartKey">${auswahl}</select>
      </span>
    </label>
    <p class="roh">abgelegt als <strong id="ablage">${escapeHtml(ablage)}</strong>
      — benannt als „<strong id="benennung">${escapeHtml(benennung)}</strong>“</p>
    ${rohLabel}
    ${feld("falsch", "Falsch ist", meldung.falsch, true)}
    ${feld("richtig", "Richtig wäre", meldung.richtig, true)}
    <div class="knoepfe">
      <button type="submit" name="aktion" value="uebernehmen">Übernehmen (Enter)</button>
      <button type="submit" name="aktion" value="verwerfen">Verwerfen (X)</button>
    </div>
  </form>
  <script>
    const ZAHLWOERTER = ${JSON.stringify(ZAHLWOERTER)};
    const benennungZeigen = () => {
      const select = document.querySelector("select[name=fehlerartKey]");
      const option = select.selectedOptions[0];
      const anzahl = Number(document.querySelector("input[name=anzahl]").value);
      const zaehlbar = Boolean(option.dataset.eins) && anzahl > 0;
      const zahlwort = ZAHLWOERTER[anzahl] ?? String(anzahl);
      document.getElementById("ablage").textContent =
        zaehlbar ? "(" + anzahl + ") " + option.textContent : option.textContent;
      document.getElementById("benennung").textContent = zaehlbar
        ? zahlwort + " " + (anzahl === 1 ? option.dataset.eins : option.dataset.mehr)
        : option.textContent;
    };
    document.querySelector("select[name=fehlerartKey]").addEventListener("change", benennungZeigen);
    document.querySelector("input[name=anzahl]").addEventListener("input", benennungZeigen);
    document.addEventListener("keydown", (e) => {
      const tippt = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
      if (e.key === "Enter" && !tippt) { document.querySelector('button[value="uebernehmen"]').click(); }
      if (!tippt && (e.key === "x" || e.key === "X")) { document.querySelector('button[value="verwerfen"]').click(); }
      if (!tippt && (e.key === "e" || e.key === "E")) { e.preventDefault(); document.querySelector("input[name=ueberschrift]").focus(); }
    });
  </script>
</body></html>`;
}

async function main(): Promise<void> {
  const app = new Hono();
  /* Einmal beim Start geladen; Entscheidungen kuerzen die Schlange im
     Speicher. Ein Neustart liest den JSONL-Stand und macht dort weiter. */
  let schlange = await warteschlange();
  const gesamt = readdirSync(KORPUS).filter((n) => n.endsWith(".eml")).length;

  app.get("/", (c) => {
    const erster = schlange[0];
    if (!erster) {
      return c.html(
        `<!doctype html><meta charset="utf-8"><body style="font:16px system-ui;padding:2rem">
         <h1>Alles entschieden.</h1><p>${gesamt} Mails im Korpus, keine offenen mehr —
         Entscheidungen in <code>fixtures.local/review-entscheidungen.jsonl</code>.</p>`,
      );
    }
    return c.html(seite(erster, schlange.length, gesamt));
  });

  app.post("/entscheidung", async (c) => {
    const body = await c.req.parseBody();
    const datei = String(body["datei"] ?? "");
    if (!datei || datei.includes("/") || datei.includes("..")) return c.text("ungueltig", 400);
    const aktion = body["aktion"] === "verwerfen" ? "verworfen" : "uebernommen";
    const meldung = await leseAltmeldung(readFileSync(path.join(KORPUS, datei)));
    const eintrag: Entscheidung = {
      datei,
      entscheidung: aktion,
      geprueftAm: new Date().toISOString(),
      messageId: meldung.messageId,
      gesendetAm: meldung.gesendetAm?.toISOString() ?? null,
      empfaenger: meldung.empfaenger,
      ...(aktion === "uebernommen"
        ? {
            felder: {
              ueberschrift: String(body["ueberschrift"] ?? "") || null,
              artikelUrl: String(body["artikelUrl"] ?? "") || null,
              fehlerartKey: String(body["fehlerartKey"] ?? "") || null,
              anzahl: String(body["anzahl"] ?? "") || null,
              zeichen: String(body["zeichen"] ?? "") || null,
              falsch: String(body["falsch"] ?? "") || null,
              richtig: String(body["richtig"] ?? "") || null,
            },
          }
        : {}),
    };
    appendFileSync(ENTSCHEIDUNGEN, `${JSON.stringify(eintrag)}\n`);
    schlange = schlange.filter((eintragInSchlange) => eintragInSchlange.datei !== datei);
    return c.redirect("/", 303);
  });

  serve({ fetch: app.fetch, port: PORT });
  console.log(`Review-Queue: http://localhost:${PORT} — ${schlange.length} offen von ${gesamt}`);
}

main().catch((fehler: unknown) => {
  console.error(fehler instanceof Error ? fehler.message : fehler);
  process.exitCode = 1;
});
