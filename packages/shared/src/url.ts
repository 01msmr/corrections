import normalizeUrl from "normalize-url";

/**
 * Parameter, die nur der Nachverfolgung dienen. Alles andere bleibt stehen —
 * eine Artikel-ID in der Query gehoert zur Identitaet des Artikels.
 */
const TRACKING_PARAMS = [
  /^utm_/i,
  /^pk_/i,
  /^at_/i,
  // SPIEGEL-App: Teilen haengt sara_ref an, Kampagnen sara_ecid.
  /^sara_/i,
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

/**
 * Steht die Antwort noch an der angefragten Stelle? Zwischenseiten --
 * Zustimmungsfenster, Anmeldung, Bezahlschranke -- leiten den Abruf auf eine
 * andere Adresse um; der Artikeltext kommt dann nie an. Verglichen wird der
 * Pfad, nicht die Abfrage: ein angehaengtes `?from=…` oder ein Tracking-
 * Parameter aendert nichts daran, dass man am Ziel ist.
 */
export function gleicherOrt(angefragt: string, erreicht: string): boolean {
  try {
    const a = new URL(angefragt);
    const b = new URL(erreicht);
    const pfad = (u: URL): string => u.pathname.replace(/\/+$/, "");
    /* Ohne fuehrendes www.: kanonisch reist die Adresse ohne, viele Seiten
       leiten beim Abruf wieder darauf um -- man ist trotzdem am Ziel. */
    const ort = (u: URL): string => u.host.replace(/^www\./i, "");
    return ort(a) === ort(b) && pfad(a) === pfad(b);
  } catch {
    /* Unlesbare Adresse: lieber annehmen, dass alles stimmt, als eine
       brauchbare Pruefung zu verweigern. */
    return true;
  }
}
