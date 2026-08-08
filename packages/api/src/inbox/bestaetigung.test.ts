import { describe, expect, it } from "vitest";
import { istEingangsbestaetigung } from "./bestaetigung.js";

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
