import { describe, expect, it } from "vitest";
import { extractRefFromSubject, generateRef, isRef, REF_PATTERN } from "./ref.js";

describe("generateRef", () => {
  it("erzeugt K plus fünf Crockford-Zeichen", () => {
    for (let i = 0; i < 200; i++) {
      const ref = generateRef();
      expect(ref).toHaveLength(6);
      expect(ref).toMatch(REF_PATTERN);
    }
  });

  it("verwendet keine verwechselbaren Zeichen", () => {
    const many = Array.from({ length: 500 }, () => generateRef()).join("");
    expect(many).not.toMatch(/[ILOU]/);
  });

  it("liefert praktisch nie denselben Wert", () => {
    const set = new Set(Array.from({ length: 1000 }, () => generateRef()));
    expect(set.size).toBeGreaterThan(995);
  });
});

describe("isRef", () => {
  it("erkennt gültige und ungültige Werte", () => {
    expect(isRef("K7QW3")).toBe(false);
    expect(isRef("K7QW3M")).toBe(true);
    expect(isRef("K7QW3I")).toBe(false);
    expect(isRef("X7QW3M")).toBe(false);
  });
});

describe("extractRefFromSubject", () => {
  it("findet den Token am Ende", () => {
    expect(extractRefFromSubject("Korrekturhinweis: Zahlendreher [K7QW3M]")).toBe("K7QW3M");
  });

  it("findet den Token trotz Antwort-Präfixen und Ticketnummer", () => {
    expect(
      extractRefFromSubject("AW: [Ticket#88213] Korrekturhinweis: Zahlendreher [K7QW3M]"),
    ).toBe("K7QW3M");
  });

  it("ignoriert fremde Klammerausdrücke", () => {
    expect(extractRefFromSubject("Re: [Ticket#88213] Ihre Anfrage")).toBeNull();
  });
});
