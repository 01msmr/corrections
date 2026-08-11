import type { FC } from "hono/jsx";

/**
 * Sortieren durch Ziehen, ohne Bibliothek. Gezogen wird die ganze Zeile; das
 * Zeichen am Anfang zeigt nur an, dass sie sich ziehen laesst. Waehrend des Ziehens zeigt eine
 * karminrote Einfuegemarke die Zielposition, die Quellzeile steht abgeschwaecht,
 * und den durchscheinenden Abzug unter dem Zeiger (Drag-Ghost) rendert der
 * Browser selbst. Verschoben wird erst beim Loslassen; dann geht die Id-Liste
 * an /reihenfolge. Faellt JavaScript aus, bleibt die Liste lesbar -- nur das
 * Umsortieren entfaellt.
 */
const DRAG_SCRIPT = `
  const tbody = document.getElementById("fehlerarten-liste");
  const status = document.getElementById("sortier-status");
  let gezogen = null;
  let ausgangslage = "";
  const reihen = () => Array.from(tbody.querySelectorAll("tr"), (r) => r.dataset.id).join(",");
  const marken = () => {
    for (const r of tbody.querySelectorAll("tr")) r.classList.remove("ziel-oben", "ziel-unten");
  };
  for (const zeile of tbody.querySelectorAll("tr")) {
    zeile.addEventListener("dragstart", (e) => {
      gezogen = zeile;
      ausgangslage = reihen();
      zeile.classList.add("zieht");
      e.dataTransfer.effectAllowed = "move";
    });
    zeile.addEventListener("dragend", () => {
      zeile.classList.remove("zieht");
      marken();
      gezogen = null;
      const jetzt = reihen();
      if (jetzt === ausgangslage) return;
      fetch("/admin/fehlerarten/reihenfolge", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "ids=" + jetzt,
      }).then(
        (res) => { status.textContent = res.ok ? "Reihenfolge gespeichert." : "Speichern fehlgeschlagen."; },
        () => { status.textContent = "Speichern fehlgeschlagen."; },
      );
    });
    zeile.addEventListener("dragover", (e) => {
      if (!gezogen || gezogen === zeile) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const r = zeile.getBoundingClientRect();
      marken();
      zeile.classList.add(e.clientY - r.top > r.height / 2 ? "ziel-unten" : "ziel-oben");
    });
    zeile.addEventListener("drop", (e) => {
      if (!gezogen || gezogen === zeile) return;
      e.preventDefault();
      const r = zeile.getBoundingClientRect();
      const unten = e.clientY - r.top > r.height / 2;
      zeile.parentNode.insertBefore(gezogen, unten ? zeile.nextSibling : zeile);
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
  <Layout title="Kategorien" aktiv="fehlerarten" betreiber>
    {hinweis ? <p class="hinweis">{hinweis}</p> : null}
    {fehler ? <p class="hinweis">{fehler}</p> : null}

    <h2 class="balken">Kategorien</h2>
    <table>
      <thead>
        <tr>
          <th></th>
          <th>Bezeichnung</th>
          <th>Schlüssel</th>
          <th class="aktion"></th>
        </tr>
      </thead>
      <tbody id="fehlerarten-liste">
        {types.map((type) => (
          <tr data-id={type.id} data-href={`/admin/fehlerarten/${type.id}`} draggable="true">
            <td class="griff" aria-hidden="true">≡</td>
            <td>
              <a href={`/admin/fehlerarten/${type.id}`} draggable={false}>{type.label}</a>
            </td>
            <td>
              <code>{type.key}</code>
            </td>
            <td class="aktion">
              <form
                class="inline"
                method="post"
                action={`/admin/fehlerarten/${type.id}/loeschen`}
                onsubmit={`return confirm('Kategorie „${type.label}“ wirklich entfernen?')`}
              >
                <button type="submit">Entfernen</button>
              </form>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    <p id="sortier-status" class="zaehler" aria-live="polite">
      Zum Umsortieren die Zeile ziehen.
    </p>
    <script dangerouslySetInnerHTML={{ __html: DRAG_SCRIPT }} />

    <h2 class="balken">Neue Kategorie</h2>
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
  <Layout title={`Kategorie: ${type.label}`} aktiv="fehlerarten" betreiber>
    <form method="post" action={`/admin/fehlerarten/${type.id}`}>
      <label for="key">
        <span>Schlüssel:</span>
        <span class="zaehler">🔒 nicht änderbar — steht im Meta-Block versendeter Mails</span>
      </label>
      <input id="key" value={type.key} disabled />

      <label for="label">Bezeichnung:</label>
      <input id="label" name="label" required value={type.label} />

      <label for="description">Beschreibung:</label>
      <textarea id="description" name="description">{type.description ?? ""}</textarea>

      <button type="submit">Speichern</button>
    </form>
  </Layout>
);
