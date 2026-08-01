import { describe, expect, it } from "vitest";
import { fetchArticle } from "./fetch.js";

function stubFetch(response: Response): typeof fetch {
  return (async () => response) as unknown as typeof fetch;
}

describe("fetchArticle", () => {
  it("liefert HTML bei Status 200", async () => {
    const stub = stubFetch(
      new Response("<html><body>Text</body></html>", {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
    );
    const result = await fetchArticle("https://beispiel-zeitung.de/a", { fetchImpl: stub });
    expect(result).toEqual({ ok: true, status: 200, html: "<html><body>Text</body></html>" });
  });

  it("meldet http bei Fehlerstatus", async () => {
    const stub = stubFetch(new Response("", { status: 403, headers: { "content-type": "text/html" } }));
    const result = await fetchArticle("https://beispiel-zeitung.de/a", { fetchImpl: stub });
    expect(result).toEqual({ ok: false, status: 403, reason: "http" });
  });

  it("erkennt HTML unabhängig von Groß-/Kleinschreibung des Content-Type", async () => {
    // Manche Server-Konfigurationen (z. B. IIS) senden "TEXT/HTML" statt "text/html".
    const stub = stubFetch(
      new Response("<html><body>Text</body></html>", {
        status: 200,
        headers: { "content-type": "TEXT/HTML; charset=utf-8" },
      }),
    );
    const result = await fetchArticle("https://beispiel-zeitung.de/a", { fetchImpl: stub });
    expect(result).toEqual({ ok: true, status: 200, html: "<html><body>Text</body></html>" });
  });

  it("meldet not_html bei fremdem Content-Type", async () => {
    const stub = stubFetch(
      new Response("{}", { status: 200, headers: { "content-type": "application/json" } }),
    );
    const result = await fetchArticle("https://beispiel-zeitung.de/a", { fetchImpl: stub });
    expect(result).toEqual({ ok: false, status: 200, reason: "not_html" });
  });

  it("meldet too_large bei überschrittener Größe", async () => {
    const stub = stubFetch(
      new Response("x".repeat(6_000_000), {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );
    const result = await fetchArticle("https://beispiel-zeitung.de/a", { fetchImpl: stub });
    expect(result).toEqual({ ok: false, status: 200, reason: "too_large" });
  });

  it("meldet network, wenn der Abruf wirft", async () => {
    const stub = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    const result = await fetchArticle("https://beispiel-zeitung.de/a", { fetchImpl: stub });
    expect(result).toEqual({ ok: false, status: null, reason: "network" });
  });
});
