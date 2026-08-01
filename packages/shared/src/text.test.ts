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

  it("wendet NFKC an", () => {
    expect(normalizeText("ﬁnal")).toBe("final");
  });

  it("ist idempotent", () => {
    const once = normalizeText("„Test“ –  mit Raum");
    expect(normalizeText(once)).toBe(once);
  });
});