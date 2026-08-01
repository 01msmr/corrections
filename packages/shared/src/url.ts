import normalizeUrl from "normalize-url";

/**
 * Parameter, die nur der Nachverfolgung dienen. Alles andere bleibt stehen —
 * eine Artikel-ID in der Query gehoert zur Identitaet des Artikels.
 */
const TRACKING_PARAMS = [
  /^utm_/i,
  /^pk_/i,
  /^at_/i,
  // Durchgaengig als Regex mit i-Flag: normale Zeichenketten vergleicht
  // normalize-url case-sensitiv, dann bliebe "?FBCLID=1" stehen und derselbe
  // Artikel bekaeme je nach Schreibweise zwei verschiedene Dedupe-Schluessel.
  /^fbclid$/i,
  /^gclid$/i,
  /^igshid$/i,
  /^mc_cid$/i,
  /^mc_eid$/i,
  /^msclkid$/i,
  /^ref$/i,
  /^ref_src$/i,
  /^wt_mc$/i,
  /^wt_zmc$/i,
  /^xtor$/i,
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
