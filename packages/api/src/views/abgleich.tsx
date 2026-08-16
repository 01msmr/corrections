import type { FC } from "hono/jsx";
import { SACHAUSSAGE_MUSTER } from "@korrektur/shared";
import type { AbgleichLage, AbgleichZeile, Ankerlage } from "../repo/abgleich.js";
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

/** Was die Prüfung gesehen hat -- und wie schwer das wiegt. */
const BEFUND: Record<Ankerlage, { satz: string; rat?: string }> = {
  anker: {
    satz: "Fundstelle zwischen ihren Ankern gefunden und wie vorgeschlagen geändert.",
  },
  altbestand: {
    satz: "Die Berichtigung steht im Artikel. Diese Meldung stammt aus dem Altbestand und trägt keine Anker — mehr lässt sich nicht feststellen.",
    rat: "Bei kurzen Formulierungen lohnt der Blick in den Artikel.",
  },
  gerissen: {
    satz: "Die Berichtigung steht im Artikel, die Anker der Fundstelle greifen aber nicht mehr.",
    rat: "Der Artikel hat sich im Umfeld geändert — hier lohnt der Blick hinein.",
  },
};

export const AbgleichSeite: FC<{
  faelle: AbgleichZeile[];
  lage: AbgleichLage;
  stelle: number;
  hinweis?: string | undefined;
}> = ({ faelle, lage, stelle, hinweis }) => {
  const fall = faelle[stelle];
  return (
    <Layout title="Ausgang abgleichen" aktiv="abgleich" betreiber>
      {hinweis ? <p class="zaehler" aria-live="polite">{hinweis}</p> : null}
      {!fall ? (
        <>
          <p class="prosa">
            {faelle.length === 0
              ? "Nichts abzugleichen: keine Meldung, bei der Antwort und Artikel-Prüfung dasselbe sagen."
              : "Durch. Alle Fälle dieser Runde sind gesichtet."}
          </p>
          {/* Woran es liegt, steht hier statt in einem Werkzeug -- die Frage
              stellt sich genau dort, wo nichts zu tun ist. */}
          <table class="lagetabelle">
            <tbody>
              <tr><td>Meldungen auf „Antwort erhalten"</td><td>{lage.beantwortet}</td></tr>
              <tr><td>davon nennt die Antwort eine Korrektur</td><td>{lage.nenntKorrektur}</td></tr>
              <tr><td>davon noch ohne Artikel-Prüfung</td><td>{lage.ohnePruefung}</td></tr>
              <tr><td>davon geändert, Anker gegriffen</td><td>{lage.starkGeaendert}</td></tr>
              <tr><td>davon geändert, ohne greifende Anker</td><td>{lage.schwachGeaendert}</td></tr>
              <tr><td>davon anderer Befund (unverändert, anders, verschwunden)</td><td>{lage.andererBefund}</td></tr>
            </tbody>
          </table>
        </>
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
              {/* Das Leerzeichen ausdruecklich: JSX schluckt den Umbruch, der
                  Abstand der Marke ist nur Optik -- kopierter Text und
                  Vorlesesoftware klebten die Woerter sonst zusammen. */}
              <span class="belegmarke">Antwort {datum(fall.antwortAm)}</span>{" "}
              {kernsatz(fall.auszug)}
            </p>
            <p class="abgleichbeleg">
              <span class="belegmarke">Prüfung {datum(fall.geprueftAm)}</span>{" "}
              {BEFUND[fall.ankerlage].satz}
              {BEFUND[fall.ankerlage].rat ? (
                <span class="belegrat"> {BEFUND[fall.ankerlage].rat}</span>
              ) : null}
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
