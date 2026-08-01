import { ANCHOR_LENGTH, normalizeText } from "@korrektur/shared";

export interface AnchorResult {
  quality: "exact" | "context" | "none";
  prefix: string | null;
  suffix: string | null;
  positionHint: number | null;
}

const NOT_FOUND: AnchorResult = {
  quality: "none",
  prefix: null,
  suffix: null,
  positionHint: null,
};

function allIndexesOf(haystack: string, needle: string): number[] {
  const found: number[] = [];
  let from = 0;
  for (;;) {
    const index = haystack.indexOf(needle, from);
    if (index === -1) return found;
    found.push(index);
    from = index + needle.length;
  }
}

/**
 * Bildet Kontext-Anker nach dem TextQuoteSelector-Muster (§8.1).
 * Beide Seiten werden normalisiert, damit Renderer-Eigenheiten nicht stören (§8.2).
 */
export function deriveAnchors(articleText: string, quote: string): AnchorResult {
  const text = normalizeText(articleText);
  const needle = normalizeText(quote);
  if (needle.length === 0) return NOT_FOUND;

  const occurrences = allIndexesOf(text, needle);
  if (occurrences.length === 0) return NOT_FOUND;

  const start = occurrences[0] ?? 0;
  const end = start + needle.length;

  return {
    quality: occurrences.length === 1 ? "exact" : "context",
    prefix: text.slice(Math.max(0, start - ANCHOR_LENGTH), start),
    suffix: text.slice(end, end + ANCHOR_LENGTH),
    positionHint: 0,
  };
}
