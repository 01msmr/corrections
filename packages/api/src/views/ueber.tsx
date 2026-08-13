import { ARTIKEL_MAX_LENGTH, QUOTE_MAX_LENGTH } from "@korrektur/shared";
import type { FC } from "hono/jsx";
import { AppleIcon, CopyIcon, InfoIcon, Layout } from "./layout.js";

/**
 * Die Startseite. Oeffentlich, weil sie erklaert, was ein Empfaenger einer
 * Korrekturmail hier vorfindet — die Fusszeile jeder Mail verweist auf diese
 * Adresse. Erfassung und Verwaltung liegen dagegen hinter der Basic-Auth.
 */
/**
 * QR-Code des fertigen Kurzbefehls — einmal erzeugt und als Pfad eingelegt,
 * damit zur Laufzeit nichts nachgeladen wird (Projektregel: keine externen
 * Ressourcen). Fehlerkorrektur Stufe M, stiller Rand inbegriffen. Aendert
 * sich die Adresse, muss der Pfad neu erzeugt werden.
 */
const KurzbefehlQr: FC = () => (
  <svg
    class="qr"
    viewBox="0 0 41 41"
    role="img"
    aria-label="QR-Code zum Kurzbefehl"
  >
    <rect width="41" height="41" fill="var(--papier)" />
    <path d="M2 2h7v1h-7zM10 2h2v1h-2zM13 2h2v1h-2zM19 2h3v1h-3zM23 2h2v1h-2zM26 2h1v1h-1zM29 2h1v1h-1zM32 2h7v1h-7zM2 3h1v1h-1zM8 3h1v1h-1zM12 3h1v1h-1zM18 3h1v1h-1zM20 3h1v1h-1zM22 3h1v1h-1zM32 3h1v1h-1zM38 3h1v1h-1zM2 4h1v1h-1zM4 4h3v1h-3zM8 4h1v1h-1zM11 4h1v1h-1zM15 4h1v1h-1zM17 4h3v1h-3zM21 4h5v1h-5zM28 4h3v1h-3zM32 4h1v1h-1zM34 4h3v1h-3zM38 4h1v1h-1zM2 5h1v1h-1zM4 5h3v1h-3zM8 5h1v1h-1zM10 5h4v1h-4zM17 5h2v1h-2zM21 5h2v1h-2zM25 5h1v1h-1zM27 5h2v1h-2zM30 5h1v1h-1zM32 5h1v1h-1zM34 5h3v1h-3zM38 5h1v1h-1zM2 6h1v1h-1zM4 6h3v1h-3zM8 6h1v1h-1zM10 6h2v1h-2zM15 6h1v1h-1zM18 6h1v1h-1zM22 6h2v1h-2zM25 6h1v1h-1zM29 6h2v1h-2zM32 6h1v1h-1zM34 6h3v1h-3zM38 6h1v1h-1zM2 7h1v1h-1zM8 7h1v1h-1zM10 7h1v1h-1zM14 7h5v1h-5zM20 7h2v1h-2zM23 7h2v1h-2zM27 7h2v1h-2zM32 7h1v1h-1zM38 7h1v1h-1zM2 8h7v1h-7zM10 8h1v1h-1zM12 8h1v1h-1zM14 8h1v1h-1zM16 8h1v1h-1zM18 8h1v1h-1zM20 8h1v1h-1zM22 8h1v1h-1zM24 8h1v1h-1zM26 8h1v1h-1zM28 8h1v1h-1zM30 8h1v1h-1zM32 8h7v1h-7zM10 9h1v1h-1zM13 9h3v1h-3zM19 9h4v1h-4zM24 9h1v1h-1zM29 9h1v1h-1zM2 10h1v1h-1zM6 10h1v1h-1zM8 10h5v1h-5zM14 10h1v1h-1zM17 10h1v1h-1zM20 10h1v1h-1zM24 10h1v1h-1zM26 10h1v1h-1zM28 10h8v1h-8zM38 10h1v1h-1zM3 11h3v1h-3zM7 11h1v1h-1zM9 11h2v1h-2zM12 11h5v1h-5zM18 11h1v1h-1zM21 11h3v1h-3zM27 11h1v1h-1zM29 11h1v1h-1zM31 11h1v1h-1zM33 11h2v1h-2zM37 11h1v1h-1zM4 12h2v1h-2zM8 12h3v1h-3zM13 12h3v1h-3zM18 12h3v1h-3zM22 12h1v1h-1zM28 12h2v1h-2zM36 12h1v1h-1zM4 13h2v1h-2zM10 13h2v1h-2zM14 13h2v1h-2zM19 13h1v1h-1zM23 13h1v1h-1zM26 13h1v1h-1zM28 13h1v1h-1zM30 13h1v1h-1zM32 13h1v1h-1zM35 13h3v1h-3zM4 14h1v1h-1zM6 14h1v1h-1zM8 14h3v1h-3zM12 14h1v1h-1zM14 14h1v1h-1zM17 14h3v1h-3zM21 14h5v1h-5zM31 14h2v1h-2zM35 14h4v1h-4zM4 15h2v1h-2zM10 15h1v1h-1zM12 15h3v1h-3zM16 15h2v1h-2zM19 15h2v1h-2zM22 15h1v1h-1zM24 15h2v1h-2zM27 15h5v1h-5zM34 15h2v1h-2zM37 15h1v1h-1zM2 16h4v1h-4zM8 16h2v1h-2zM11 16h1v1h-1zM17 16h2v1h-2zM20 16h1v1h-1zM22 16h8v1h-8zM33 16h5v1h-5zM2 17h2v1h-2zM5 17h1v1h-1zM7 17h1v1h-1zM9 17h2v1h-2zM12 17h2v1h-2zM15 17h4v1h-4zM21 17h1v1h-1zM23 17h1v1h-1zM26 17h1v1h-1zM30 17h1v1h-1zM32 17h3v1h-3zM36 17h1v1h-1zM3 18h2v1h-2zM8 18h2v1h-2zM11 18h5v1h-5zM17 18h2v1h-2zM21 18h2v1h-2zM25 18h2v1h-2zM28 18h1v1h-1zM30 18h1v1h-1zM32 18h1v1h-1zM35 18h2v1h-2zM38 18h1v1h-1zM3 19h2v1h-2zM6 19h1v1h-1zM9 19h1v1h-1zM15 19h1v1h-1zM20 19h2v1h-2zM24 19h1v1h-1zM26 19h2v1h-2zM29 19h1v1h-1zM31 19h1v1h-1zM33 19h3v1h-3zM37 19h1v1h-1zM2 20h1v1h-1zM5 20h2v1h-2zM8 20h2v1h-2zM11 20h1v1h-1zM16 20h2v1h-2zM20 20h2v1h-2zM24 20h3v1h-3zM28 20h2v1h-2zM34 20h3v1h-3zM3 21h2v1h-2zM6 21h2v1h-2zM9 21h1v1h-1zM11 21h2v1h-2zM14 21h1v1h-1zM16 21h4v1h-4zM21 21h4v1h-4zM26 21h1v1h-1zM32 21h1v1h-1zM35 21h3v1h-3zM4 22h5v1h-5zM12 22h1v1h-1zM15 22h1v1h-1zM18 22h3v1h-3zM23 22h2v1h-2zM26 22h1v1h-1zM28 22h1v1h-1zM31 22h3v1h-3zM35 22h2v1h-2zM2 23h2v1h-2zM6 23h1v1h-1zM10 23h3v1h-3zM17 23h1v1h-1zM23 23h4v1h-4zM28 23h4v1h-4zM33 23h2v1h-2zM37 23h1v1h-1zM4 24h1v1h-1zM6 24h1v1h-1zM8 24h2v1h-2zM11 24h2v1h-2zM15 24h3v1h-3zM19 24h1v1h-1zM25 24h2v1h-2zM29 24h1v1h-1zM33 24h5v1h-5zM5 25h3v1h-3zM9 25h1v1h-1zM11 25h6v1h-6zM18 25h3v1h-3zM22 25h1v1h-1zM24 25h3v1h-3zM28 25h3v1h-3zM32 25h3v1h-3zM36 25h1v1h-1zM38 25h1v1h-1zM3 26h3v1h-3zM7 26h2v1h-2zM10 26h2v1h-2zM13 26h2v1h-2zM16 26h1v1h-1zM20 26h2v1h-2zM24 26h2v1h-2zM29 26h2v1h-2zM32 26h2v1h-2zM35 26h2v1h-2zM38 26h1v1h-1zM2 27h2v1h-2zM5 27h2v1h-2zM9 27h1v1h-1zM11 27h3v1h-3zM16 27h1v1h-1zM18 27h1v1h-1zM21 27h2v1h-2zM25 27h2v1h-2zM28 27h2v1h-2zM31 27h1v1h-1zM34 27h1v1h-1zM4 28h5v1h-5zM13 28h1v1h-1zM16 28h1v1h-1zM18 28h2v1h-2zM22 28h2v1h-2zM25 28h1v1h-1zM27 28h3v1h-3zM33 28h1v1h-1zM35 28h2v1h-2zM4 29h1v1h-1zM7 29h1v1h-1zM10 29h1v1h-1zM13 29h4v1h-4zM19 29h2v1h-2zM23 29h2v1h-2zM29 29h2v1h-2zM32 29h1v1h-1zM36 29h1v1h-1zM2 30h2v1h-2zM5 30h4v1h-4zM15 30h1v1h-1zM17 30h3v1h-3zM21 30h1v1h-1zM23 30h2v1h-2zM26 30h1v1h-1zM30 30h5v1h-5zM36 30h1v1h-1zM38 30h1v1h-1zM10 31h1v1h-1zM12 31h2v1h-2zM15 31h1v1h-1zM17 31h1v1h-1zM19 31h2v1h-2zM25 31h1v1h-1zM27 31h2v1h-2zM30 31h1v1h-1zM34 31h1v1h-1zM2 32h7v1h-7zM10 32h1v1h-1zM16 32h3v1h-3zM20 32h1v1h-1zM22 32h5v1h-5zM28 32h1v1h-1zM30 32h1v1h-1zM32 32h1v1h-1zM34 32h1v1h-1zM2 33h1v1h-1zM8 33h1v1h-1zM11 33h1v1h-1zM15 33h1v1h-1zM22 33h2v1h-2zM26 33h1v1h-1zM30 33h1v1h-1zM34 33h3v1h-3zM2 34h1v1h-1zM4 34h3v1h-3zM8 34h1v1h-1zM10 34h1v1h-1zM12 34h4v1h-4zM18 34h1v1h-1zM21 34h2v1h-2zM25 34h2v1h-2zM28 34h1v1h-1zM30 34h7v1h-7zM38 34h1v1h-1zM2 35h1v1h-1zM4 35h3v1h-3zM8 35h1v1h-1zM14 35h3v1h-3zM20 35h2v1h-2zM24 35h2v1h-2zM27 35h1v1h-1zM30 35h1v1h-1zM32 35h2v1h-2zM38 35h1v1h-1zM2 36h1v1h-1zM4 36h3v1h-3zM8 36h1v1h-1zM15 36h1v1h-1zM17 36h1v1h-1zM20 36h2v1h-2zM24 36h4v1h-4zM31 36h2v1h-2zM35 36h1v1h-1zM2 37h1v1h-1zM8 37h1v1h-1zM11 37h1v1h-1zM14 37h1v1h-1zM16 37h4v1h-4zM21 37h3v1h-3zM25 37h1v1h-1zM28 37h1v1h-1zM31 37h1v1h-1zM34 37h4v1h-4zM2 38h7v1h-7zM10 38h2v1h-2zM14 38h3v1h-3zM19 38h1v1h-1zM23 38h2v1h-2zM26 38h1v1h-1zM31 38h3v1h-3zM35 38h4v1h-4z" fill="var(--tinte)" />
  </svg>
);

