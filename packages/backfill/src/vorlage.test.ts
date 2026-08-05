import { describe, expect, it } from "vitest";
import { parseVorlage } from "./vorlage.js";

/** Synthetische Vorlagen-Mail nach dem Muster des Kurzbefehls — erfundene
 *  Inhalte, keine echten Adressen oder Zitate (§11.5). */
function beispiel(overrides?: { fehlerart?: string; richtigZeile?: string }): string {
  const fehlerart = overrides?.fehlerart ?? "ein Zeichen zu viel";
  const richtigZeile = overrides?.richtigZeile ?? "Richtig wäre m. M. n.:";
  return [
    "Liebe Beispiel-Redaktion,",
    "",
    "es gibt einen Fehler im Artikel",
    "„Probeartikel: Ein Titel mit Doppelpunkt“,",
    "siehe: https://beispiel-zeitung.de/artikel/probe-123",
    "",
    "________ ________ ________",
    "",
    `Falsch ist (${fehlerart}):`,
    "„Der Mondd ist rund.“",
    "",
    "",
    richtigZeile,
    "„Der Mond ist rund.“",
    "",
    "________ ________ ________",
    "",
    "Zur Vereinfachung meiner Textkorrekturen habe ich mir einen Kurzbefehl erstellt.",
    "",
    "--",
    "Mit freundlichen Grüßen,",
    "Erika Musterfrau",
  ].join("\n");
}

const BETREFF = "Textfehler im Artikel: Probeartikel: Ein Titel mit Doppelpunkt";

describe("parseVorlage", () => {
  it("liest alle Felder einer vollstaendigen Vorlagen-Mail", () => {
    const ergebnis = parseVorlage(BETREFF, beispiel());
    expect(ergebnis).toEqual({
      ueberschrift: "Probeartikel: Ein Titel mit Doppelpunkt",
      artikelUrl: "https://beispiel-zeitung.de/artikel/probe-123",
      fehlerartRoh: "ein Zeichen zu viel",
      fehlerartKey: "zeichen_zu_viel",
      fehlerartAnzahl: 1,
      fehlerartZeichen: null,
      falsch: "Der Mondd ist rund.",
      richtig: "Der Mond ist rund.",
      konfidenz: "sicher",
    });
  });

  it("versteht die Markervarianten der Richtig-Zeile", () => {
    const varianten = [
      "Richtig wäre m. E. n.:",
      "Besser wäre m. M. n.:",
      "Richtiger wäre m. M. n.:",
      "Richtig wäre vermutlich:",
      "Wesentlich besser wäre m. M. n.:",
      "Viel besser wäre m. E. n.:",
      "Viel angemessener wäre m. M. n.:",
      "Etwas besser wäre m. M. n.:",
    ];
    for (const zeile of varianten) {
      const ergebnis = parseVorlage(BETREFF, beispiel({ richtigZeile: zeile }));
      expect(ergebnis.richtig, zeile).toBe("Der Mond ist rund.");
      expect(ergebnis.konfidenz, zeile).toBe("sicher");
    }
  });

  it("bildet die gaengigen Alt-Labels auf Schluessel und Anzahl ab", () => {
    const faelle: [string, string, number | null][] = [
      ["schlechter Satzbau", "schlechter_satzbau", null],
      ["sehr schlechter Satzbau", "schlechter_satzbau", null],
      ["falscher Satzbau", "satzbau", null],
      ["zwei Zeichen fehlen", "zeichen_fehlt", 2],
      ["2 Zeichen fehlen", "zeichen_fehlt", 2],
      ["ein Leerzeichen fehlt", "zeichen_fehlt", 1],
      ["zwei Worte zu viel", "wort_zu_viel", 2],
      ["drei Worte fehlen", "wort_fehlt", 3],
      ["zwei Kommata fehlen", "komma_fehlt", 2],
      ["ein Satzzeichen fehlt", "komma_fehlt", 1],
      ["schlechte Wortwahl", "falsche_wortwahl", null],
      ["falsche Verlinkung: Links auf „hier“", "linktext", null],
      ["Inhaltsfehler", "inhaltsfehler", null],
    ];
    for (const [label, key, anzahl] of faelle) {
      const ergebnis = parseVorlage(BETREFF, beispiel({ fehlerart: label }));
      expect(ergebnis.fehlerartKey, label).toBe(key);
      expect(ergebnis.fehlerartAnzahl, label).toBe(anzahl);
    }
  });

  it("liest das konkrete Satzzeichen aus Komma-Labels", () => {
    const komma = parseVorlage(BETREFF, beispiel({ fehlerart: "ein Komma zu viel" }));
    expect(komma.fehlerartZeichen).toBe(",");
    const generisch = parseVorlage(BETREFF, beispiel({ fehlerart: "ein Satzzeichen fehlt" }));
    expect(generisch.fehlerartZeichen).toBeNull();
  });

  it("laesst unbekannte Labels ungemappt und stuft auf 'pruefen'", () => {
    const ergebnis = parseVorlage(
      BETREFF,
      beispiel({ fehlerart: "ein Buchstabendreher, ein Zeichen fehlt" }),
    );
    expect(ergebnis.fehlerartRoh).toBe("ein Buchstabendreher, ein Zeichen fehlt");
    expect(ergebnis.fehlerartKey).toBeNull();
    expect(ergebnis.konfidenz).toBe("pruefen");
  });

  it("verwirft, wenn die Artikel-URL fehlt", () => {
    const ohneUrl = beispiel().replace(/^siehe: .*$/m, "");
    expect(parseVorlage(BETREFF, ohneUrl).konfidenz).toBe("verworfen");
  });

  it("verwirft, wenn der Falsch-Block fehlt", () => {
    const ohneFalsch = beispiel().replace(/^Falsch ist .*$/m, "").replace("„Der Mondd ist rund.“", "");
    expect(parseVorlage(BETREFF, ohneFalsch).konfidenz).toBe("verworfen");
  });

  it("erhaelt mehrzeilige Zitate am Stueck", () => {
    const mehrzeilig = beispiel().replace(
      "„Der Mondd ist rund.“",
      "„Der Mondd ist rund\nund hell.“",
    );
    expect(parseVorlage(BETREFF, mehrzeilig).falsch).toBe("Der Mondd ist rund\nund hell.");
  });

  it("nimmt die Ueberschrift notfalls aus dem Betreff", () => {
    const ohneKopfzitat = beispiel().replace("„Probeartikel: Ein Titel mit Doppelpunkt“,", "");
    const ergebnis = parseVorlage(BETREFF, ohneKopfzitat);
    expect(ergebnis.ueberschrift).toBe("Probeartikel: Ein Titel mit Doppelpunkt");
  });
});
