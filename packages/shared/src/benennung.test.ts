import { describe, expect, it } from "vitest";
import { benenneFehlerart, istZaehlbareFehlerart } from "./benennung.js";

describe("benenneFehlerart", () => {
  it("nutzt bei Anzahl 1 das Zahlwort mit Einzahlform", () => {
    expect(benenneFehlerart("zeichen_fehlt", "Zeichen fehlen", 1)).toBe("ein Zeichen fehlt");
    expect(benenneFehlerart("wort_zu_viel", "Wörter zu viel", 1)).toBe("ein Wort zu viel");
  });

  it("schreibt kleine Anzahlen aus und stellt sie vor die Grundform", () => {
    expect(benenneFehlerart("zeichen_fehlt", "Zeichen fehlen", 2)).toBe("zwei Zeichen fehlen");
    expect(benenneFehlerart("komma_zu_viel", "Satzzeichen zu viel", 3)).toBe("drei Satzzeichen zu viel");
    expect(benenneFehlerart("wort_fehlt", "Wörter fehlen", 2)).toBe("zwei Wörter fehlen");
    expect(benenneFehlerart("buchstabendreher", "ein Buchstabendreher", 2)).toBe("zwei Buchstabendreher");
  });

  it("nutzt ab dreizehn Ziffern", () => {
    expect(benenneFehlerart("zeichen_fehlt", "Zeichen fehlen", 13)).toBe("13 Zeichen fehlen");
  });

  it("laesst nicht zaehlbare Kategorien und fehlende Anzahl beim Listen-Label", () => {
    expect(benenneFehlerart("falsche_wortwahl", "falsche Wortwahl", 2)).toBe("falsche Wortwahl");
    expect(benenneFehlerart("zeichen_fehlt", "Zeichen fehlen", null)).toBe("Zeichen fehlen");
    expect(benenneFehlerart("zeichen_fehlt", "Zeichen fehlen", 0)).toBe("Zeichen fehlen");
  });

  it("kennt die zaehlbaren Schluessel", () => {
    expect(istZaehlbareFehlerart("zeichen_fehlt")).toBe(true);
    expect(istZaehlbareFehlerart("satzbau")).toBe(false);
  });
});
