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

      <h2 class="rubrik">Aus der Werkstatt</h2>
      <p>
        Hinter dieser Seite steckt wohltuend wenig: ein kleines Programm auf einem
        gemieteten Webserver und eine einzelne, sorgsam gehütete Datei als Ablage. Keine
        Konten bei Drittdiensten, keine Besucherzählung, keine Cookies — erhoben wird
        nur, was das Blatt selbst braucht.
      </p>
      <p>
        Beim Absenden holt sich das Programm den Artikel ein einziges Mal von der
        Zeitungsseite und merkt sich genau, wo die Fundstelle steht — so lässt sich später
        in aller Ruhe nachsehen, ob die Stelle inzwischen berichtigt wurde. Verschickt wird
        über ein ganz gewöhnliches E‑Mail‑Postfach; die Kennung im Betreff ist der dünne
        Faden, an dem Antwort und Korrektur wieder zusammenfinden.
      </p>
      <p>
        Auch Kategorie und Schwere schlägt die Seite selbst vor: Sie vergleicht beide
        Fassungen geduldig Wort für Wort — fehlt ein Komma, sind zwei Buchstaben verdreht,
        stimmt eine Zahl nicht? Dahinter steckt keine künstliche Intelligenz, sondern eine
        Handvoll nachvollziehbarer Regeln, gebaut wie Korrekturzeichen: klein und klar. Und
        wo sie sich nicht sicher sind, schlagen sie lieber gar nichts vor.
      </p>
      <p>
        Der gesamte Quelltext liegt offen unter{" "}
        <a href="https://github.com/01msmr/corrections">github.com/01msmr/corrections</a> —
        für alle, die nachlesen möchten.
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
