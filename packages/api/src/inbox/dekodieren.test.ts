import { describe, expect, it } from "vitest";
import { dekodiereQuotedPrintable, lesbarerText } from "./dekodieren.js";

/* Mailtexte kommen quoted-printable: Umlaute als =C3=BC, lange Zeilen mit
   einem "=" am Ende umgebrochen. Ohne Dekodieren greift kein Muster mit
   Umlaut, und jede Wendung kann mitten im Wort zerrissen sein
   (Fund im Papierkorb, 14.8.2026). */
describe("dekodiereQuotedPrintable", () => {
  it("setzt Umlaute zurueck", () => {
    expect(dekodiereQuotedPrintable("vielen Dank f=C3=BCr Ihr Interesse")).toBe(
      "vielen Dank für Ihr Interesse",
    );
  });

  it("naeht weiche Zeilenumbrueche wieder zusammen", () => {
    expect(dekodiereQuotedPrintable("Gern sichten und bear=\r\nbeiten wir")).toBe(
      "Gern sichten und bearbeiten wir",
    );
  });

  it("laesst gewoehnlichen Text unangetastet", () => {
    expect(dekodiereQuotedPrintable("Gern sichten und bearbeiten wir Ihren Hinweis.")).toBe(
      "Gern sichten und bearbeiten wir Ihren Hinweis.",
    );
  });
});

/* Antworten kommen als mehrteilige Mail: Kopfzeilen, Grenzmarken, und der
   Text base64- oder quoted-printable-kodiert. Ungefiltert stand das alles
   im Auszug der Historie (Fund vom 14.8.2026). */
describe("lesbarerText", () => {
  it("holt den base64-Teil aus einer mehrteiligen Mail", () => {
    const roh = [
      "--_000_AS8P190MB1112EURP_",
      'Content-Type: text/plain; charset="utf-8"',
      "Content-Transfer-Encoding: base64",
      "",
      "SGFsbG8gSGVyciBNYWFzbWVpZXIsDQpkYW5rZSBmw7xyIGRlbiBIaW53ZWlzLCB3aXIgaGFiZW4g",
      "ZGVuIEZlaGxlciBrb3JyaWdpZXJ0Lg0K",
      "--_000_AS8P190MB1112EURP_--",
    ].join("\r\n");
    expect(lesbarerText(roh)).toBe(
      "Hallo Herr Maasmeier,\ndanke für den Hinweis, wir haben den Fehler korrigiert.",
    );
  });

  it("nimmt den quoted-printable-Teil, wenn er dasteht", () => {
    const roh = [
      "--grenze",
      "Content-Type: text/plain; charset=utf-8",
      "Content-Transfer-Encoding: quoted-printable",
      "",
      "vielen Dank f=C3=BCr Ihr Interesse am SPIEGEL.",
      "--grenze--",
    ].join("\r\n");
    expect(lesbarerText(roh)).toBe("vielen Dank für Ihr Interesse am SPIEGEL.");
  });

  it("laesst eine gewoehnliche Mail unangetastet", () => {
    expect(lesbarerText("Danke für den Hinweis, wir haben korrigiert.")).toBe(
      "Danke für den Hinweis, wir haben korrigiert.",
    );
  });
});
