import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { extractArticle } from "./extract.js";

function fixture(name: string): string {
  return readFileSync(resolve(process.cwd(), "tests/fixtures", name), "utf8");
}

describe("extractArticle", () => {
  it("liefert Titel und Fließtext ohne Navigation und Fußzeile", () => {
    const result = extractArticle(fixture("artikel-standard.html"), "https://beispiel-zeitung.de/a");
    expect(result?.title).toBe("Fahrgastzahlen steigen deutlich");
    expect(result?.text).toContain("rund 4,2 Millionen Menschen die Linie");
    expect(result?.text).not.toContain("Impressum");
    expect(result?.text).not.toContain("Ressorts Politik");
  });

  it("normalisiert Typografie, damit Zitate vergleichbar werden", () => {
    const result = extractArticle(fixture("artikel-typografie.html"), "https://beispiel-zeitung.de/b");
    expect(result?.text).toContain('"Wir haben alle Fahrgastzahlen geprüft"');
    expect(result?.text).not.toMatch(/[„“–]/);
  });

  it("gibt null zurück, wenn kein Artikelinhalt erkennbar ist", () => {
    expect(extractArticle("<html><body></body></html>", "https://beispiel-zeitung.de/c")).toBeNull();
  });

  it("gibt null zurück statt zu werfen, wenn das HTML unbrauchbar ist", () => {
    // Kommt vom fremden Server: leere Antwort, Klartext, abgeschnittenes Markup.
    expect(extractArticle("", "https://beispiel-zeitung.de/d")).toBeNull();
    expect(extractArticle("kein HTML, nur Text", "https://beispiel-zeitung.de/e")).toBeNull();
    expect(() => extractArticle("<html><body><p>abgeschnitten", "https://beispiel-zeitung.de/f")).not.toThrow();
  });
});
