import { extractRefFromSubject } from "@korrektur/shared";
import { describe, expect, it } from "vitest";
import { composeMail } from "./compose.js";

const INPUT = {
  ref: "K7QW3M",
  articleUrl: "https://beispiel-zeitung.de/politik/artikel-123",
  articleUrlCanon: "https://beispiel-zeitung.de/politik/artikel-123",
  headline: "Fahrgastzahlen steigen deutlich",
  errorTypeKey: "zahl",
  errorTypeLabel: "Zahl",
  severity: 2 as const,
  quoteBefore: "rund 4,2 Millionen Menschen",
  suggestionAfter: "rund 2,4 Millionen Menschen",
  comment: "Der Jahresbericht nennt 2,4 Millionen.",
  baseUrl: "https://korrektur.example.tld",
};

describe("composeMail", () => {
  it("setzt den Referenz-Token ans Ende des Betreffs", () => {
    const { subject } = composeMail(INPUT);
    expect(subject.endsWith("[K7QW3M]")).toBe(true);
    expect(extractRefFromSubject(subject)).toBe("K7QW3M");
  });

  it("nennt Fundstelle, Zitat und Vorschlag im Text", () => {
    const { text } = composeMail(INPUT);
    expect(text).toContain("https://beispiel-zeitung.de/politik/artikel-123");
    expect(text).toContain("rund 4,2 Millionen Menschen");
    expect(text).toContain("rund 2,4 Millionen Menschen");
    expect(text).toContain("Der Jahresbericht nennt 2,4 Millionen.");
  });

  it("hängt einen maschinenlesbaren Meta-Block an", () => {
    const { text } = composeMail(INPUT);
    const block = /\[korrektur-meta\]([\s\S]*?)\[\/korrektur-meta\]/.exec(text);
    expect(block?.[1]?.trim()).toBe(
      "v=2; ref=K7QW3M; url=https://beispiel-zeitung.de/politik/artikel-123; typ=zahl; sev=2",
    );
  });

  it("kommt ohne Überschrift und ohne Kommentar aus", () => {
    const { subject, text } = composeMail({ ...INPUT, headline: null, comment: null });
    expect(extractRefFromSubject(subject)).toBe("K7QW3M");
    expect(text).not.toContain("Anmerkung:");
  });

  it("kürzt sehr lange Überschriften im Betreff", () => {
    const { subject } = composeMail({ ...INPUT, headline: "A".repeat(200) });
    expect(subject.length).toBeLessThan(140);
    expect(subject.endsWith("[K7QW3M]")).toBe(true);
  });
});
