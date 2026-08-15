import { describe, expect, it } from "vitest";
import { istEingangsbestaetigung, passtAufBestaetigungsmuster } from "./bestaetigung.js";

const KEINE = new Set<string>();

describe("istEingangsbestaetigung", () => {
  it("erkennt ein Muster im Betreff, wenn die Kennung dabei steht", () => {
    expect(
      istEingangsbestaetigung(
        {
          betreff: "AW: Textfehler im Artikel [K7F3A2B]",
          textAnfang: "Gerne sichten wir Ihre Nachricht und melden uns.",
          inReplyTo: null,
        },
        KEINE,
      ),
    ).toBe(true);
  });

  it("erkennt ein Muster, wenn die Mail auf eine bekannte Message-ID antwortet", () => {
    expect(
      istEingangsbestaetigung(
        {
          betreff: "Eingangsbestätigung",
          textAnfang: "",
          inReplyTo: "abc@korrekturen",
        },
        new Set(["abc@korrekturen"]),
      ),
    ).toBe(true);
  });

  it("laesst Muster-Treffer ohne Bezug zu unseren Korrekturen liegen", () => {
    expect(
      istEingangsbestaetigung(
        {
          betreff: "Eingangsbestätigung Ihrer Bestellung",
          textAnfang: "Gerne sichten wir Ihre Bestellung.",
          inReplyTo: "fremd@shop",
        },
        new Set(["abc@korrekturen"]),
      ),
    ).toBe(false);
  });

  it("laesst echte Antworten liegen, auch mit Kennung", () => {
    expect(
      istEingangsbestaetigung(
        {
          betreff: "AW: Textfehler im Artikel [K7F3A2B]",
          textAnfang: "Danke, wir haben den Fehler korrigiert.",
          inReplyTo: "abc@korrekturen",
        },
        new Set(["abc@korrekturen"]),
      ),
    ).toBe(false);
  });

  it("vergleicht Muster unabhaengig von Gross- und Kleinschreibung", () => {
    expect(
      istEingangsbestaetigung(
        {
          betreff: "GERNE SICHTEN WIR Ihre Zuschrift [K99ZZZZ]",
          textAnfang: "",
          inReplyTo: null,
        },
        KEINE,
      ),
    ).toBe(true);
  });
});

/* SPIEGEL hat die Formulierung geaendert: "Gern sichten und bearbeiten wir"
   statt "Gerne sichten wir". Solche Mails tragen unsere Kennung im Betreff
   und zaehlten dadurch als echte Antwort (Fund vom 14.8.2026). */
describe("SPIEGEL-Leserservice, neue Fassung", () => {
  const mail = {
    betreff:
      'Textfehler im Artikel: Anlage "He Dreiht" vor Helgoland: Größter Offshore-Windpark fertiggestel… [KVZQE7] [#5921934]',
    textAnfang:
      "Liebe Leserin, lieber Leser,\n\ndanke für Ihre Nachricht und Ihr Interesse am SPIEGEL.\n" +
      "Gern sichten und bearbeiten wir Ihren Hinweis. Im Falle einer Rückfrage melden wir uns bei Ihnen.\n" +
      "Freundliche Grüße\n\nIhr Leserservice",
    inReplyTo: null,
  };

  it("erkennt sie als Eingangsbestaetigung", () => {
    expect(istEingangsbestaetigung(mail, new Set())).toBe(true);
  });

  it("laesst eine echte Antwort des Leserservice in Ruhe", () => {
    expect(
      istEingangsbestaetigung(
        {
          betreff: "Re: Textfehler im Artikel: … [KVZQE7]",
          textAnfang:
            "Vielen Dank für den Hinweis — wir haben die Stelle korrigiert.\nFreundliche Grüße\nIhr Leserservice",
          inReplyTo: null,
        },
        new Set(),
      ),
    ).toBe(false);
  });
});

/* Zwei weitere Fassungen des Leserservice, gefunden im Papierkorb
   (14.8.2026). Beide kommen als HTML -- die Wendung steht zwischen Tags. */
describe("SPIEGEL-Leserservice, weitere Fassungen", () => {
  const mitBezug = (textAnfang: string) => ({
    betreff: "Textfehler im Artikel: Irgendein Titel [KVZQE7]",
    textAnfang,
    inReplyTo: null,
  });

  it("erkennt „Wir kümmern uns so schnell wie möglich“", () => {
    expect(
      istEingangsbestaetigung(
        mitBezug(
          "<p>Sehr geehrte Leserin, sehr geehrter Leser,</p><p>Danke für Ihre E-Mail.</p>" +
            "<p>Wir kümmern uns so schnell wie möglich darum und melden uns mit einer Antwort.</p>",
        ),
        new Set(),
      ),
    ).toBe(true);
  });

  it("erkennt „Gern bearbeiten wir Ihre Anfrage“", () => {
    expect(
      istEingangsbestaetigung(
        mitBezug(
          "<p>Liebe Leserin, lieber Leser,</p><p>Danke für Ihre Nachricht.</p>" +
            "<p>Gern bearbeiten wir Ihre Anfrage so schnell wie möglich.</p>",
        ),
        new Set(),
      ),
    ).toBe(true);
  });
});

/* Der Leserservice setzt denselben Hoeflichkeitssatz ueber beide Sorten Mail.
   Sagt die Mail etwas zur Sache, ist sie keine Bestaetigung. */
describe("Gegenmuster", () => {
  const echteAntwort = [
    "Sehr geehrter Herr Muster,",
    "vielen Dank fuer Ihr Interesse am SPIEGEL und Ihren Hinweis.",
    "Wir haben den Fehler zwischenzeitlich korrigiert.",
  ].join("\n");

  it("stuft eine Antwort mit Sachaussage nicht als Bestaetigung ein", () => {
    expect(passtAufBestaetigungsmuster(echteAntwort)).toBe(false);
    expect(
      istEingangsbestaetigung(
        { betreff: "Re: Textfehler im Artikel [K7F3A2B]", textAnfang: echteAntwort, inReplyTo: null },
        KEINE,
      ),
    ).toBe(false);
  });

  it("laesst die reine Bestaetigung Bestaetigung bleiben", () => {
    const nurEingang = [
      "vielen Dank fuer Ihr Interesse am SPIEGEL und Ihren Hinweis.",
      "Wir haben das an die Redaktion weitergeleitet.",
    ].join("\n");
    expect(passtAufBestaetigungsmuster(nurEingang)).toBe(true);
  });
});
