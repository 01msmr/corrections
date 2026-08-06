import type { FC } from "hono/jsx";
import type { ImportErgebnis } from "../tools/backfillImport.js";
import { Layout } from "./layout.js";

/**
 * Adminseite für den einmaligen Altbestand-Import (§11.5). Sie nimmt die
 * Entscheidungsdatei der lokalen Review entgegen — der Korpus selbst bleibt
 * auf dem Rechner. Der Import ergänzt nur: bekannte Message-IDs werden
 * übersprungen, nichts wird geändert oder gelöscht.
 *
 * Ist der Altbestand drin, kann die Route entfallen (eine Zeile in app.ts).
 */
export const BackfillSeite: FC<{
  ergebnis?: ImportErgebnis | undefined;
  lesefehler?: string[] | undefined;
  fehler?: string | undefined;
  /** Medien, denen die benutzte Kontaktadresse nachgetragen wurde. */
  adressen?: number | undefined;
}> = ({ ergebnis, lesefehler, fehler, adressen }) => (
  <Layout title="Altbestand" aktiv="backfill">
    {fehler ? <p class="hinweis">{fehler}</p> : null}

    {ergebnis ? (
      <>
        <h2 class="balken">Ergebnis</h2>
        <div class="eckdaten">
          <div class="kennzahl">
            <span class="kennzahl-titel">Übernommen</span>
            <span class="kennzahl-wert">{ergebnis.uebernommen}</span>
            <span class="kennzahl-fuss">neu angelegt</span>
          </div>
          <div class="kennzahl">
            <span class="kennzahl-titel">Schon vorhanden</span>
            <span class="kennzahl-wert">{ergebnis.uebersprungen}</span>
            <span class="kennzahl-fuss">unverändert gelassen</span>
          </div>
          <div class="kennzahl">
            <span class="kennzahl-titel">Nicht übernommen</span>
            <span class="kennzahl-wert">{ergebnis.nichtUebernommen}</span>
            <span class="kennzahl-fuss">in der Review verworfen</span>
          </div>
        </div>
        {adressen ? (
          <p class="zaehler">
            {adressen === 1
              ? "Einem Medium wurde die benutzte E-Mail-Adresse nachgetragen."
              : `${adressen} Medien wurde die benutzte E-Mail-Adresse nachgetragen.`}
          </p>
        ) : null}
        {ergebnis.fehler.length > 0 || (lesefehler?.length ?? 0) > 0 ? (
          <>
            <h2 class="balken">Übergangen</h2>
            <ul>
              {(lesefehler ?? []).map((zeile) => (
                <li>{zeile}</li>
              ))}
              {ergebnis.fehler.map((zeile) => (
                <li>{zeile}</li>
              ))}
            </ul>
          </>
        ) : null}
      </>
    ) : null}

    <h2 class="balken">Entscheidungen einspielen</h2>
    <div class="prosa-schmal">
      <p>
        Die Datei <code>fixtures.local/review-entscheidungen.jsonl</code> aus der lokalen
        Review hochladen. Der Import legt nur fehlende Meldungen an — bereits erfasste
        bleiben unberührt, auch die über das Formular gemeldeten. Mehrfaches Einspielen
        ist deshalb gefahrlos.
      </p>
    </div>
    <form method="post" action="/admin/backfill" enctype="multipart/form-data">
      <div class="feld">
        <label for="datei">
          <span>Entscheidungsdatei:</span>
          <span class="zaehler">JSONL aus der Review</span>
        </label>
        <input id="datei" name="datei" type="file" accept=".jsonl,.json,text/plain" required />
      </div>
      <button type="submit">Importieren</button>
    </form>
  </Layout>
);
