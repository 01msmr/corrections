import { extractRefFromSubject } from "@korrektur/shared";
import { describe, expect, it } from "vitest";
import { composeMail } from "./compose.js";

const INPUT = {
  ref: "K7QW3M",
  outletName: "SPIEGEL",
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
    expect(subject).toBe("Textfehler im Artikel: Fahrgastzahlen steigen deutlich [K7QW3M]");
    expect(extractRefFromSubject(subject)).toBe("K7QW3M");
  });

  it("redet die Redaktion mit ihrem Namen an", () => {
    const { text, html } = composeMail(INPUT);
    expect(text).toContain("Liebe SPIEGEL-Redaktion,");
    expect(html).toContain("Liebe SPIEGEL-Redaktion,");
  });

  it("nennt Fundstelle, Zitat und Vorschlag im Text", () => {
    const { text } = composeMail(INPUT);
    expect(text).toContain("https://beispiel-zeitung.de/politik/artikel-123");
    expect(text).toContain("rund 4,2 Millionen Menschen");
    expect(text).toContain("rund 2,4 Millionen Menschen");
    expect(text).toContain("Der Jahresbericht nennt 2,4 Millionen.");
  });

  it("hebt im HTML nur das abweichende Wort hervor, nicht den ganzen Satz", () => {
    const { html } = composeMail(INPUT);
    expect(html).toContain('<span style="color:#d0342c;font-weight:700">4,2</span>');
    expect(html).toContain('<span style="color:#2f6f4e;font-weight:700">2,4</span>');
    // Der Rest des Satzes steht unmarkiert daneben, damit der Zusammenhang lesbar bleibt.
    expect(html).not.toContain(">Millionen</span>");
    expect(html).toContain("Millionen Menschen");
  });

  it("maskiert HTML-Sonderzeichen aus dem Nutzertext", () => {
    const { html } = composeMail({
      ...INPUT,
      quoteBefore: '<script>alert("x")</script>',
      suggestionAfter: "harmlos",
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("hängt einen maschinenlesbaren Meta-Block an", () => {
    const { text } = composeMail(INPUT);
    const block = /\[korrektur-meta\]([\s\S]*?)\[\/korrektur-meta\]/.exec(text);
    expect(block?.[1]?.trim()).toBe(
      "v=2; ref=K7QW3M; typ=zahl; sev=2; url=https%3A%2F%2Fbeispiel-zeitung.de%2Fpolitik%2Fartikel-123",
    );
  });

  it("führt den Meta-Block auch im HTML-Teil, mit identischem Inhalt", () => {
    const { html } = composeMail(INPUT);
    expect(html).toContain("v=2; ref=K7QW3M; typ=zahl; sev=2;");
  });

  it("kodiert Sonderzeichen der URL, damit die Feldtrennung hält", () => {
    const { text } = composeMail({
      ...INPUT,
      articleUrlCanon: "https://beispiel-zeitung.de/a?x=1;y=2",
    });
    const block = /\[korrektur-meta\]([\s\S]*?)\[\/korrektur-meta\]/.exec(text);
    const felder = block?.[1]?.trim().split("; ") ?? [];
    expect(felder).toHaveLength(5);
    expect(felder[4]).toBe("url=https%3A%2F%2Fbeispiel-zeitung.de%2Fa%3Fx%3D1%3By%3D2");
  });

  it("entschärft Meta-Marker im Nutzertext", () => {
    const { text } = composeMail({ ...INPUT, quoteBefore: "vorher [korrektur-meta] nachher" });
    const treffer = text.match(/\[korrektur-meta\]/g) ?? [];
    expect(treffer).toHaveLength(1);
  });

  it("kommt ohne Überschrift und ohne Kommentar aus", () => {
    const { subject, text } = composeMail({ ...INPUT, headline: null, comment: null });
    expect(subject).toBe("Textfehler im Artikel [K7QW3M]");
    expect(extractRefFromSubject(subject)).toBe("K7QW3M");
    expect(text).not.toContain("Anmerkung:");
  });

  it("kürzt sehr lange Überschriften im Betreff", () => {
    const { subject } = composeMail({ ...INPUT, headline: "A".repeat(200) });
    expect(subject.length).toBeLessThan(140);
    expect(subject.endsWith("[K7QW3M]")).toBe(true);
    expect(extractRefFromSubject(subject)).toBe("K7QW3M");
  });

  it("hält den Betreff auch bei maximal langer Fehlerart-Bezeichnung im Rahmen", () => {
    // errorTypeInputSchema erlaubt bis zu 120 Zeichen, ueber das Adminformular frei
    // setzbar. Seit der Betreff sie nicht mehr nennt, darf sie ihn nicht beeinflussen.
    const { subject } = composeMail({
      ...INPUT,
      errorTypeLabel: "B".repeat(120),
      headline: "C".repeat(200),
    });
    expect(subject.length).toBeLessThan(140);
    expect(extractRefFromSubject(subject)).toBe("K7QW3M");
  });
});
