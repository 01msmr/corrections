import { describe, expect, it } from "vitest";
import { normalizeText } from "./text.js";

describe("normalizeText", () => {
  it("vereinheitlicht typografische Anführungszeichen", () => {
    expect(normalizeText("„Zitat“ und ‚Zitat‘ und »Zitat«")).toBe('"Zitat" und \'Zitat\' und "Zitat"');
  });

  it("vereinheitlicht Striche", () => {
    expect(normalizeText("A–B —C −D")).toBe("A-B -C -D");
  });

  it("entfernt weiche Trennstriche und geschützte Leerzeichen", () => {
    expect(normalizeText("Fahr­gast zahlen")).toBe("Fahrgast zahlen");
  });

  it("faltet Whitespace zusammen und trimmt", () => {
    expect(normalizeText("  viel\n\n  Platz\t hier  ")).toBe("viel Platz hier");
  });

  it("bildet das Zollzeichen auf ein doppeltes Anfuehrungszeichen ab", () => {
    expect(normalizeText("5\u2033 Bildschirm")).toBe('5" Bildschirm');
  });

  it("wendet NFKC an", () => {
    expect(normalizeText("ﬁnal")).toBe("final");
  });

  it("faengt auch Zeichen ab, die erst NFKC erzeugt", () => {
    expect(normalizeText("12\u2034 Winkel")).toBe("12''' Winkel");
    expect(normalizeText("a\ufe31b")).toBe("a-b");
  });

  it("ist idempotent, auch fuer Zeichen die NFKC erst zerlegt", () => {
    const eingaben = ["„Test“ –  mit Raum", "5\u2033 Zoll", "12\u2034 Winkel", "a\ufe31b"];
    for (const input of eingaben) {
      const once = normalizeText(input);
      expect(normalizeText(once)).toBe(once);
    }
  });
});
