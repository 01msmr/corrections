/* eslint-disable no-irregular-whitespace, no-misleading-character-class */
const DOUBLE_QUOTES = /[“”„‟«»″]/g;
const SINGLE_QUOTES = /[‘’‚‛‹›′]/g;
const DASHES = /[‐‑‒–—―−]/g;
const SOFT_HYPHEN = /­/g;
const SPACES = /[  -   　]/g;
const ZERO_WIDTH = /[​‌‍﻿]/g;
/* eslint-enable no-irregular-whitespace, no-misleading-character-class */

/**
 * Bringt Text in eine Form, in der Vergleiche nicht an Renderer-Eigenheiten
 * scheitern. Muss bei Erfassung und Check identisch angewendet werden (§8.2).
 */
export function normalizeText(input: string): string {
  return input
    .normalize("NFKC")
    .replace(SOFT_HYPHEN, "")
    .replace(ZERO_WIDTH, "")
    .replace(DOUBLE_QUOTES, '"')
    .replace(SINGLE_QUOTES, "'")
    .replace(DASHES, "-")
    .replace(SPACES, " ")
    .replace(/\s+/g, " ")
    .trim();
}