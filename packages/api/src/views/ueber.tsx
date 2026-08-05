import type { FC } from "hono/jsx";
import { Layout } from "./layout.js";

/**
 * Die Startseite. Oeffentlich, weil sie erklaert, was ein Empfaenger einer
 * Korrekturmail hier vorfindet — die Fusszeile jeder Mail verweist auf diese
 * Adresse. Erfassung und Verwaltung liegen dagegen hinter der Basic-Auth.
 */
export const UeberSeite: FC = () => (
  <Layout title="In eigener Sache" aktiv="ueber">
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

      <h2 class="rubrik">Netzwelt</h2>
      <p>
        Hinter dieser Seite steckt bewusst wenig: ein kleines Programm auf einem gemieteten
        Webserver und eine einzelne Datei als Ablage. Es gibt keine Konten bei Drittdiensten,
        keine Besucherzählung und keine Cookies.
      </p>
      <p>
        Beim Absenden holt sich das Programm den Artikel einmal von der Zeitungsseite und
        merkt sich, wo genau die Fundstelle steht — so lässt sich später nachsehen, ob die
        Stelle inzwischen geändert wurde. Verschickt wird über ein gewöhnliches
        E‑Mail‑Postfach; die Kennung im Betreff ist der Faden, an dem Antwort und Korrektur
        wieder zusammenfinden.
      </p>
      <p>
        Auch die Kategorie schlägt die Seite selbst vor: Sie vergleicht beide Fassungen Wort
        für Wort — fehlt ein Komma, sind zwei Buchstaben verdreht, stimmt eine Zahl nicht?
        Dahinter steckt keine künstliche Intelligenz, sondern eine Handvoll nachvollziehbarer
        Regeln; wo sie sich nicht sicher sind, schlagen sie lieber nichts vor.
      </p>
      <p>
        Der gesamte Quelltext ist offen einsehbar unter{" "}
        <a href="https://github.com/01msmr/corrections">github.com/01msmr/corrections</a>.
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
