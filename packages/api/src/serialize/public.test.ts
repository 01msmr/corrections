import { describe, expect, it } from "vitest";
import {
  assertNoForbiddenFields,
  FORBIDDEN_PUBLIC_FIELDS,
  toPublicCorrection,
  toPublicOutlet,
} from "./public.js";

const ROW = {
  id: "c1",
  ref: "K7QW3M",
  idempotencyKey: "abcdef0123456789",
  createdAt: 1_800_000_000,
  dispatchMode: "smtp" as const,
  articleUrl: "https://beispiel-zeitung.de/a",
  articleUrlCanon: "https://beispiel-zeitung.de/a",
  outletId: "o1",
  headline: "Fahrgastzahlen steigen deutlich",
  publishedAt: null,
  errorTypeId: "e1",
  severity: 2,
  quoteBefore: "rund 4,2 Millionen",
  quotePrefix: "Im vergangenen Jahr nutzten ",
  quoteSuffix: " Menschen die Linie",
  quotePositionHint: 0,
  anchorQuality: "exact" as const,
  suggestionAfter: "rund 2,4 Millionen",
  comment: null,
  recipientEmail: "leserbriefe@beispiel-zeitung.de",
  messageId: "<abc@example.tld>",
  dispatchStatus: "sent" as const,
  sentAt: 1_800_000_000,
  sendConfirmedBy: "smtp" as const,
  outcome: "corrected" as const,
  respondedAt: null,
  correctedAt: 1_800_100_000,
  verification: "manual" as const,
  source: "web" as const,
  needsReview: false,
};

const OUTLET = {
  id: "o1",
  name: "Beispiel-Zeitung",
  primaryDomain: "beispiel-zeitung.de",
  publisher: "Beispiel Verlag",
  country: "DE",
  notes: "interne Notiz",
  contactEmails: ["leserbriefe@beispiel-zeitung.de"],
  archived: false,
  createdAt: 1_800_000_000,
  domains: ["beispiel-zeitung.de"],
};

describe("toPublicCorrection", () => {
  it("übernimmt die zulässigen Felder", () => {
    const result = toPublicCorrection(ROW, "Beispiel-Zeitung", "Zahl");
    expect(result.ref).toBe("K7QW3M");
    expect(result.outletName).toBe("Beispiel-Zeitung");
    expect(result.errorTypeLabel).toBe("Zahl");
    expect(result.quoteBefore).toBe("rund 4,2 Millionen");
    expect(result.outcome).toBe("corrected");
  });

  it("enthält weder Empfänger noch Message-ID noch Ankertexte", () => {
    const result = toPublicCorrection(ROW, "Beispiel-Zeitung", "Zahl");
    const keys = Object.keys(result);
    expect(keys).not.toContain("recipientEmail");
    expect(keys).not.toContain("messageId");
    expect(keys).not.toContain("quotePrefix");
    expect(keys).not.toContain("quoteSuffix");
    expect(keys).not.toContain("idempotencyKey");
  });

  it("übersteht den Wächter", () => {
    expect(() => assertNoForbiddenFields(toPublicCorrection(ROW, "X", "Y"))).not.toThrow();
  });
});

describe("toPublicOutlet", () => {
  it("liefert Name und Verlag, aber keine Adressen und keine Notizen", () => {
    const result = toPublicOutlet(OUTLET);
    expect(result.name).toBe("Beispiel-Zeitung");
    expect(Object.keys(result)).not.toContain("contactEmails");
    expect(Object.keys(result)).not.toContain("notes");
    expect(() => assertNoForbiddenFields(result)).not.toThrow();
  });
});

describe("assertNoForbiddenFields", () => {
  it("kennt alle in der Spec genannten Felder", () => {
    for (const field of ["recipientEmail", "fromAddr", "excerpt", "contactEmails", "observedText", "author"]) {
      expect(FORBIDDEN_PUBLIC_FIELDS).toContain(field);
    }
  });

  it("wirft bei einem verbotenen Feld auf oberster Ebene", () => {
    expect(() => assertNoForbiddenFields({ ref: "K7QW3M", recipientEmail: "x@y.de" })).toThrow(
      /recipientEmail/,
    );
  });

  it("wirft auch bei verschachtelten und in Listen versteckten Feldern", () => {
    expect(() => assertNoForbiddenFields({ a: { b: { excerpt: "Danke für den Hinweis" } } })).toThrow(
      /excerpt/,
    );
    expect(() => assertNoForbiddenFields([{ ok: 1 }, { author: "Jemand" }])).toThrow(/author/);
  });

  it("lässt harmlose Strukturen durch", () => {
    expect(() => assertNoForbiddenFields({ liste: [{ ref: "K7QW3M", n: 3 }], summe: 3 })).not.toThrow();
  });
});
