import { describe, expect, it } from "vitest";
import { canonicalizeUrl, gleicherOrt } from "./url.js";

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

  it("entfernt SPIEGEL-Tracking (sara_*), behält die Artikel-ID", () => {
    expect(
      canonicalizeUrl("https://www.spiegel.de/politik/artikel-a-ba1a07ac?sara_ref=re-so-app-sh")
        ?.canonical,
    ).toBe("https://spiegel.de/politik/artikel-a-ba1a07ac");
    expect(canonicalizeUrl("https://example.de/x?sara_ecid=abc&id=2")?.canonical).toBe(
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

describe("gleicherOrt", () => {
  const artikel = "https://www.golem.de/news/wochenrueckblick-2506-197242.html";

  it("erkennt die Umleitung auf ein Zustimmungsfenster", () => {
    /* Genau so antwortet Golem auf einen Abruf ohne Zustimmung: Status 200,
       aber an ganz anderer Stelle. Wer nur den Status prueft, haelt die
       Auswahlseite fuer den Artikel. */
    expect(
      gleicherOrt(artikel, "https://www.golem.de/sonstiges/zustimmung/auswahl.html?from=x"),
    ).toBe(false);
  });

  it("wertet die www-Umleitung nicht als Ortswechsel", () => {
    /* Kanonisch reist die Adresse ohne www.; viele Seiten (SPIEGEL) leiten
       beim Abruf wieder darauf um. Man ist trotzdem am Ziel. */
    expect(gleicherOrt("https://spiegel.de/politik/a-1", "https://www.spiegel.de/politik/a-1")).toBe(
      true,
    );
  });

  it("laesst angehaengte Parameter und einen Schlussstrich gelten", () => {
    expect(gleicherOrt(artikel, artikel + "?utm_source=rss")).toBe(true);
    expect(gleicherOrt(artikel + "/", artikel)).toBe(true);
  });

  it("erkennt den Wechsel des Hosts", () => {
    expect(gleicherOrt(artikel, "https://consent.golem.de/news/wochenrueckblick-2506-197242.html")).toBe(false);
  });

  it("nimmt bei unlesbarer Adresse an, dass alles stimmt", () => {
    expect(gleicherOrt("kein-url", "auch-keine")).toBe(true);
  });
});
