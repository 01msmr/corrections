import { QUOTE_MAX_LENGTH } from "@korrektur/shared";
import type { FC } from "hono/jsx";
import type { ErrorTypeRecord } from "../repo/errorTypes.js";
import { Layout } from "./layout.js";

/**
 * Wird gezeigt, wenn fuer die Domain keine Kontaktadresse hinterlegt ist.
 * Statt nur zu melden, dass es nicht geht, fuehrt der Block zu den beiden
 * Handgriffen, die dann noetig sind: Adresse im Impressum nachschlagen und
 * die Redaktion anlegen.
 *
 * Sichtbar nur fuer den angemeldeten Betreiber — /neu liegt hinter der
 * Basic-Auth. Die spaetere oeffentliche Erfassung fuer Fremde (Abschnitt 15
 * der Spec) darf diesen Block nicht rendern.
 */
const FehlendeRedaktion: FC<{ host: string; zurueck: string }> = ({ host, zurueck }) => (
  <div class="hinweis">
    <p>
      Für <strong>{host}</strong> ist keine Kontaktadresse hinterlegt — ohne die kann
      der Hinweis nicht versendet werden.
    </p>
    <p>
      <a href={`https://${host}/impressum`} target="_blank" rel="noopener noreferrer">
        Impressum von {host} öffnen
      </a>{" "}
      — dort steht die Korrektur- oder Leserbriefadresse meistens.
    </p>
    <p>
      <a href={`/admin/redaktionen?domain=${encodeURIComponent(host)}&zurueck=${encodeURIComponent(zurueck)}`}>
        Titel jetzt anlegen
      </a>{" "}
      — Domain ist vorausgefüllt, danach geht es zurück zu diesem Hinweis.
    </p>
  </div>
);

/**
 * Korrekturzeichen unmittelbar vor der Beschriftung. Es steht nur dort, wo
 * tatsaechlich korrigiert wird — Tilgen, Einfuegen, Randbemerkung —, damit die
 * drei Zeichen etwas bedeuten und nicht jede Zeile zieren.
 *
 * aria-hidden, weil die Beschriftung daneben dieselbe Aussage in Worten trifft:
 * vorgelesen waere das Zeichen eine Dopplung ohne Mehrwert.
 */
/**
 * Fragt die Kategorie-Erkennung ab, sobald beide Fassungen dastehen -- aber
 * nur, solange die Auswahl nicht von Hand getroffen wurde: eine bewusste
 * Entscheidung wird nie ueberschrieben.
 */
const ERKENNUNG_SCRIPT = `
  const falsch = document.getElementById("quoteBefore");
  const richtig = document.getElementById("suggestionAfter");
  const auswahl = document.getElementById("errorTypeKey");
  const schwere = document.getElementById("severity");
  const hinweis = document.getElementById("kategorie-hinweis");
  let manuell = false;
  let schwereManuell = false;
  let zeitgeber = null;
  auswahl.addEventListener("change", () => { manuell = true; hinweis.textContent = ""; });
  schwere.addEventListener("change", () => { schwereManuell = true; });
  const pruefen = () => {
    if (!falsch.value.trim() || !richtig.value.trim()) return;
    fetch("/neu/kategorie", {
      method: "POST",
      body: new URLSearchParams({ falsch: falsch.value, richtig: richtig.value }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((daten) => {
        if (!daten) return;
        if (!manuell) {
          if (daten.kategorie) {
            auswahl.value = daten.kategorie;
            hinweis.textContent = "automatisch erkannt";
          } else {
            hinweis.textContent = "";
          }
        }
        if (!schwereManuell && daten.schwere) schwere.value = String(daten.schwere);
      })
      .catch(() => {});
  };
  for (const feld of [falsch, richtig]) {
    feld.addEventListener("input", () => {
      clearTimeout(zeitgeber);
      zeitgeber = setTimeout(pruefen, 400);
    });
  }
`;

const Zeichen: FC<{ art: "url" | "titel" | "falsch" | "richtig" | "notiz"; titel: string }> = ({
  art,
  titel,
}) => (
  <span class={`zeichen zeichen-${art}`} aria-hidden="true" title={titel} />
);

