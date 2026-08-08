import { istZaehlbareFehlerart, QUOTE_MAX_LENGTH } from "@korrektur/shared";
import type { FC } from "hono/jsx";
import type { ErrorTypeRecord } from "../repo/errorTypes.js";
import { EnvelopeOpenTextIcon, FilePenIcon, Layout } from "./layout.js";
import { vergleicheFassungen } from "./vergleich.js";

/**
 * Wird gezeigt, wenn fuer die Domain keine Kontaktadresse hinterlegt ist.
 * Statt nur zu melden, dass es nicht geht, fuehrt der Block zu den beiden
 * Handgriffen, die dann noetig sind: Adresse im Impressum nachschlagen und
 * die Redaktion anlegen.
 *
 * Sichtbar nur fuer den angemeldeten Betreiber — /neu liegt hinter der
 * Basic-Auth. Die spaetere oeffentliche Erfassung fuer Fremde (Abschnitt 15
 * der Spec) darf diesen Block nicht rendern.
 */
const FehlendeRedaktion: FC<{ host: string; zurueck: string }> = ({ host, zurueck }) => (
  <div class="hinweis">
    <p>
      Für <strong>{host}</strong> ist keine Kontaktadresse hinterlegt — ohne die kann
      der Hinweis nicht versendet werden.
    </p>
    <p>
      <a href={`https://${host}/impressum`} target="_blank" rel="noopener noreferrer">
        Impressum von {host} öffnen
      </a>{" "}
      — dort steht die Korrektur- oder Leserbriefadresse meistens.
    </p>
    <p>
      <a href={`/admin/redaktionen?domain=${encodeURIComponent(host)}&zurueck=${encodeURIComponent(zurueck)}`}>
        Medium jetzt anlegen
      </a>{" "}
      — Domain ist vorausgefüllt, danach geht es zurück zu diesem Hinweis.
    </p>
  </div>
);

/**
 * Korrekturzeichen unmittelbar vor der Beschriftung. Es steht nur dort, wo
 * tatsaechlich korrigiert wird — Tilgen, Einfuegen, Randbemerkung —, damit die
 * drei Zeichen etwas bedeuten und nicht jede Zeile zieren.
 *
 * aria-hidden, weil die Beschriftung daneben dieselbe Aussage in Worten trifft:
 * vorgelesen waere das Zeichen eine Dopplung ohne Mehrwert.
 */
/**
 * Fragt die Kategorie-Erkennung ab, sobald beide Fassungen dastehen -- aber
 * nur, solange die Auswahl nicht von Hand getroffen wurde: eine bewusste
 * Entscheidung wird nie ueberschrieben.
 */
