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
      die Meldung nicht versendet werden.
    </p>
    <p>
      <a href={`https://${host}/impressum`} target="_blank" rel="noopener noreferrer">
        Impressum von {host} öffnen
      </a>{" "}
      — dort steht die Korrektur- oder Leserbriefadresse meistens.
    </p>
    <p>
      <a href={`/admin/redaktionen?domain=${encodeURIComponent(host)}&zurueck=${encodeURIComponent(zurueck)}`}>
        Redaktion jetzt anlegen
      </a>{" "}
      — Domain ist vorausgefüllt, danach geht es zurück zu dieser Meldung.
    </p>
  </div>
);

export const CaptureForm: FC<{
  errorTypes: ErrorTypeRecord[];
  idempotencyKey: string;
  url: string;
  quote: string;
  fehler?: string | undefined;
  fehlendeRedaktion?: { host: string; zurueck: string } | undefined;
}> = ({ errorTypes, idempotencyKey, url, quote, fehler, fehlendeRedaktion }) => (
  <Layout title="Neue Korrekturmeldung">
    {fehlendeRedaktion ? (
      <FehlendeRedaktion host={fehlendeRedaktion.host} zurueck={fehlendeRedaktion.zurueck} />
    ) : fehler ? (
      <p class="hinweis">{fehler}</p>
    ) : null}
    <form method="post" action="/neu">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      <label for="articleUrl">Artikel-URL</label>
      <input id="articleUrl" name="articleUrl" type="url" required value={url} />

      <label for="headline">Überschrift (optional, wird sonst aus dem Artikel gelesen)</label>
      <input id="headline" name="headline" type="text" />

      <label for="errorTypeKey">Art des Fehlers</label>
      <select id="errorTypeKey" name="errorTypeKey" required>
        {errorTypes.map((type) => (
          <option value={type.key}>{type.label}</option>
        ))}
      </select>

      <label for="severity">Schwere</label>
      <select id="severity" name="severity">
        <option value="1">1 – Kleinigkeit</option>
        <option value="2" selected>
          2 – deutlich
        </option>
        <option value="3">3 – gravierend</option>
      </select>

      <label for="quoteBefore">
        Fundstelle im Wortlaut <span class="zaehler">einfügen, nicht abtippen — max. {QUOTE_MAX_LENGTH} Zeichen</span>
      </label>
      <textarea id="quoteBefore" name="quoteBefore" required maxlength={QUOTE_MAX_LENGTH}>
        {quote}
      </textarea>

      <label for="suggestionAfter">So wäre es richtig</label>
      <textarea id="suggestionAfter" name="suggestionAfter" required></textarea>

      <label for="comment">Anmerkung (optional)</label>
      <textarea id="comment" name="comment"></textarea>

      <button type="submit">Meldung senden</button>
    </form>
  </Layout>
);

export const CaptureResult: FC<{ ref: string; anchored: boolean; sent: boolean }> = ({
  ref,
  anchored,
  sent,
}) => (
  <Layout title="Meldung erfasst">
    <p class="hinweis">
      {sent ? (
        <>
          Die Meldung mit der Kennung <strong>{ref}</strong> wurde erfolgreich versendet.
        </>
      ) : (
        <>
          Die Meldung mit der Kennung <strong>{ref}</strong> konnte nicht versendet werden — der
          Datensatz liegt zur Prüfung bereit.
        </>
      )}
    </p>
    {anchored ? null : (
      <p class="hinweis">
        Die Fundstelle konnte nicht im Artikel verankert werden. Eine spätere automatische
        Korrekturerkennung ist für diesen Datensatz nur eingeschränkt möglich.
      </p>
    )}
    <p>
      <a href="/neu">Weitere Textkorrektur erfassen?</a>
    </p>
  </Layout>
);
