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
      <h2 class="rubrik">In eigener Sache</h2>
      <p class="einstieg">
        Korrekturen sammelt, was beim Lesen leise hängen bleibt: kleine Textfehler in
        Online-Artikeln. Es reicht sie freundlich an die zuständige Redaktion weiter — und
        hält geduldig fest, was daraus wird.
      </p>

      <h2>Der Weg eines Hinweises</h2>
      <p>
        Die Fundstelle wandert wortgetreu aus dem Artikel herüber, die berichtigte Fassung
        stellt sich daneben, und gemeinsam gehen beide als höfliche E‑Mail auf die Reise zur
        Redaktion. Jede Mail trägt am Ende des Betreffs eine kleine Kennung — bleibt sie in
        der Antwort stehen, finden Rückmeldung und Korrektur später ganz von selbst wieder
        zueinander.
      </p>

      <h2>Warum</h2>
      <p>
        Die meisten Fehler in Artikeln sind winzig: ein verirrtes Komma, zwei vertauschte
        Buchstaben, eine verdrehte Zahl. Sie wären rasch behoben — wenn sie nur jemand
        meldet. Dieses kleine Werkzeug macht das Melden so mühelos wie möglich und bewahrt
        zugleich sorgfältig auf, welche Hinweise gerade unterwegs sind und was Redaktionen
        stillschweigend daraus gemacht haben. Denn Texte werden besser, wo jemand aufmerksam
        liest.
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
