import type { FC } from "hono/jsx";
import { Layout } from "./layout.js";

/**
 * Ergebnis des Nachprüf-Lesezeichens: was der eingefügte Artikeltext für die
 * Meldungen zu dieser Adresse ergeben hat. Eine Seite, kein Umweg -- das
 * Lesezeichen landet direkt hier.
 */

export interface NachpruefZeile {
  id: string;
  ref: string;
  kategorie: string;
  befund: string;
  sicherheit: number | null;
}

const BEFUNDTEXT: Record<string, string> = {
  changed_as_suggested: "wie vorgeschlagen geändert",
  changed_otherwise: "anders geändert",
  unchanged: "unverändert",
  passage_gone: "Fundstelle nicht im Text",
};

export const NachpruefSeite: FC<{ adresse: string; zeilen: NachpruefZeile[] }> = ({
  adresse,
  zeilen,
}) => (
  <Layout title="Nachgeprüft" aktiv="abgleich" betreiber>
    <p class="zaehler">{adresse}</p>
    {zeilen.length === 0 ? (
      <p class="prosa">
        Zu dieser Adresse ist keine Meldung erfasst. Geprüft wurde nichts.
      </p>
    ) : (
      <>
        <p class="prosa">
          {zeilen.length === 1
            ? "Eine Meldung zu dieser Adresse, geprüft gegen den mitgeschickten Text:"
            : `${zeilen.length} Meldungen zu dieser Adresse, geprüft gegen den mitgeschickten Text:`}
        </p>
        <table>
          <thead>
            <tr>
              <th>Kennung</th>
              <th>Kategorie</th>
              <th>Befund</th>
            </tr>
          </thead>
          <tbody>
            {zeilen.map((zeile) => (
              <tr data-href={`/admin/meldungen/${zeile.id}`}>
                <td>
                  <a href={`/admin/meldungen/${zeile.id}`}>
                    <code>{zeile.ref}</code>
                  </a>
                </td>
                <td>{zeile.kategorie}</td>
                <td>
                  {BEFUNDTEXT[zeile.befund] ?? zeile.befund}
                  {zeile.sicherheit === null ? "" : ` (Sicherheit ${zeile.sicherheit})`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p class="prosa">
          Der Befund steht jetzt in der Historie. Den Ausgang setzt du im Detail
          oder im <a href="/admin/abgleich">Abgleich</a>.
        </p>
      </>
    )}
  </Layout>
);
