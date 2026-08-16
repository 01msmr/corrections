import type { FC } from "hono/jsx";
import { SACHAUSSAGE_MUSTER } from "@korrektur/shared";
import type { AbgleichLage, AbgleichZeile, Ankerlage } from "../repo/abgleich.js";
import { Layout } from "./layout.js";
import { vergleicheFassungen } from "./vergleich.js";

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

/** Was die Prüfung sah -- in der offenen Schlange steht auch das Negative. */
const PRUEFTEXT: Record<string, string> = {
  changed_as_suggested: "Berichtigung steht im Artikel.",
  unchanged: "Fundstelle unverändert — die Antwort sagt etwas anderes.",
  changed_otherwise: "Anders geändert als vorgeschlagen.",
  passage_gone: "Fundstelle nicht mehr im Text.",
  unreachable: "Artikel nicht lesbar (Bezahlschranke oder Abruf gescheitert).",
};

/** Die Ausgänge, die aus einer Antwort folgen können. */
const AUSWAHL = [
  { wert: "corrected", text: "korrigiert wie vorgeschlagen", taste: "⏎" },
  { wert: "corrected_other", text: "anders korrigiert" },
  { wert: "rejected", text: "als richtig benannt" },
] as const;

export const AbgleichSeite: FC<{
  faelle: AbgleichZeile[];
  lage: AbgleichLage;
  stelle: number;
  /** Offene Schlange: alle Beantworteten, entschieden wird am Wortlaut. */
  offen?: boolean;
  hinweis?: string | undefined;
}> = ({ faelle, lage, stelle, offen = false, hinweis }) => {
  const fall = faelle[stelle];
  return (
    <Layout title="Ausgang abgleichen" aktiv="abgleich" betreiber>
      {hinweis ? <p class="zaehler" aria-live="polite">{hinweis}</p> : null}
      {/* Zwei Schlangen, ein Umschalter: streng verlangt den Doppelbeleg,
          offen legt jede beantwortete Meldung vor. */}
      <p class="zaehlweise abgleichwahl">
        {offen ? (
          <a href="/admin/abgleich">mit Doppelbeleg</a>
        ) : (
          <span aria-current="true">mit Doppelbeleg</span>
        )}
        {offen ? (
          <span aria-current="true">alle Antworten</span>
        ) : (
          <a href="/admin/abgleich?alle=1">alle Antworten</a>
        )}
      </p>
      {!fall ? (
        <>
          <p class="prosa">
            {faelle.length === 0
              ? offen
                ? "Nichts offen: zu jeder beantworteten Meldung steht ein Ausgang."
                : "Nichts abzugleichen: keine Meldung, bei der Antwort und Artikel-Prüfung dasselbe sagen."
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
              <tr><td>davon anderer Befund, nämlich:</td><td>{lage.andererBefund}</td></tr>
              <tr><td class="lageunter">Stelle unverändert — Widerspruch zur Antwort</td><td>{lage.unveraendert}</td></tr>
              <tr><td class="lageunter">anders geändert als vorgeschlagen</td><td>{lage.andersGeaendert}</td></tr>
              <tr><td class="lageunter">Fundstelle nicht im Text</td><td>{lage.verschwunden}</td></tr>
              <tr><td class="lageunter">Seite nicht erreichbar, nämlich:</td><td>{lage.unerreichbar}</td></tr>
              <tr><td class="lageunter lagetief">durch robots.txt ausgeschlossen</td><td>{lage.robotsAusschluss}</td></tr>
              <tr><td class="lageunter lagetief">geholt, aber kein Artikel (Bezahlschranke)</td><td>{lage.bezahlschranke}</td></tr>
              <tr><td class="lageunter lagetief">HTTP-Fehler oder keine Antwort</td><td>{lage.abrufGescheitert}</td></tr>
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
            {/* Dieselbe Korrekturfahne wie im Detail: nur das abweichende
                Wort ist ausgezeichnet, nicht der ganze Satz zweimal. */}
            <p class="abgleichstelle">
              {vergleicheFassungen(fall.quoteBefore, fall.suggestion).map((stueck, i) => (
                <>
                  {i > 0 ? " " : ""}
                  {stueck.art === "gleich" ? (
                    stueck.text
                  ) : stueck.art === "getilgt" ? (
                    <del>{stueck.text}</del>
                  ) : (
                    <ins>{stueck.text}</ins>
                  )}
                </>
              ))}
            </p>
            {/* Die beiden Belege nebeneinander -- daran wird entschieden. */}
            <p class="abgleichbeleg">
              {/* Das Leerzeichen ausdruecklich: JSX schluckt den Umbruch, der
                  Abstand der Marke ist nur Optik -- kopierter Text und
                  Vorlesesoftware klebten die Woerter sonst zusammen. */}
              <span class="belegmarke">Antwort {datum(fall.antwortAm)}</span>{" "}
              {kernsatz(fall.auszug)}
            </p>
            {fall.befund === null ? (
              <p class="abgleichbeleg">
                <span class="belegmarke">Prüfung</span>{" "}
                <span class="belegrat">steht noch aus.</span>
              </p>
            ) : offen && fall.befund !== "changed_as_suggested" ? (
              <p class="abgleichbeleg">
                <span class="belegmarke">Prüfung {datum(fall.geprueftAm)}</span>{" "}
                {PRUEFTEXT[fall.befund] ?? fall.befund}
              </p>
            ) : (
              <p class="abgleichbeleg">
                <span class="belegmarke">Prüfung {datum(fall.geprueftAm)}</span>{" "}
                {BEFUND[fall.ankerlage].satz}
                {BEFUND[fall.ankerlage].rat ? (
                  <span class="belegrat"> {BEFUND[fall.ankerlage].rat}</span>
                ) : null}
              </p>
            )}
            {/* Offen wird gegen den Artikel verglichen, und dafuer braucht es
                beide Fassungen im Wortlaut -- aus der Fahne allein liest sich
                der eigene Vorschlag nicht ab. */}
            {offen ? (
              <>
                <p class="abgleichbeleg">
                  <span class="belegmarke">gemeldet</span> {fall.quoteBefore}
                </p>
                <p class="abgleichbeleg">
                  <span class="belegmarke">vorgeschlagen</span> {fall.suggestion}
                </p>
              </>
            ) : null}
            {/* Eine Antwort ist eine Behauptung. "Wir haben das bereits
                korrigiert" steht auch dort, wo nichts geaendert wurde -- als
                hoefliche Form von "wir diskutieren das nicht". Ohne Beleg im
                Artikel traegt der Ausgang allein den Wortlaut. */}
            {offen && fall.befund !== "changed_as_suggested" ? (
              <p class="abgleichbeleg belegrat">
                Kein Beleg im Artikel: Der Ausgang stützt sich allein auf den Wortlaut
                der Antwort — und der kann eine Höflichkeitsformel sein.
              </p>
            ) : null}
            {/* Hinter der Bezahlschranke sieht unser Abruf nur Abo-Werbung.
                Der Betreiber oeffnet den Artikel angemeldet und fuegt den Text
                ein; geprueft wird damit wie beim eigenen Abruf, gespeichert
                wird nur der Befund. */}
            {offen && fall.befund !== "changed_as_suggested" ? (
              <form
                class="einfuegepruefung"
                method="post"
                action={`/admin/meldungen/${fall.id}/pruefen?zurueck=abgleich&stelle=${stelle}`}
              >
                <label for="artikelText">
                  Artikeltext einfügen (bei Bezahlschranke: angemeldet öffnen, Text kopieren)
                </label>
                <textarea id="artikelText" name="artikelText" rows={3} />
                <button type="submit">gegen diesen Text prüfen</button>
              </form>
            ) : null}
            <div class="abgleichtasten">
              {(offen ? AUSWAHL : AUSWAHL.slice(0, 1)).map((wahl, i) => (
                <form
                  method="post"
                  action={`/admin/abgleich/${fall.id}?stelle=${stelle}${offen ? "&alle=1" : ""}`}
                >
                  <input type="hidden" name="ausgang" value={wahl.wert} />
                  {/* Anders korrigiert heisst: im Artikel steht etwas Drittes.
                      Was, gehoert festgehalten -- sonst bleibt der Ausgang
                      eine Behauptung ohne Wortlaut. */}
                  {wahl.wert === "corrected_other" ? (
                    <input
                      type="text"
                      name="korrigierterText"
                      class="andersfassung"
                      placeholder="was jetzt dort steht"
                      aria-label="Neue Fassung im Artikel"
                    />
                  ) : null}
                  <button type="submit" id={i === 0 ? "uebernehmen" : undefined}>
                    <span class="knopftext">
                      {wahl.text}
                      {"taste" in wahl ? <span class="taste">{wahl.taste}</span> : null}
                    </span>
                  </button>
                </form>
              ))}
              <a
                class="knopf"
                id="weiter"
                href={`/admin/abgleich?stelle=${stelle + 1}${offen ? "&alle=1" : ""}`}
              >
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
