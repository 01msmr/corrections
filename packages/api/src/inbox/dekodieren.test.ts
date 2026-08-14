import { describe, expect, it } from "vitest";
import { dekodiereQuotedPrintable } from "./dekodieren.js";

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
