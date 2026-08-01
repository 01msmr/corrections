import normalizeUrl from "normalize-url";

/**
 * Parameter, die nur der Nachverfolgung dienen. Alles andere bleibt stehen —
 * eine Artikel-ID in der Query gehoert zur Identitaet des Artikels.
 */
const TRACKING_PARAMS = [
  /^utm_/i,
  /^pk_/i,
  /^at_/i,
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
];

export function canonicalizeUrl(raw: string): { canonical: string; host: string } | null {
  // normalize-url validiert nicht: "kein-url" wuerde zu "http://kein-url" und
  // ftp:// ginge unveraendert durch. Die Pruefung muss deshalb davor stehen und
  // kann nicht an die Bibliothek delegiert werden.
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;

  const canonical = normalizeUrl(parsed.toString(), {
    stripWWW: true,
    stripHash: true,
    sortQueryParameters: true,
    removeTrailingSlash: true,
    removeQueryParameters: TRACKING_PARAMS,
  });

  return { canonical, host: new URL(canonical).hostname };
}
