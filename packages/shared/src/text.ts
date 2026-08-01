const DOUBLE_QUOTES = /[“”„‟«»″]/g;
const SINGLE_QUOTES = /[‘’‚‛‹›′]/g;
const DASHES = /[‐‑‒–—―−]/g;
const SOFT_HYPHEN = /­/g;
/* eslint-disable no-irregular-whitespace, no-misleading-character-class */
const SPACES = /[  -   　]/g;
const ZERO_WIDTH = /[​‌‍﻿]/g;
/* eslint-enable no-irregular-whitespace, no-misleading-character-class */

/**
 * Bringt Text in eine Form, in der Vergleiche nicht an Renderer-Eigenheiten
 * scheitern. Muss bei Erfassung und Check identisch angewendet werden (§8.2).
 */
/** Einmal geschrieben, zweimal aufgerufen — siehe normalizeText. */
function replaceTypography(value: string): string {
  return value
    .replace(SOFT_HYPHEN, "")
    .replace(ZERO_WIDTH, "")
    .replace(DOUBLE_QUOTES, '"')
    .replace(SINGLE_QUOTES, "'")
    .replace(DASHES, "-")
    .replace(SPACES, " ");
}

/**
 * Bringt Text in eine Form, in der Vergleiche nicht an Renderer-Eigenheiten
 * scheitern. Muss bei Erfassung und Check identisch angewendet werden (§8.2).
 *
 * Zweimal ersetzen mit NFKC dazwischen, und beide Durchgaenge sind noetig:
 * Der erste bildet U+2033 (Zollzeichen) auf " ab, bevor NFKC es in zwei U+2032
 * zerlegen und daraus zwei Apostrophe machen kann. Der zweite faengt ab, was
 * NFKC selbst erst erzeugt — U+2034, U+2057 und die Bindestrich-
 * Praesentationsformen zerfallen in Klassenmitglieder. Erst dadurch enthaelt
 * die Ausgabe garantiert kein Zeichen der Klassen mehr; die Idempotenz haengt
 * dann an der Struktur und nicht an den zufaellig getesteten Eingaben.
 */
export function normalizeText(input: string): string {
  return replaceTypography(replaceTypography(input).normalize("NFKC"))
    .replace(/\s+/g, " ")
    .trim();
}
