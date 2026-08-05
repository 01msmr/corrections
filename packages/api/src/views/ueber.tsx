import type { FC } from "hono/jsx";
import { Layout } from "./layout.js";

/**
 * Die Startseite. Oeffentlich, weil sie erklaert, was ein Empfaenger einer
 * Korrekturmail hier vorfindet — die Fusszeile jeder Mail verweist auf diese
 * Adresse. Erfassung und Verwaltung liegen dagegen hinter der Basic-Auth.
 */
export const UeberSeite: FC = () => (
  <Layout title="Zur Sache" aktiv="ueber">
    <div class="prosa">
      <p class="einstieg">
        Korrekturen sammelt Hinweise auf Textfehler in Online-Artikeln, schickt sie an die
        zuständige Redaktion und hält fest, was daraus wird.
      </p>

      <h2>Der Weg eines Hinweises</h2>
      <p>
        Die Fundstelle wird im Wortlaut aus dem Artikel übernommen, die berichtigte Fassung
        dazugestellt, beides geht per E‑Mail an die Redaktion. Jede Mail trägt am Ende des
        Betreffs eine Kennung — bleibt sie in der Antwort stehen, lässt sich die Rückmeldung
        dem Hinweis zuordnen.
      </p>

      <h2>Warum</h2>
      <p>
        Die meisten Fehler in Artikeln sind klein: ein Komma, ein Buchstabendreher, eine
        verdrehte Zahl. Sie sind schnell behoben — wenn sie jemand meldet. Dieses Werkzeug
        macht das Melden so kurz wie möglich und bewahrt zugleich auf, welche Hinweise
        unterwegs sind und was Redaktionen daraus gemacht haben.
      </p>

      <p>
        <span class="zaehler">
          Erfassung und Verwaltung sind nicht öffentlich; die übrigen Menüpunkte fragen nach
          einem Zugang.
        </span>
      </p>
    </div>
  </Layout>
);