const erkennungScript = (basis: string) => `
  const setzeHinweis = (el, text, erkannt) => {
    el.textContent = text;
    el.classList.toggle("erkannt", Boolean(erkannt));
  };
  const ERKANNT = "automatisch erkannt";
  const UEBERNOMMEN = "automatisch aus dem Artikel übernommen";
  const url = document.getElementById("articleUrl");
  const ueberschrift = document.getElementById("headline");
  const ueberschriftHinweis = document.getElementById("ueberschrift-hinweis");
  let ueberschriftManuell = false;
  let ueberschriftVorschlag = null;
  let urlZeitgeber = null;
  /* Die Markierung bleibt nur, solange der Text dem Vorschlag entspricht:
     wer ihn veraendert, macht Handarbeit daraus -- wer ihn zuruecktippt, nicht. */
  ueberschrift.addEventListener("input", () => {
    ueberschriftManuell = true;
    if (ueberschriftVorschlag === null) return;
    const unveraendert = ueberschrift.value.trim() === ueberschriftVorschlag;
    setzeHinweis(ueberschriftHinweis, unveraendert ? UEBERNOMMEN : "", unveraendert);
  });
  const ueberschriftHolen = () => {
    if (ueberschriftManuell || !url.value.trim()) return;
    setzeHinweis(ueberschriftHinweis, "wird geholt …", false);
    fetch("${basis}/ueberschrift", {
      method: "POST",
      body: new URLSearchParams({ url: url.value }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((daten) => {
        if (daten && daten.ueberschrift && !ueberschriftManuell) {
          ueberschrift.value = daten.ueberschrift;
          ueberschriftVorschlag = daten.ueberschrift.trim();
          setzeHinweis(ueberschriftHinweis, UEBERNOMMEN, true);
        } else {
          setzeHinweis(ueberschriftHinweis, "ließ sich nicht laden — wird beim Senden erneut versucht", false);
        }
      })
      .catch(() => { setzeHinweis(ueberschriftHinweis, "", false); });
  };
  url.addEventListener("input", () => {
    clearTimeout(urlZeitgeber);
    urlZeitgeber = setTimeout(ueberschriftHolen, 500);
  });

  const falsch = document.getElementById("quoteBefore");
  const richtig = document.getElementById("suggestionAfter");
  /* Die berichtigte Fassung beginnt als Kopie des Zitats: wer zwei Zeichen
     tauschen will, soll nicht den ganzen Satz tippen. Die Kopie laeuft mit,
     bis im Korrekturfeld von Hand gearbeitet wird -- und wieder, wenn es
     ganz geleert wird. */
  let richtigManuell = richtig.value.trim() !== "";
  richtig.addEventListener("input", () => { richtigManuell = richtig.value.trim() !== ""; });
  falsch.addEventListener("input", () => { if (!richtigManuell) richtig.value = falsch.value; });
  if (!richtigManuell) richtig.value = falsch.value;
  const auswahl = document.getElementById("errorTypeKey");
  const schwere = document.getElementById("severity");
  const hinweis = document.getElementById("kategorie-hinweis");
  const anzahl = document.getElementById("errorCount");
  const zeichenFeld = document.getElementById("errorChar");
  /* Das Anzahl-Feld gehoert nur zu zaehlbaren Kategorien; beim Wechsel auf
     eine nicht zaehlbare wird es geleert, damit nichts Falsches mitgeht. */
  const anzahlAbgleichen = () => {
    const zaehlbar = auswahl.selectedOptions[0]?.dataset.zaehlbar === "1";
    anzahl.hidden = !zaehlbar;
    if (!zaehlbar) anzahl.value = "";
    zeichenFeld.value = "";
  };
  anzahlAbgleichen();
  let manuell = false;
  let kategorieVorschlag = null;
  let schwereManuell = false;
  let zeitgeber = null;
  auswahl.addEventListener("change", () => {
    manuell = true;
    anzahlAbgleichen();
    const unveraendert = kategorieVorschlag !== null && auswahl.value === kategorieVorschlag;
    setzeHinweis(hinweis, unveraendert ? ERKANNT : "", unveraendert);
  });
  schwere.addEventListener("change", () => { schwereManuell = true; });
  const pruefen = () => {
    if (!falsch.value.trim() || !richtig.value.trim()) return;
    fetch("${basis}/kategorie", {
      method: "POST",
      body: new URLSearchParams({ falsch: falsch.value, richtig: richtig.value }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((daten) => {
        if (!daten) return;
        if (!manuell) {
          if (daten.kategorie) {
            auswahl.value = daten.kategorie;
            kategorieVorschlag = daten.kategorie;
            anzahlAbgleichen();
            if (daten.anzahl) anzahl.value = String(daten.anzahl);
            if (daten.zeichen) zeichenFeld.value = daten.zeichen;
            setzeHinweis(hinweis, ERKANNT, true);
          } else {
            setzeHinweis(hinweis, "", false);
          }
        }
        if (!schwereManuell && daten.schwere) schwere.value = String(daten.schwere);
      })
      .catch(() => {});
  };
  for (const feld of [falsch, richtig]) {
    feld.addEventListener("input", () => {
      clearTimeout(zeitgeber);
      zeitgeber = setTimeout(pruefen, 400);
    });
  }
  /* Fehlersuche im Artikel. Sie laeuft nur auf Klick — die oeffentliche
     LanguageTool-API untersagt automatische Anfragen (Spec 2026-08-08).
     Ein Klick auf einen Treffer fuellt die beiden Fassungen; die Kategorie
     kommt aus der bestehenden Erkennung, nicht aus dem Dienst. */
  const pruefKnopf = document.getElementById("pruefen");
  const pruefHinweis = document.getElementById("pruef-hinweis");
  const trefferListe = document.getElementById("pruef-treffer");

  const satzMitMarkierung = (fund) => {
    const vor = document.createTextNode(fund.satz.slice(0, fund.start));
    const stelle = document.createElement("mark");
    stelle.textContent = fund.satz.slice(fund.start, fund.start + fund.laenge);
    const nach = document.createTextNode(fund.satz.slice(fund.start + fund.laenge));
    const satz = document.createElement("span");
    satz.className = "trefferSatz";
    satz.append(vor, stelle, nach);
    return satz;
  };

  const zeigeTreffer = (funde) => {
    trefferListe.textContent = "";
    if (funde.length === 0) return;
    let letzteArt = null;
    for (const fund of funde) {
      if (fund.art === "stil" && letzteArt !== "stil") {
        const trenner = document.createElement("p");
        trenner.className = "zaehler";
        trenner.textContent = "Stilfragen — Auslegungssache, deshalb nachrangig:";
        trefferListe.append(trenner);
      }
      letzteArt = fund.art;
      const knopf = document.createElement("button");
      knopf.type = "button";
      knopf.className = fund.art === "stil" ? "treffer-zeile stil" : "treffer-zeile";
      knopf.title = fund.hinweis;
      const wechsel = document.createElement("span");
      wechsel.className = "trefferWechsel";
      wechsel.append(Object.assign(document.createElement("del"), { textContent: fund.falsch }));
      wechsel.append(Object.assign(document.createElement("ins"), { textContent: fund.richtig }));
      knopf.append(wechsel, satzMitMarkierung(fund));
      knopf.addEventListener("click", () => {
        falsch.value = fund.falsch;
        richtigManuell = true;
        richtig.value = fund.richtig;
        manuell = false;
        pruefen();
        falsch.scrollIntoView({ block: "center" });
      });
      trefferListe.append(knopf);
    }
  };

  pruefKnopf.addEventListener("click", () => {
    if (!url.value.trim()) {
      setzeHinweis(pruefHinweis, "Erst die Artikel-URL eintragen.", false);
      return;
    }
    pruefKnopf.disabled = true;
    setzeHinweis(pruefHinweis, "wird durchgesehen …", false);
    fetch("${basis}/pruefen", {
      method: "POST",
      body: new URLSearchParams({ url: url.value }),
    })
      .then((res) => (res.status === 429 ? "kontingent" : res.ok ? res.json() : null))
      .then((daten) => {
        if (daten === "kontingent") {
          setzeHinweis(pruefHinweis, "Für heute sind die Prüfungen aufgebraucht.", false);
          return;
        }
        const funde = daten && Array.isArray(daten.funde) ? daten.funde : [];
        zeigeTreffer(funde);
        setzeHinweis(
          pruefHinweis,
          funde.length === 0
            ? "nichts gefunden — was nicht heißt, dass nichts drin steht"
            : funde.length + " Stelle" + (funde.length === 1 ? "" : "n") + " zum Ansehen",
          funde.length > 0,
        );
      })
      .catch(() => { setzeHinweis(pruefHinweis, "Prüfung nicht erreichbar.", false); })
      .finally(() => { pruefKnopf.disabled = false; });
  });

  /* Vorbefuellte Felder (Bookmarklet/Kurzbefehl: ?url=…&text=…) loesen kein
     input-Ereignis aus — Ueberschrift und Kategorie deshalb einmal beim
     Laden anstossen. */
  if (url.value.trim()) ueberschriftHolen();
  if (falsch.value.trim() && richtig.value.trim()) pruefen();
`;

