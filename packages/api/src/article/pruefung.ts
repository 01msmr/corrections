import { normalizeText } from "@korrektur/shared";

/**
 * Beurteilt die Fundstelle im nachgeladenen Artikel (Spec §8.1). Rein, ohne
 * IO: der Abruf liegt in article/fetch.ts, das Schreiben im Repo.
 *
 * Die Anker entscheiden, nicht ein Substring-Test: „Zitat weg" hiesse sonst
 * gleichermassen korrigiert, umgeschrieben oder depubliziert.
 */
export type Fundstellenzustand =
  | "unchanged"
  | "changed_as_suggested"
  | "changed_otherwise"
  | "passage_gone";

export interface Fundstellenbefund {
  zustand: Fundstellenzustand;
  /** Was an der Stelle steht, wenn sie anders geaendert wurde. */
  beobachtet: string | null;
  /** 0–100; mit Ankern hoeher als ohne. */
  sicherheit: number;
}

export interface Fundstelleneingabe {
  artikelText: string;
  quoteBefore: string;
  suggestionAfter: string;
  prefix: string | null;
  suffix: string | null;
}

export function beurteileFundstelle(eingabe: Fundstelleneingabe): Fundstellenbefund {
  const text = normalizeText(eingabe.artikelText);
  const vorher = normalizeText(eingabe.quoteBefore);
  const nachher = normalizeText(eingabe.suggestionAfter);
  const prefix = eingabe.prefix ? normalizeText(eingabe.prefix) : "";
  const suffix = eingabe.suffix ? normalizeText(eingabe.suffix) : "";

  const mitte = zwischenAnkern(text, prefix, suffix);
  if (mitte !== null) {
    if (mitte === vorher) return { zustand: "unchanged", beobachtet: null, sicherheit: 100 };
    if (mitte === nachher) {
      return { zustand: "changed_as_suggested", beobachtet: mitte, sicherheit: 100 };
    }
    return { zustand: "changed_otherwise", beobachtet: mitte, sicherheit: 80 };
  }

  /* Ohne greifende Anker bleibt der Substring -- schwaecher, aber besser als
     nichts: eine unveraenderte Stelle soll nicht als verschwunden gelten. */
  if (text.includes(vorher)) return { zustand: "unchanged", beobachtet: null, sicherheit: 60 };
  if (text.includes(nachher)) {
    return { zustand: "changed_as_suggested", beobachtet: nachher, sicherheit: 50 };
  }
  return { zustand: "passage_gone", beobachtet: null, sicherheit: 60 };
}

/** Der Text zwischen den beiden Ankern — null, wenn sie nicht greifen. */
function zwischenAnkern(text: string, prefix: string, suffix: string): string | null {
  if (prefix.length === 0 || suffix.length === 0) return null;
  const start = text.indexOf(prefix);
  if (start < 0) return null;
  const ab = start + prefix.length;
  const ende = text.indexOf(suffix, ab);
  if (ende < 0) return null;
  return text.slice(ab, ende).trim();
}
