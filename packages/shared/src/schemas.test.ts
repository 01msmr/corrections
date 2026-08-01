import { describe, expect, it } from "vitest";
import { QUOTE_MAX_LENGTH } from "./constants.js";
import { errorTypeInputSchema, newCorrectionSchema, outletInputSchema } from "./schemas.js";

const VALID = {
  idempotencyKey: "abcdef0123456789",
  articleUrl: "https://beispiel-zeitung.de/a",
  errorTypeKey: "zahl",
  severity: 2,
  quoteBefore: "rund 4,2 Millionen",
  suggestionAfter: "rund 2,4 Millionen",
};

describe("newCorrectionSchema", () => {
  it("nimmt eine gültige Eingabe an und setzt Vorgaben", () => {
    const parsed = newCorrectionSchema.parse(VALID);
    expect(parsed.headline).toBeNull();
    expect(parsed.comment).toBeNull();
  });

  it("weist ein zu langes Zitat ab", () => {
    const result = newCorrectionSchema.safeParse({
      ...VALID,
      quoteBefore: "x".repeat(QUOTE_MAX_LENGTH + 1),
    });
    expect(result.success).toBe(false);
  });

  it("weist eine unzulässige Schwere ab", () => {
    expect(newCorrectionSchema.safeParse({ ...VALID, severity: 4 }).success).toBe(false);
    expect(newCorrectionSchema.safeParse({ ...VALID, severity: 0 }).success).toBe(false);
    expect(newCorrectionSchema.safeParse({ ...VALID, severity: "2.5" }).success).toBe(false);
    // Ohne die union-Stufe waere true zu 1 geworden.
    expect(newCorrectionSchema.safeParse({ ...VALID, severity: true }).success).toBe(false);
  });

  it("weist eine ungültige URL ab", () => {
    expect(newCorrectionSchema.safeParse({ ...VALID, articleUrl: "kein-url" }).success).toBe(false);
  });

  it("kennt kein Autorenfeld", () => {
    const parsed = newCorrectionSchema.parse({ ...VALID, author: "Jemand" });
    expect(Object.keys(parsed)).not.toContain("author");
  });
});

describe("outletInputSchema", () => {
  it("nimmt mehrere Kontaktadressen an", () => {
    const parsed = outletInputSchema.parse({
      name: "Beispiel-Zeitung",
      primaryDomain: "Beispiel-Zeitung.DE",
      contactEmails: ["leserbriefe@beispiel-zeitung.de", "redaktion@beispiel-zeitung.de"],
    });
    expect(parsed.primaryDomain).toBe("beispiel-zeitung.de");
    expect(parsed.contactEmails).toHaveLength(2);
  });

  it("prüft die Domainlänge nach dem Entfernen von www.", () => {
    const kurz = outletInputSchema.safeParse({
      name: "X",
      primaryDomain: "www.ab",
      contactEmails: [],
    });
    expect(kurz.success).toBe(false);

    const lang = outletInputSchema.parse({
      name: "X",
      primaryDomain: `www.${"a".repeat(250)}`,
      contactEmails: [],
    });
    expect(lang.primaryDomain).toHaveLength(250);
  });

  it("weist eine ungültige Adresse ab", () => {
    const result = outletInputSchema.safeParse({
      name: "X",
      primaryDomain: "x.de",
      contactEmails: ["keine-adresse"],
    });
    expect(result.success).toBe(false);
  });
});

describe("errorTypeInputSchema", () => {
  it("erzwingt einen Slug als Schlüssel", () => {
    expect(errorTypeInputSchema.safeParse({ key: "Toter Link", label: "L", sortOrder: 10 }).success).toBe(false);
    expect(errorTypeInputSchema.safeParse({ key: "toter_link", label: "L", sortOrder: 10 }).success).toBe(true);
  });
});
