import { describe, expect, it } from "vitest";
import { canonicalizeUrl } from "./url.js";

describe("canonicalizeUrl", () => {
  it("entfernt Tracking-Parameter und Fragment", () => {
    const result = canonicalizeUrl(
      "https://www.example.de/politik/artikel-123?utm_source=twitter&utm_medium=social&id=7#absatz-2",
    );
    expect(result).toEqual({
      canonical: "https://example.de/politik/artikel-123?id=7",
      host: "example.de",
    });
  });

  it("normalisiert Host und Protokoll auf Kleinschreibung", () => {
    expect(canonicalizeUrl("HTTPS://WWW.Example.DE/Pfad")?.canonical).toBe(
      "https://example.de/Pfad",
    );
  });

  it("entfernt Tracking-Parameter unabhängig von der Schreibweise", () => {
    expect(canonicalizeUrl("https://example.de/x?FBCLID=1&id=2")?.canonical).toBe(
      "https://example.de/x?id=2",
    );
    expect(canonicalizeUrl("https://example.de/x?UTM_Source=a&id=2")?.canonical).toBe(
      "https://example.de/x?id=2",
    );
  });

  it("sortiert verbleibende Parameter stabil", () => {
    expect(canonicalizeUrl("https://example.de/a?b=2&a=1")?.canonical).toBe(
      "https://example.de/a?a=1&b=2",
    );
  });

  it("entfernt einen abschließenden Schrägstrich", () => {
    expect(canonicalizeUrl("https://example.de/pfad/")?.canonical).toBe("https://example.de/pfad");
    expect(canonicalizeUrl("https://example.de/")?.canonical).toBe("https://example.de");
  });

  it("behält Subdomains, die kein www sind", () => {
    expect(canonicalizeUrl("https://sz-magazin.example.de/x")?.host).toBe("sz-magazin.example.de");
  });

  it("gibt null zurück bei ungültiger Eingabe", () => {
    expect(canonicalizeUrl("kein-url")).toBeNull();
    expect(canonicalizeUrl("ftp://example.de/x")).toBeNull();
  });
});
