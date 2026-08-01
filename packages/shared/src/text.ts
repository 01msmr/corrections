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
export function normalizeText(input: string): string {
  return input
    .replace(SOFT_HYPHEN, "")
    .replace(ZERO_WIDTH, "")
    .replace(DOUBLE_QUOTES, '"')
    .replace(SINGLE_QUOTES, "'")
    .replace(DASHES, "-")
    .replace(SPACES, " ")
    // NFKC erst NACH den Ersetzungen: es zerlegt U+2033 (Doppelprime, Zollzeichen)
    // in zwei U+2032, die danach zu zwei Apostrophen wuerden statt zu einem
    // Anfuehrungszeichen. Vorher ersetzen haelt die Zuordnung eindeutig.
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}
