import { normalizeText } from "./text.js";

export interface DiffSegment {
  /** Woertlich wie eingegeben, damit der Satz unveraendert lesbar bleibt. */
  text: string;
  /** True, wenn dieses Wort auf der Gegenseite fehlt. */
  changed: boolean;
}

export interface WordDiff {
  before: DiffSegment[];
  after: DiffSegment[];
}

/** Woerter und die Zwischenraeume dazwischen, damit sich der Satz verlustfrei zusammensetzen laesst. */
function tokenize(value: string): string[] {
  return value.length === 0 ? [] : value.split(/(\s+)/).filter((t) => t.length > 0);
}

function isSpace(token: string): boolean {
  return /^\s+$/.test(token);
}

/**
 * Vergleichsform eines Wortes. normalizeText vereinheitlicht Anfuehrungszeichen,
 * Striche und Leerraum — sonst gaelte „fuenf“ gegen "fuenf" als Unterschied,
 * obwohl sich nur die Typografie des Renderers unterscheidet (§8.2).
 */
function comparable(token: string): string {
  return normalizeText(token);
}

/**
 * Laengste gemeinsame Teilfolge ueber die Wortliste. Quadratisch in der
 * Wortzahl, was hier genuegt: Zitat und Vorschlag sind auf QUOTE_MAX_LENGTH
 * bzw. 500 Zeichen begrenzt, die Tabelle bleibt also klein.
 */
function lcsMatrix(a: string[], b: string[]): number[][] {
  const table: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      const row = table[i];
      if (!row) continue;
      row[j] = a[i] === b[j] ? cell(table, i + 1, j + 1) + 1 : Math.max(cell(table, i + 1, j), cell(table, i, j + 1));
    }
  }
  return table;
}

/** Zugriff mit Rand: ausserhalb der Tabelle ist die Teilfolge leer. */
function cell(table: number[][], i: number, j: number): number {
  return table[i]?.[j] ?? 0;
}

/**
 * Stellt Zitat und Vorschlag gegenueber und markiert je Seite die Woerter, die
 * auf der anderen fehlen. Rein, ohne IO.
 *
 * Beide Saetze kommen vollstaendig zurueck: Die Redaktion soll die Fundstelle
 * im Zusammenhang lesen, nicht nur das ausgetauschte Wort.
 */
export function diffWords(before: string, after: string): WordDiff {
  const beforeTokens = tokenize(before);
  const afterTokens = tokenize(after);

  const beforeWords = beforeTokens.filter((t) => !isSpace(t));
  const afterWords = afterTokens.filter((t) => !isSpace(t));

  const table = lcsMatrix(beforeWords.map(comparable), afterWords.map(comparable));

  const beforeUnchanged = new Set<number>();
  const afterUnchanged = new Set<number>();
  let i = 0;
  let j = 0;
  while (i < beforeWords.length && j < afterWords.length) {
    if (comparable(beforeWords[i] ?? "") === comparable(afterWords[j] ?? "")) {
      beforeUnchanged.add(i);
      afterUnchanged.add(j);
      i++;
      j++;
    } else if (cell(table, i + 1, j) >= cell(table, i, j + 1)) {
      i++;
    } else {
      j++;
    }
  }

  const toSegments = (tokens: string[], unchanged: Set<number>): DiffSegment[] => {
    let wordIndex = 0;
    return tokens.map((token) => {
      if (isSpace(token)) return { text: token, changed: false };
      const changed = !unchanged.has(wordIndex);
      wordIndex++;
      return { text: token, changed };
    });
  };

  return {
    before: toSegments(beforeTokens, beforeUnchanged),
    after: toSegments(afterTokens, afterUnchanged),
  };
}