export const CaptureForm: FC<{
  errorTypes: ErrorTypeRecord[];
  idempotencyKey: string;
  url: string;
  quote: string;
  fehler?: string | undefined;
  fehlendeRedaktion?: { host: string; zurueck: string } | undefined;
}> = ({ errorTypes, idempotencyKey, url, quote, fehler, fehlendeRedaktion }) => (
  <Layout title="Neue Korrektur" aktiv="neu">
    {fehlendeRedaktion ? (
      <FehlendeRedaktion host={fehlendeRedaktion.host} zurueck={fehlendeRedaktion.zurueck} />
    ) : fehler ? (
      <p class="hinweis">{fehler}</p>
    ) : null}
    <form class="arbeitsflaeche" method="post" action="/neu/vorschau">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      {/* Hauptspalte: der Artikel und die eigentliche Korrektur. */}
      <div class="hauptspalte">
        <div class="feld">
          <label for="articleUrl">
            <span>
              <Zeichen art="url" titel="Adresse des Artikels" />
              Artikel-URL:
            </span>
          </label>
          <input id="articleUrl" name="articleUrl" type="url" required value={url} />
        </div>

        <div class="feld">
          <label for="headline">
            <span>
              <Zeichen art="titel" titel="Überschrift des Artikels" />
              Überschrift:
            </span>
            <span class="zaehler">optional — wird sonst aus dem Artikel gelesen</span>
          </label>
          <input id="headline" name="headline" type="text" />
        </div>

        {/* Untereinander, nicht nebeneinander: so lassen sich die beiden
            Fassungen zeilenweise vergleichen, wie auf einer Korrekturfahne. */}
        <div class="feld">
          <label for="quoteBefore">
            <span>
              <Zeichen art="falsch" titel="So steht es im Artikel" />
              Falsch ist:
            </span>
            <span class="zaehler">bis zu {QUOTE_MAX_LENGTH} Zeichen</span>
          </label>
          <textarea id="quoteBefore" name="quoteBefore" required maxlength={QUOTE_MAX_LENGTH}>
            {quote}
          </textarea>
        </div>

        <div class="feld">
          <label for="suggestionAfter">
            <span>
              <Zeichen art="richtig" titel="So wäre es richtig" />
              Richtig wäre:
            </span>
            <span class="zaehler">die berichtigte Fassung</span>
          </label>
          <textarea id="suggestionAfter" name="suggestionAfter" required></textarea>
        </div>
      </div>

      {/* Nebenspalte: Einordnung und Randbemerkung — nötig, aber nicht die Arbeit. */}
      <aside class="nebenspalte">
        <div class="feld">
          <label for="errorTypeKey">
            <span>Kategorie:</span>
            <span id="kategorie-hinweis" class="zaehler" aria-live="polite"></span>
          </label>
          <select id="errorTypeKey" name="errorTypeKey" required>
            {errorTypes.map((type) => (
              <option value={type.key}>{type.label}</option>
            ))}
          </select>
        </div>

        <div class="feld">
          <label for="severity">Schwere:</label>
          <select id="severity" name="severity">
            <option value="1">kosmetisch</option>
            <option value="2" selected>
              störend
            </option>
            <option value="3">sinnentstellend</option>
          </select>
        </div>

        <div class="feld">
          <label for="comment">
            <span>
              <Zeichen art="notiz" titel="Randbemerkung" />
              Anmerkung:
            </span>
            <span class="zaehler">optional</span>
          </label>
          <textarea id="comment" name="comment"></textarea>
        </div>

        {/* Unten in der Nebenspalte: der Knopf schliesst den Vorgang ab und
            steht dort, wo der Blick nach dem Ausfuellen endet. */}
        <div class="abschluss">
          <button type="submit">
              <span class="knopftext">
                Korrektur-Vorschau<span class="taste" aria-hidden="true">⏎</span>
              </span>
            </button>
        </div>
      </aside>
    </form>
    <script dangerouslySetInnerHTML={{ __html: ERKENNUNG_SCRIPT }} />
  </Layout>
);

export const CapturePreview: FC<{
  an: string;
  subject: string;
  mailHtml: string;
  /** Alle Formularwerte, unveraendert als versteckte Felder weitergereicht. */
  werte: Record<string, string>;
}> = ({ an, subject, mailHtml, werte }) => (
  <Layout title="Vorschau" aktiv="neu">
    <div class="mailkopf">
      <div>
        <span class="zaehler">An:</span> {an}
      </div>
      <div>
        <span class="zaehler">Betreff:</span> {subject}
      </div>
    </div>
    {/* Inhalt stammt aus composeMail; alle Nutzereingaben sind dort maskiert. */}
    <div class="mailvorschau" dangerouslySetInnerHTML={{ __html: mailHtml }} />
    <form method="post" action="/neu">
      {Object.entries(werte).map(([name, wert]) => (
        <input type="hidden" name={name} value={wert} />
      ))}
      <button type="submit">✉️ Korrektur senden</button>
    </form>
    <p>
      <a href="javascript:history.back()">Zurück zum Formular</a>
      <span class="zaehler"> — die Eingaben bleiben erhalten.</span>
    </p>
  </Layout>
);

export const CaptureResult: FC<{
  ref: string;
  anchored: boolean;
  artikelGeladen: boolean;
  sent: boolean;
}> = ({ ref, anchored, artikelGeladen, sent }) => (
  <Layout title="Hinweis erfasst" aktiv="neu">
    <p class="hinweis">
      {sent ? (
        <>
          Der Hinweis mit der Kennung <span class="kennung">{ref}</span> wurde erfolgreich
          versendet.
        </>
      ) : (
        <>
          Der Hinweis mit der Kennung <span class="kennung">{ref}</span> konnte nicht versendet
          werden — der
          Datensatz liegt zur Prüfung bereit.
        </>
      )}
    </p>
    {anchored ? null : (
      <p class="hinweis">
        {artikelGeladen
          ? "Die Fundstelle wurde im geladenen Artikel nicht eindeutig gefunden. Eine spätere automatische Korrekturerkennung ist für diesen Datensatz nur eingeschränkt möglich."
          : "Der Artikel ließ sich nicht abrufen — viele Seiten liefern Servern nur eine Paywall- oder Zustimmungsseite aus. Ohne Artikeltext kann die Fundstelle nicht verankert werden; am Hinweis selbst ändert das nichts."}
      </p>
    )}
    <p>
      <a href="/neu">Weitere Textkorrektur erfassen?</a>
    </p>
  </Layout>
);
