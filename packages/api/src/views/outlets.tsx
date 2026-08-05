import { regionOptionGroups } from "@korrektur/shared";
import type { FC } from "hono/jsx";
import type { OutletRecord } from "../repo/outlets.js";
import { Layout } from "./layout.js";

/**
 * Roh eingegebene Formularwerte, um sie nach einem fehlgeschlagenen Validieren
 * unveraendert zurueckzugeben — statt sie stillschweigend zu verwerfen (§Formular-
 * Grundsatz, siehe CaptureForm-Pfad in routes/capture.tsx für dasselbe Muster).
 */
export interface OutletFormValues {
  name?: string | undefined;
  primaryDomain?: string | undefined;
  publisher?: string | undefined;
  country?: string | undefined;
  contactEmails?: string | undefined;
  notes?: string | undefined;
}

/**
 * Die Kuerzel stehen in `shared`, die Namen kommen von Intl.DisplayNames --
 * deshalb hier nur die Ausgabe. Der gewaehlte Wert wird an regionOptionGroups
 * durchgereicht, damit ein Altwert ausserhalb der Liste erhalten bleibt.
 */
const SprachraumAuswahl: FC<{ gewaehlt: string }> = ({ gewaehlt }) => (
  <select id="country" name="country">
    <option value="">— keiner —</option>
    {regionOptionGroups("de", gewaehlt).map((gruppe) => (
      <optgroup label={gruppe.label}>
        {gruppe.options.map((option) => (
          <option value={option.code} selected={option.code === gewaehlt.toUpperCase()}>
            {option.name} ({option.code})
          </option>
        ))}
      </optgroup>
    ))}
  </select>
);

const Felder: FC<{
  outlet?: OutletRecord | undefined;
  vorgabeDomain?: string | undefined;
  eingabe?: OutletFormValues | undefined;
}> = ({ outlet, vorgabeDomain, eingabe }) => (
  <div class="arbeitsflaeche">
    {/* Hauptspalte: wer die Redaktion ist. */}
    <div class="hauptspalte">
      <div class="feld">
        <label for="name">Name:</label>
        <input
          id="name"
          name="name"
          required
          value={eingabe?.name ?? outlet?.name ?? vorgabeDomain ?? ""}
        />
      </div>

      <div class="feld">
        <label for="primaryDomain">Hauptdomain:</label>
        <input
          id="primaryDomain"
          name="primaryDomain"
          required
          value={eingabe?.primaryDomain ?? outlet?.primaryDomain ?? vorgabeDomain ?? ""}
        />
      </div>

      <div class="feld">
        <label for="publisher">Verlag:</label>
        <input id="publisher" name="publisher" value={eingabe?.publisher ?? outlet?.publisher ?? ""} />
      </div>
    </div>

    {/* Nebenspalte: wie sie erreicht und eingeordnet wird. */}
    <div class="nebenspalte">
      <div class="feld">
        <label for="contactEmails">
          <span>Kontaktadressen:</span>{" "}
          <span class="zaehler">kommagetrennt, erste ist Standardempfänger</span>
        </label>
        <input
          id="contactEmails"
          name="contactEmails"
          value={eingabe?.contactEmails ?? (outlet?.contactEmails ?? []).join(", ")}
        />
      </div>

      <div class="feld">
        <label for="country">
          <span>Sprachraum:</span>
          <span class="zaehler">leer = aus der Domain abgeleitet</span>
        </label>
        <SprachraumAuswahl gewaehlt={eingabe?.country ?? outlet?.country ?? ""} />
      </div>

      <div class="feld">
        <label for="notes">Notizen:</label>
        <textarea id="notes" name="notes">{eingabe?.notes ?? outlet?.notes ?? ""}</textarea>
      </div>
    </div>
  </div>
);

export const OutletList: FC<{
  outlets: OutletRecord[];
  hinweis?: string | undefined;
  fehler?: string | undefined;
  /** Vom Erfassungsformular durchgereicht, wenn dort eine Redaktion fehlte. */
  vorgabeDomain?: string | undefined;
  zurueck?: string | undefined;
  /** Nach fehlgeschlagener Validierung: die getippten Werte, nicht verworfen. */
  eingabe?: OutletFormValues | undefined;
}> = ({ outlets, hinweis, fehler, vorgabeDomain, zurueck, eingabe }) => (
  <Layout title="Medien" aktiv="redaktionen">
    {hinweis ? <p class="hinweis">{hinweis}</p> : null}
    {fehler ? <p class="hinweis">{fehler}</p> : null}

    <h2>Medien</h2>
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Domain</th>
          <th>Kontakt</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {outlets.map((outlet) => (
          <tr data-href={`/admin/redaktionen/${outlet.id}`}>
            <td>
              <a href={`/admin/redaktionen/${outlet.id}`} draggable={false}>{outlet.name}</a>
            </td>
            <td>{outlet.domains.join(", ")}</td>
            <td>{outlet.contactEmails.length}</td>
            <td class="aktion">
              <form
                class="inline"
                method="post"
                action={`/admin/redaktionen/${outlet.id}/loeschen`}
                onsubmit={`return confirm('Medium „${outlet.name}“ wirklich entfernen?')`}
              >
                <button type="submit">Entfernen</button>
              </form>
            </td>
          </tr>
        ))}
      </tbody>
    </table>

    <h2>Neues Medium</h2>
    {vorgabeDomain ? (
      <p class="hinweis">
        Domain <strong>{vorgabeDomain}</strong> kommt aus einem Hinweis, für den noch
        keine Kontaktadresse hinterlegt war. Nach dem Anlegen geht es dorthin zurück.
      </p>
    ) : null}
    <form method="post" action="/admin/redaktionen">
      {zurueck ? <input type="hidden" name="zurueck" value={zurueck} /> : null}
      <Felder vorgabeDomain={vorgabeDomain} eingabe={eingabe} />
      <button type="submit">Anlegen</button>
    </form>
  </Layout>
);

export const OutletEdit: FC<{ outlet: OutletRecord }> = ({ outlet }) => (
  <Layout title={`Medium: ${outlet.name}`} aktiv="redaktionen">
    <form method="post" action={`/admin/redaktionen/${outlet.id}`}>
      <Felder outlet={outlet} />
      <button type="submit">Speichern</button>
    </form>

    <h2>Domains</h2>
    <p>{outlet.domains.join(", ")}</p>
    <form method="post" action={`/admin/redaktionen/${outlet.id}/domains`}>
      <label for="domain">Weitere Domain:</label>
      <input id="domain" name="domain" required />
      <button type="submit">Hinzufügen</button>
    </form>
  </Layout>
);
