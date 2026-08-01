const TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "msclkid",
  "ref",
  "ref_src",
  "wt_mc",
  "wt_zmc",
  "xtor",
]);

const TRACKING_PREFIXES = ["utm_", "pk_", "at_"];

function isTracking(key: string): boolean {
  const lower = key.toLowerCase();
  return TRACKING_PARAMS.has(lower) || TRACKING_PREFIXES.some((p) => lower.startsWith(p));
}

export function canonicalizeUrl(raw: string): { canonical: string; host: string } | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  url.hostname = host;
  url.protocol = url.protocol.toLowerCase();
  url.hash = "";
  url.username = "";
  url.password = "";

  const kept = [...url.searchParams.entries()].filter(([key]) => !isTracking(key));
  kept.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  url.search = "";
  for (const [key, value] of kept) url.searchParams.append(key, value);

  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }

  return { canonical: url.toString(), host };
}
