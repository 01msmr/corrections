import type { FC } from "hono/jsx";
import type { ErrorTypeRecord } from "../repo/errorTypes.js";
import { Layout } from "./layout.js";

export const ErrorTypeList: FC<{
  types: ErrorTypeRecord[];
  hinweis?: string | undefined;
  fehler?: string | undefined;
}> = ({ types, hinweis, fehler }) => (
  <Layout title="Fehlerarten">
    {hinweis ? <p class="hinweis">{hinweis}</p> : null}
    {fehler ? <p class="hinweis">{fehler}</p> : null}

    <table>
      <thead>
        <tr>
          <th>Reihenfolge</th>
          <th>Bezeichnung</th>
          <th>Schlüssel</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {types.map((type) => (
          <tr>
            <td>{type.sortOrder}</td>
            <td>
              <a href={`/admin/fehlerarten/${type.id}`}>{type.label}</a>
            </td>
            <td>
              <code>{type.key}</code>
            </td>
            <td>
              <form class="inline" method="post" action={`/admin/fehlerarten/${type.id}/loeschen`}>
                <button type="submit">Entfernen</button>
              </form>
            </td>
          </tr>
        ))}
      </tbody>
    </table>

    <h2>Neue Fehlerart</h2>
    <form method="post" action="/admin/fehlerarten">
      <label for="key">
        Schlüssel <span class="zaehler">nur a–z, 0–9 und _, danach unveränderlich</span>
      </label>
      <input id="key" name="key" required pattern="[a-z0-9_]+" />

      <label for="label">Bezeichnung</label>
      <input id="label" name="label" required />

      <label for="description">Beschreibung</label>
      <textarea id="description" name="description"></textarea>

      <label for="sortOrder">Reihenfolge</label>
      <input id="sortOrder" name="sortOrder" type="number" value="130" required />

      <button type="submit">Anlegen</button>
    </form>
  </Layout>
);

export const ErrorTypeEdit: FC<{ type: ErrorTypeRecord }> = ({ type }) => (
  <Layout title={`Fehlerart: ${type.label}`}>
    <p class="hinweis">
      Schlüssel <code>{type.key}</code> — nicht änderbar, weil er im Meta-Block bereits
      versendeter Mails steht.
    </p>
    <form method="post" action={`/admin/fehlerarten/${type.id}`}>
      <label for="label">Bezeichnung</label>
      <input id="label" name="label" required value={type.label} />

      <label for="description">Beschreibung</label>
      <textarea id="description" name="description">{type.description ?? ""}</textarea>

      <label for="sortOrder">Reihenfolge</label>
      <input id="sortOrder" name="sortOrder" type="number" required value={String(type.sortOrder)} />

      <button type="submit">Speichern</button>
    </form>
  </Layout>
);
