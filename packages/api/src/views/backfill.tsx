import type { FC } from "hono/jsx";
import type { ImportErgebnis } from "../tools/backfillImport.js";
import type { StammdatenErgebnis } from "../tools/medienStammdaten.js";
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
  stammdaten?: StammdatenErgebnis | undefined;
}> = ({ ergebnis, lesefehler, fehler, adressen, stammdaten }) => (
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

    {stammdaten ? (
      <>
        <h2 class="balken">Stammdaten übernommen</h2>
        <div class="eckdaten">
          <div class="kennzahl">
            <span class="kennzahl-titel">Angelegt</span>
            <span class="kennzahl-wert">{stammdaten.angelegt}</span>
            <span class="kennzahl-fuss">neue Medien</span>
          </div>
          <div class="kennzahl">
            <span class="kennzahl-titel">Aktualisiert</span>
            <span class="kennzahl-wert">{stammdaten.aktualisiert}</span>
            <span class="kennzahl-fuss">Name oder Adresse</span>
          </div>
          <div class="kennzahl">
            <span class="kennzahl-titel">Unverändert</span>
            <span class="kennzahl-wert">{stammdaten.unveraendert}</span>
            <span class="kennzahl-fuss">stimmten schon</span>
          </div>
        </div>
        {stammdaten.fehler.length > 0 ? (
          <ul>
            {stammdaten.fehler.map((zeile) => (
              <li>{zeile}</li>
            ))}
          </ul>
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

    <h2 class="balken">Medien aus dem Kurzbefehl</h2>
    <div class="prosa-schmal">
      <p>
        Die Stammdaten aus <code>db/medien.json</code> werden bei jedem Start
        übernommen — hier nur nötig, wenn eine Änderung sofort greifen soll, ohne auf
        den nächsten Deploy zu warten. Format: je Medium ein Eintrag mit
        <code>RedNAME</code> und <code>RedMAIL</code>.
      </p>
    </div>
    <form method="post" action="/admin/backfill/medien" enctype="multipart/form-data">
      <div class="feld">
        <label for="medien">
          <span>Wörterbuch:</span>
          <span class="zaehler">JSON aus dem Kurzbefehl</span>
        </label>
        <input id="medien" name="datei" type="file" accept=".json,application/json" required />
      </div>
      <button type="submit">Stammdaten übernehmen</button>
    </form>
  </Layout>
);