const Zeichen: FC<{ art: "url" | "titel" | "falsch" | "richtig" | "notiz"; titel: string }> = ({
  art,
  titel,
}) => (
  <span class={`zeichen zeichen-${art}`} aria-hidden="true" title={titel} />
);

export const CaptureForm: FC<{
  errorTypes: ErrorTypeRecord[];
  idempotencyKey: string;
  url: string;
  quote: string;
  fehler?: string | undefined;
  fehlendeRedaktion?: { host: string; zurueck: string } | undefined;
  /** "/neu" (Betreiber) oder "/hinweis" (Besucher) — steuert Action und Helfer-Endpunkte. */
  basis?: "/neu" | "/hinweis";
}> = ({ errorTypes, idempotencyKey, url, quote, fehler, fehlendeRedaktion, basis = "/neu" }) => (
  <Layout title="Neue Korrektur" aktiv="neu" betreiber={basis === "/neu"}>
    {fehlendeRedaktion ? (
      <FehlendeRedaktion host={fehlendeRedaktion.host} zurueck={fehlendeRedaktion.zurueck} />
    ) : fehler ? (
      <p class="hinweis">{fehler}</p>
    ) : null}
    <form class="arbeitsflaeche" method="post" action={`${basis}/vorschau`}>
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      {/* Hauptspalte: der Artikel und die eigentliche Korrektur. */}
      <div class="hauptspalte">
        <div class="feld">
          <label for="articleUrl">
            <span>
              {/* <Zeichen art="url" titel="Adresse des Artikels" /> */}
              Artikel-URL:
            </span>
          </label>
          <input id="articleUrl" name="articleUrl" type="url" required value={url} />
        </div>

        {/* Fehlersuche im Artikel: laeuft nur auf Klick (Spec 2026-08-08) —
            die oeffentliche LanguageTool-API untersagt automatische Anfragen. */}
        <div class="feld pruefung">
          <button type="button" id="pruefen" class="zeilenknopf">
            Artikel auf Fehler durchsehen
          </button>
          <span id="pruef-hinweis" class="zaehler" aria-live="polite" />
          <div id="pruef-treffer" class="treffer" />
          <p class="zaehler quelle">
            Rechtschreib- und Grammatikprüfung von{" "}
            <a href="https://languagetool.org" target="_blank" rel="noopener">
              LanguageTool
            </a>
            . Vorschläge, keine Urteile — was stimmt, entscheidest du.
          </p>
        </div>

        <div class="feld">
          <label for="headline">
            <span>
              {/* <Zeichen art="titel" titel="Überschrift des Artikels" /> */}
              Überschrift:
            </span>
            <span id="ueberschrift-hinweis" class="zaehler" aria-live="polite">
              wird aus dem Artikel geholt, sobald die URL dasteht
            </span>
          </label>
          <input id="headline" name="headline" type="text" />
        </div>

        {/* Untereinander, nicht nebeneinander: so lassen sich die beiden
            Fassungen zeilenweise vergleichen, wie auf einer Korrekturfahne. */}
        <div class="feld">
          <label for="quoteBefore">
            <span>
              <Zeichen art="falsch" titel="So steht es im Artikel" />
              Falsch ist:
            </span>
            <span class="zaehler">bis zu {QUOTE_MAX_LENGTH} Zeichen</span>
          </label>
          <textarea id="quoteBefore" name="quoteBefore" required maxlength={QUOTE_MAX_LENGTH}>
            {quote}
          </textarea>
        </div>

        <div class="feld">
          <label for="suggestionAfter">
            <span>
              <Zeichen art="richtig" titel="So wäre es richtig" />
              Richtig wäre:
            </span>
            <span class="zaehler">die berichtigte Fassung</span>
          </label>
          <textarea id="suggestionAfter" name="suggestionAfter" required></textarea>
        </div>
      </div>

      {/* Nebenspalte: Einordnung und Randbemerkung — nötig, aber nicht die Arbeit. */}
      <aside class="nebenspalte">
        <div class="feld">
          <label for="errorTypeKey">
            <span>Kategorie:</span>
            <span id="kategorie-hinweis" class="zaehler" aria-live="polite"></span>
          </label>
          {/* Anzahl vor der Auswahl, damit sich die Zeile wie die spaetere
              Benennung liest: "2 | Zeichen fehlen". Nur bei zaehlbaren
              Kategorien sichtbar; die Erkennung zaehlt mit, von Hand bleibt
              die Anzahl frei. Leer heisst: keine Anzahl. */}
          <div class="kategoriezeile">
            <input
              id="errorCount"
              name="errorCount"
              type="number"
              min="1"
              max="999"
              aria-label="Anzahl"
              hidden
            />
            {/* Konkretes Satzzeichen, nur von der Erkennung befuellt --
                macht aus "ein Satzzeichen zu viel" ein "ein Komma zu viel". */}
            <input type="hidden" id="errorChar" name="errorChar" />
            <select id="errorTypeKey" name="errorTypeKey" required>
              {errorTypes.map((type) => (
                <option value={type.key} data-zaehlbar={istZaehlbareFehlerart(type.key) ? "1" : undefined}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div class="feld">
          <label for="severity">Schwere:</label>
          <select id="severity" name="severity">
            <option value="1">kosmetisch</option>
            <option value="2" selected>
              störend
            </option>
            <option value="3">sinnentstellend</option>
          </select>
        </div>

        <div class="feld">
          <label for="comment">
            <span>
              {/* <Zeichen art="notiz" titel="Randbemerkung" /> */}
              Anmerkung:
            </span>
            <span class="zaehler">optional</span>
          </label>
          <textarea id="comment" name="comment"></textarea>
        </div>

        {/* Unten in der Nebenspalte: der Knopf schliesst den Vorgang ab und
            steht dort, wo der Blick nach dem Ausfuellen endet. */}
        <div class="abschluss">
          <button type="submit">
              <span class="knopftext">
                Korrektur-Vorschau<span class="taste" aria-hidden="true">⏎</span>
              </span>
            </button>
        </div>
      </aside>
    </form>
    <script dangerouslySetInnerHTML={{ __html: erkennungScript(basis) }} />
  </Layout>
);

export const CapturePreview: FC<{
  an: string;
  subject: string;
  mailHtml: string;
  /** Alle Formularwerte, unveraendert als versteckte Felder weitergereicht. */
  werte: Record<string, string>;
  /** Besucher-Modus: statt Senden-Knopf oeffnet dieser Link das Mail-Programm. */
  mailtoHref?: string | undefined;
}> = ({ an, subject, mailHtml, werte, mailtoHref }) => {
  /* Die Fahne entsteht serverseitig aus den durchgereichten Fassungen; sie
     erscheint nur, wenn die beiden sich tatsaechlich unterscheiden. */
  const fahne = vergleicheFassungen(werte["quoteBefore"] ?? "", werte["suggestionAfter"] ?? "");
  const veraendert = fahne.some((stueck) => stueck.art !== "gleich");
  return (
  <Layout title="Vorschau" aktiv="neu" betreiber={!mailtoHref}>
    <div class="mailkopf">
      <div>
        <span class="zaehler">An:</span> {an}
      </div>
      <div>
        <span class="zaehler">Betreff:</span> {subject}
      </div>
    </div>
    {veraendert ? (
      <p class="fahne">
        <span class="zaehler">Korrekturfahne: </span>
        {fahne.map((stueck, i) => (
          <>
            {i > 0 ? " " : ""}
            {stueck.art === "gleich" ? (
              stueck.text
            ) : stueck.art === "getilgt" ? (
              <del>{stueck.text}</del>
            ) : (
              <ins>{stueck.text}</ins>
            )}
          </>
        ))}
      </p>
    ) : null}
    {/* Inhalt stammt aus composeMail; alle Nutzereingaben sind dort maskiert. */}
    <div class="mailvorschau" dangerouslySetInnerHTML={{ __html: mailHtml }} />
    {mailtoHref ? (
      /* Besucher senden mit dem eigenen Mail-Programm — Betreff und Text
         sind fertig vorbefuellt, die Sendemethode ist der einzige Unterschied. */
      <p>
        <a class="sendeknopf" href={mailtoHref}><EnvelopeOpenTextIcon /> Im Mail-Programm öffnen und senden</a>
      </p>
    ) : (
      <form method="post" action="/neu">
        {Object.entries(werte).map(([name, wert]) => (
          <input type="hidden" name={name} value={wert} />
        ))}
        <button type="submit"><FilePenIcon /> Korrektur senden</button>
      </form>
    )}
    <p>
      <a href="javascript:history.back()">Zurück zum Formular</a>
      <span class="zaehler"> — die Eingaben bleiben erhalten.</span>
    </p>
    {/* Wer die Vorschau verlaesst, ohne zu senden, wird vom Browser gefragt --
        die Systemabfrage, kein eigener Dialog. Das Senden selbst ist ausgenommen. */}
    <script
      dangerouslySetInnerHTML={{
        __html: `
  let sendet = false;
  const sendeform = document.querySelector('form[action="/neu"]');
  if (sendeform) sendeform.addEventListener("submit", () => { sendet = true; });
  const mailtoKnopf = document.querySelector(".sendeknopf");
  if (mailtoKnopf) mailtoKnopf.addEventListener("click", () => { sendet = true; });
  window.addEventListener("beforeunload", (e) => { if (!sendet) e.preventDefault(); });`,
      }}
    />
  </Layout>
  );
};

export const CaptureResult: FC<{
  ref: string;
  anchored: boolean;
  artikelGeladen: boolean;
  sent: boolean;
}> = ({ ref, anchored, artikelGeladen, sent }) => (
  <Layout title="Hinweis erfasst" aktiv="neu" betreiber>
    <p class="hinweis">
      {sent ? (
        <>
          Der Hinweis mit der Kennung <span class="kennung">{ref}</span> wurde erfolgreich
          versendet.
        </>
      ) : (
        <>
          Der Hinweis mit der Kennung <span class="kennung">{ref}</span> konnte nicht versendet
          werden — der
          Datensatz liegt zur Prüfung bereit.
        </>
      )}
    </p>
    {anchored ? null : (
      <p class="hinweis">
        {artikelGeladen
          ? "Die Fundstelle wurde im geladenen Artikel nicht eindeutig gefunden. Eine spätere automatische Korrekturerkennung ist für diesen Datensatz nur eingeschränkt möglich."
          : "Der Artikel ließ sich nicht abrufen — viele Seiten liefern Servern nur eine Paywall- oder Zustimmungsseite aus. Ohne Artikeltext kann die Fundstelle nicht verankert werden; am Hinweis selbst ändert das nichts."}
      </p>
    )}
    <p>
      <a href="/neu">Weitere Textkorrektur erfassen?</a>
    </p>
  </Layout>
);
