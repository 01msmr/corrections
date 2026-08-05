import type { FC } from "hono/jsx";

/**
 * Sortieren durch Ziehen, ohne Bibliothek: die Zeilen ordnen sich waehrend des
 * Ziehens um, beim Loslassen geht die Id-Liste an /reihenfolge. Faellt
 * JavaScript aus, bleibt die Liste lesbar -- nur das Umsortieren entfaellt.
 */
const DRAG_SCRIPT = `
  const tbody = document.getElementById("fehlerarten-liste");
  const status = document.getElementById("sortier-status");
  let gezogen = null;
  for (const zeile of tbody.querySelectorAll("tr")) {
    zeile.addEventListener("dragstart", () => {
      gezogen = zeile;
      zeile.classList.add("zieht");
    });
    zeile.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (!gezogen || gezogen === zeile) return;
      const r = zeile.getBoundingClientRect();
      zeile.parentNode.insertBefore(
        gezogen,
        e.clientY - r.top > r.height / 2 ? zeile.nextSibling : zeile,
      );
    });
    zeile.addEventListener("dragend", () => {
      zeile.classList.remove("zieht");
      const ids = Array.from(tbody.querySelectorAll("tr"), (r) => r.dataset.id).join(",");
      fetch("/admin/fehlerarten/reihenfolge", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "ids=" + ids,
      }).then(
        (res) => { status.textContent = res.ok ? "Reihenfolge gespeichert." : "Speichern fehlgeschlagen."; },
        () => { status.textContent = "Speichern fehlgeschlagen."; },
      );
    });
  }
`;
import type { ErrorTypeRecord } from "../repo/errorTypes.js";
import { Layout } from "./layout.js";

export const ErrorTypeList: FC<{
  types: ErrorTypeRecord[];
  hinweis?: string | undefined;
  fehler?: string | undefined;
}> = ({ types, hinweis, fehler }) => (
  <Layout title="Kategorien" aktiv="fehlerarten">
    {hinweis ? <p class="hinweis">{hinweis}</p> : null}
    {fehler ? <p class="hinweis">{fehler}</p> : null}

    <table>
      <thead>
        <tr>
          <th></th>
          <th>Bezeichnung</th>
          <th>Schlüssel</th>
          <th></th>
        </tr>
      </thead>
      <tbody id="fehlerarten-liste">
        {types.map((type) => (
          <tr draggable="true" data-id={type.id}>
            <td class="griff" aria-hidden="true">≡</td>
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
    <p id="sortier-status" class="zaehler" aria-live="polite">
      Zum Umsortieren Zeilen mit der Maus ziehen.
    </p>
    <script dangerouslySetInnerHTML={{ __html: DRAG_SCRIPT }} />

    <h2>Neue Kategorie</h2>
    <form method="post" action="/admin/fehlerarten">
      <label for="key">
        <span>Schlüssel:</span> <span class="zaehler">nur a–z, 0–9 und _, danach unveränderlich</span>
      </label>
      <input id="key" name="key" required pattern="[a-z0-9_]+" />

      <label for="label">Bezeichnung:</label>
      <input id="label" name="label" required />

      <label for="description">Beschreibung:</label>
      <textarea id="description" name="description"></textarea>

      <button type="submit">Anlegen</button>
    </form>
  </Layout>
);

export const ErrorTypeEdit: FC<{ type: ErrorTypeRecord }> = ({ type }) => (
  <Layout title={`Kategorie: ${type.label}`} aktiv="fehlerarten">
    <p class="hinweis">
      Schlüssel <code>{type.key}</code> — nicht änderbar, weil er im Meta-Block bereits
      versendeter Mails steht.
    </p>
    <form method="post" action={`/admin/fehlerarten/${type.id}`}>
      <label for="label">Bezeichnung:</label>
      <input id="label" name="label" required value={type.label} />

      <label for="description">Beschreibung:</label>
      <textarea id="description" name="description">{type.description ?? ""}</textarea>

      <button type="submit">Speichern</button>
    </form>
  </Layout>
);
