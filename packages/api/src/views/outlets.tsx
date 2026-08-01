import type { FC } from "hono/jsx";
import type { OutletRecord } from "../repo/outlets.js";
import { Layout } from "./layout.js";

const Felder: FC<{ outlet?: OutletRecord | undefined; vorgabeDomain?: string | undefined }> = ({
  outlet,
  vorgabeDomain,
}) => (
  <>
    <label for="name">Name</label>
    <input id="name" name="name" required value={outlet?.name ?? vorgabeDomain ?? ""} />

    <label for="primaryDomain">Hauptdomain</label>
    <input
      id="primaryDomain"
      name="primaryDomain"
      required
      value={outlet?.primaryDomain ?? vorgabeDomain ?? ""}
    />

    <label for="publisher">Verlag</label>
    <input id="publisher" name="publisher" value={outlet?.publisher ?? ""} />

    <label for="country">Land (zwei Buchstaben)</label>
    <input id="country" name="country" maxlength={2} value={outlet?.country ?? ""} />

    <label for="contactEmails">
      Kontaktadressen <span class="zaehler">kommagetrennt, erste ist Standardempfänger</span>
    </label>
    <input id="contactEmails" name="contactEmails" value={(outlet?.contactEmails ?? []).join(", ")} />

    <label for="notes">Notizen</label>
    <textarea id="notes" name="notes">{outlet?.notes ?? ""}</textarea>
  </>
);

export const OutletList: FC<{
  outlets: OutletRecord[];
  hinweis?: string | undefined;
  fehler?: string | undefined;
  /** Vom Erfassungsformular durchgereicht, wenn dort eine Redaktion fehlte. */
  vorgabeDomain?: string | undefined;
  zurueck?: string | undefined;
}> = ({ outlets, hinweis, fehler, vorgabeDomain, zurueck }) => (
  <Layout title="Redaktionen">
    {hinweis ? <p class="hinweis">{hinweis}</p> : null}
    {fehler ? <p class="hinweis">{fehler}</p> : null}

    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Domains</th>
          <th>Kontakt</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {outlets.map((outlet) => (
          <tr>
            <td>
              <a href={`/admin/redaktionen/${outlet.id}`}>{outlet.name}</a>
            </td>
            <td>{outlet.domains.join(", ")}</td>
            <td>{outlet.contactEmails.length}</td>
            <td>
              <form class="inline" method="post" action={`/admin/redaktionen/${outlet.id}/loeschen`}>
                <button type="submit">Entfernen</button>
              </form>
            </td>
          </tr>
        ))}
      </tbody>
    </table>

    <h2>Neue Redaktion</h2>
    {vorgabeDomain ? (
      <p class="hinweis">
        Domain <strong>{vorgabeDomain}</strong> kommt aus einer Meldung, für die noch
        keine Kontaktadresse hinterlegt war. Nach dem Anlegen geht es dorthin zurück.
      </p>
    ) : null}
    <form method="post" action="/admin/redaktionen">
      {zurueck ? <input type="hidden" name="zurueck" value={zurueck} /> : null}
      <Felder vorgabeDomain={vorgabeDomain} />
      <button type="submit">Anlegen</button>
    </form>
  </Layout>
);

export const OutletEdit: FC<{ outlet: OutletRecord }> = ({ outlet }) => (
  <Layout title={`Redaktion: ${outlet.name}`}>
    <form method="post" action={`/admin/redaktionen/${outlet.id}`}>
      <Felder outlet={outlet} />
      <button type="submit">Speichern</button>
    </form>

    <h2>Domains</h2>
    <p>{outlet.domains.join(", ")}</p>
    <form method="post" action={`/admin/redaktionen/${outlet.id}/domains`}>
      <label for="domain">Weitere Domain</label>
      <input id="domain" name="domain" required />
      <button type="submit">Hinzufügen</button>
    </form>
  </Layout>
);
