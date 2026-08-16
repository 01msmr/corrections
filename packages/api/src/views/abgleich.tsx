import type { FC } from "hono/jsx";
import { SACHAUSSAGE_MUSTER } from "@korrektur/shared";
import type { AbgleichZeile } from "../repo/abgleich.js";
import { Layout } from "./layout.js";

/**
 * Ausgangs-Abgleich: ein Fall je Bildschirm, wie in der Backfill-Review.
 * Uebernehmen setzt "korrigiert wie vorgeschlagen"; das Korrektur-Datum kommt
 * aus der Artikel-Pruefung, denn sie hat die Aenderung gesehen.
 */

function datum(epoche: number): string {
  const d = new Date(epoche * 1000);
  return `${d.getUTCDate()}. ${d.getUTCMonth() + 1}. ${d.getUTCFullYear()}`;
}

/** Der Satz, der die Korrektur nennt -- nicht die ganze Mail. */
function kernsatz(auszug: string): string {
  const saetze = auszug.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
  const treffer = saetze.find((satz) => {
    const klein = satz.toLowerCase();
    return SACHAUSSAGE_MUSTER.some((muster) => klein.includes(muster));
  });
  return (treffer ?? saetze[0] ?? auszug).trim();
}

export const AbgleichSeite: FC<{
  faelle: AbgleichZeile[];
  stelle: number;
  hinweis?: string | undefined;
}> = ({ faelle, stelle, hinweis }) => {
  const fall = faelle[stelle];
  return (
    <Layout title="Ausgang abgleichen" aktiv="abgleich" betreiber>
      {hinweis ? <p class="zaehler" aria-live="polite">{hinweis}</p> : null}
      {!fall ? (
        <p class="prosa">
          {faelle.length === 0
            ? "Nichts abzugleichen: keine Meldung, bei der Antwort und Artikel-Prüfung dasselbe sagen."
            : "Durch. Alle Fälle dieser Runde sind gesichtet."}
        </p>
      ) : (
        <>
          <p class="zaehler">
            {stelle + 1} von {faelle.length}
          </p>
          <div class="abgleichfall">
            <p class="abgleichkopf">
              <code>{fall.ref}</code> · {fall.medium} · {fall.kategorie}
            </p>
            <p class="abgleichtitel">
              <a href={fall.articleUrl} target="_blank" rel="noopener">
                {fall.headline ?? fall.articleUrl}
              </a>
            </p>
            <p class="abgleichstelle">
              <del>{fall.quoteBefore}</del> <ins>{fall.suggestion}</ins>
            </p>
            {/* Die beiden Belege nebeneinander -- daran wird entschieden. */}
            <p class="abgleichbeleg">
              <span class="belegmarke">Antwort {datum(fall.antwortAm)}</span>
              {kernsatz(fall.auszug)}
            </p>
            <p class="abgleichbeleg">
              <span class="belegmarke">Prüfung {datum(fall.geprueftAm)}</span>
              Fundstelle wie vorgeschlagen geändert.
            </p>
            <div class="abgleichtasten">
              <form method="post" action={`/admin/abgleich/${fall.id}?stelle=${stelle}`}>
                <button type="submit" id="uebernehmen">
                  <span class="knopftext">
                    korrigiert wie vorgeschlagen<span class="taste">⏎</span>
                  </span>
                </button>
              </form>
              <a class="knopf" id="weiter" href={`/admin/abgleich?stelle=${stelle + 1}`}>
                <span class="knopftext">
                  weiter<span class="taste">X</span>
                </span>
              </a>
              <a class="zurueckliste" href={`/admin/meldungen/${fall.id}`}>
                im Detail öffnen
              </a>
            </div>
          </div>
          <script
            dangerouslySetInnerHTML={{
              __html: `
  /* Tastatur wie in der Backfill-Review: Eingabetaste uebernimmt, X geht
     weiter. Nicht in Eingabefeldern -- hier gibt es keine, aber die
     Bedingung haelt das Verhalten stabil, falls welche dazukommen. */
  addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key === "Enter") document.getElementById("uebernehmen")?.click();
    if (e.key === "x" || e.key === "X") document.getElementById("weiter")?.click();
  });`,
            }}
          />
        </>
      )}
    </Layout>
  );
};