/**
 * Was nach dem Kopieren zu tun ist — drei Handgriffe, danach der eine
 * Stolperstein. Steht im Hinweis am i, nicht als Absatz auf der Seite: man
 * macht es einmal.
 */
const LESEZEICHEN_HINWEIS = [
  "1. Neues Lesezeichen anlegen",
  "2. Als Adresse/URL das Kopierte einsetzen",
  "3. Benennen, etwa „Korrektur“",
  "",
  "Es muss im selben Tab öffnen. In Vivaldi hilft ein Kürzel.",
].join("\n");

export const UeberSeite: FC<{ betreiber?: boolean }> = ({ betreiber = false }) => (
  <Layout title="In eigener Sache" aktiv="ueber" betreiber={betreiber}>
    <div class="prosa">
      <p class="einstieg">
        Kleine Textfehler in Online-Artikeln: an die Redaktion gemeldet und festgehalten,
        was daraus wird.
      </p>
      <h2 class="rubrik">In eigener Sache</h2>

      {/* Der Abschnitt haelt zusammen: so steht der QR-Block in derselben
          Spalte wie das, wovon er handelt, statt allein oben in der zweiten
          zu landen (Entscheidung vom 13.8.2026). */}
      <div class="zusammenhalt">
      <h2>Schneller melden</h2>
      <p>
        Wer beim Lesen eine Stelle markiert und dann teilt, bekommt das Formular mit
        Artikeladresse und Fundstelle schon ausgefüllt — auf dem Telefon über einen
        Kurzbefehl, am Rechner über ein{" "}
        <a href="https://de.wikipedia.org/wiki/Bookmarklet" target="_blank" rel="noopener">
          Bookmarklet
        </a>
        : ein Lesezeichen, das keine Seite öffnet, sondern ein kleines Skript auf der
        gerade offenen Seite ausführt.
      </p>
      {/* Das Kopierzeichen sagt, was der Knopf tut; was danach zu tun ist,
          traegt das i daneben — sonst stuende ein Absatz Anleitung fuer
          einen Handgriff da, den man einmal macht. */}
      <p class="knopfzeile">
        <button type="button" id="kopiere-lesezeichen" class="zeilenknopf">
          <span class="knopftext">
            JavaScript für das Bookmarklet <CopyIcon />
          </span>
        </button>
        <span
          class="infozeichen"
          tabindex={0}
          role="note"
          data-hinweis={LESEZEICHEN_HINWEIS}
          aria-label={LESEZEICHEN_HINWEIS}
        >
          <InfoIcon />
        </span>
        <span id="lesezeichen-hinweis" class="zaehler" aria-live="polite" />
      </p>

      {/* Der Code links, was zu ihm gehoert rechts daneben: Knopf oben,
          Bildunterschrift darunter (Entscheidung vom 13.8.2026). */}
      <div class="qr-zeile">
        <button type="button" id="qr-schalter" class="qrschalter" aria-expanded="false">
          <KurzbefehlQr />
        </button>
        <div class="qr-neben">
          <a
            class="knopf zeilenknopf"
            href="https://www.icloud.com/shortcuts/84f1ff381c1140b1b07711738869d1b7"
            target="_blank"
            rel="noopener"
          >
            <span class="knopftext">
              <AppleIcon /> Kurzbefehl beziehen (iOS)
            </span>
          </a>
          <span class="zaehler">
            QR-Code abfotografieren.
            <br />
            Skripte erlauben: folge dem Link in der Kurzbefehl-Fehlermeldung.
          </span>
        </div>
      </div>
      </div>

      <h2>Der Hinweis an die Redaktion</h2>
      <p>
        Die Fundstelle wird aus dem Artikel übernommen; der Nutzer berichtigt den Fehler und zusammen mit der Artikel-URL wird eine E‑Mail an die Redaktion erstellt. Eine Kennung am Ende des Betreffs ermöglicht die Zuordnung der Rückmeldung einer Redaktion.
      </p>

      <h2>Warum</h2>
      <p>
        Kleine Fehler können rasch behoben werden — wenn die Redaktion des Mediums davon Kenntnis hat. Diese Web-App macht das Absenden einer Korrektur so einfach wie möglich und verfolgt zudem, welche Korrekturen getätigt wurden, und was Redaktionen
        daraus machen.
      </p>

      <h2 class="rubrik">Aus der Werkstatt</h2>
      <p>
        Diese Web-App „Korrektuhren“ (im Titel bewusst falsch geschrieben) ;-) ist das Produkt einer Woche von mir und Claude. Es werden keine personenbezogenen Daten erhoben.
      </p>
      <p>
        Fehlerkategorie und Schweregrad schlägt die Seite selbst vor: Sie vergleicht beide
        Fassungen und erkennt beides anhand von Regeln, wenn es eindeutig erscheint.
      </p>
    </div>
    {/* Der Link laesst sich am Rechner schlecht antippen — kopieren hilft
        beim Weiterschicken ans Telefon. Ohne JavaScript bleibt der Link
        daneben unveraendert benutzbar. */}
    <script
      dangerouslySetInnerHTML={{
        __html: `
  const ziel = ${betreiber ? '"/neu"' : '"/hinweis"'};
  /* Das Lesezeichen wird aus der aufgerufenen Adresse gebaut, damit es auch
     lokal stimmt. Es schickt ein Formular per POST statt einer Adresse:
     Neben Fundstelle und Adresse reist der Artikeltext der geoeffneten
     Seite mit, und der passt in keine URL. Das loest die Bezahlschranke am
     Schreibtisch von selbst -- wer angemeldet liest, sieht den Text, den
     der Server nie bekommt. */
  const lesezeichen =
    "javascript:(()=>{" +
    "const t=String(getSelection()).trim().slice(0,${QUOTE_MAX_LENGTH});" +
    "const a=document.querySelector('article,main')||document.body;" +
    "const x=(a.innerText||'').trim().slice(0,${ARTIKEL_MAX_LENGTH});" +
    "const f=document.createElement('form');f.method='post';" +
    "f.action='" + location.origin + ziel + "/vorbefuellen';" +
    "[['url',location.href],['text',t],['artikelText',x]].forEach(p=>{" +
    "const i=document.createElement('input');i.type='hidden';" +
    "i.name=p[0];i.value=p[1];f.append(i)});" +
    "document.body.append(f);f.submit()})()";

  const lesezeichenHinweis = document.getElementById("lesezeichen-hinweis");
  document.getElementById("kopiere-lesezeichen").addEventListener("click", () => {
    navigator.clipboard.writeText(lesezeichen).then(
      () => { lesezeichenHinweis.textContent = "kopiert"; lesezeichenHinweis.classList.add("erkannt"); },
      () => { lesezeichenHinweis.textContent = "Kopieren nicht erlaubt — bitte von Hand markieren."; },
    );
  });

  /* Der QR-Code laesst sich antippen und waechst dann auf Lesegroesse --
     abfotografiert wird er aus der Ferne, klein ist er dafuer oft zu fein.
     Ein zweiter Klick legt ihn wieder ab. */
  const qrSchalter = document.getElementById("qr-schalter");
  qrSchalter.addEventListener("click", () => {
    const gross = qrSchalter.classList.toggle("gross");
    qrSchalter.setAttribute("aria-expanded", String(gross));
  });
`,
      }}
    />
  </Layout>
);
