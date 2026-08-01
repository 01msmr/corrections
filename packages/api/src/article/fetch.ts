const MAX_BYTES = 5_000_000;
const DEFAULT_TIMEOUT_MS = 12_000;
const USER_AGENT =
  "KorrekturTracker/1.0 (+https://korrekturen.msmr.co/anleitung; Fehlermeldungen an Redaktionen)";

export type FetchResult =
  | { ok: true; status: number; html: string }
  | {
      ok: false;
      status: number | null;
      reason: "http" | "timeout" | "too_large" | "not_html" | "network";
    };

export async function fetchArticle(
  url: string,
  options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<FetchResult> {
  const doFetch = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await doFetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
    });

    if (!response.ok) return { ok: false, status: response.status, reason: "http" };

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("html")) {
      return { ok: false, status: response.status, reason: "not_html" };
    }

    const html = await response.text();
    if (html.length > MAX_BYTES) {
      return { ok: false, status: response.status, reason: "too_large" };
    }

    return { ok: true, status: response.status, html };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return { ok: false, status: null, reason: aborted ? "timeout" : "network" };
  } finally {
    clearTimeout(timer);
  }
}
