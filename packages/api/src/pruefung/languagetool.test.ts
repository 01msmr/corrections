import { afterEach, describe, expect, it, vi } from "vitest";
import { pruefeText } from "./languagetool.js";

const DEPS = { url: "https://pruefdienst.example/v2/check", sprache: "de-DE" };

/** Antwort im Format der LanguageTool-API. */
function antwort(koerper: unknown, status = 200): Response {
  return new Response(JSON.stringify(koerper), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const ECHTE_ANTWORT = {
  matches: [
    {
      message: "Möglicher Tippfehler",
      offset: 16,
      length: 6,
      replacements: [{ value: "Fehler" }],
      rule: { id: "GERMAN_SPELLER_RULE", issueType: "misspelling", category: { id: "TYPOS" } },
    },
  ],
  sentenceRanges: [[0, 23]],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("pruefeText", () => {
  it("reicht Text und Sprache ein und gibt zugeordnete Funde zurueck", async () => {
    const gerufen: { url: string; body: string }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      gerufen.push({ url, body: String(init.body) });
      return antwort(ECHTE_ANTWORT);
    });

    const funde = await pruefeText("Erster Satz mit Fehelr.", DEPS);
    expect(gerufen[0]?.url).toBe(DEPS.url);
    expect(gerufen[0]?.body).toContain("language=de-DE");
    expect(funde).toHaveLength(1);
    expect(funde[0]?.falsch).toBe("Fehelr");
    expect(funde[0]?.richtig).toBe("Fehler");
    expect(funde[0]?.satz).toBe("Erster Satz mit Fehelr.");
  });

  it("bleibt bei Netzfehlern stumm, statt zu scheitern", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new Error("Netz weg");
    });
    await expect(pruefeText("Irgendein Text.", DEPS)).resolves.toEqual([]);
  });

  it("bleibt bei Fehlerstatus und unlesbarer Antwort stumm", async () => {
    vi.stubGlobal("fetch", async () => antwort({ matches: [] }, 503));
    await expect(pruefeText("Text.", DEPS)).resolves.toEqual([]);

    vi.stubGlobal("fetch", async () => antwort({ unerwartet: true }));
    await expect(pruefeText("Text.", DEPS)).resolves.toEqual([]);
  });

  it("fragt bei leerem Text gar nicht erst an", async () => {
    let gerufen = false;
    vi.stubGlobal("fetch", async () => {
      gerufen = true;
      return antwort(ECHTE_ANTWORT);
    });
    await expect(pruefeText("   ", DEPS)).resolves.toEqual([]);
    expect(gerufen).toBe(false);
  });

  it("kuerzt ueberlangen Text auf die Grenze der oeffentlichen API", async () => {
    let gesendet = "";
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      gesendet = new URLSearchParams(String(init.body)).get("text") ?? "";
      return antwort({ matches: [], sentenceRanges: [] });
    });
    await pruefeText("a".repeat(25_000), DEPS);
    expect(gesendet.length).toBe(18_000);
  });
});
