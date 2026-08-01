import { CONFIDENCE_Z, MIN_N_FOR_RATE } from "./constants.js";

/**
 * Wilson-Score-Intervall. Dient als Fehlerbalken gegen Überinterpretation
 * kleiner Unterschiede — ausdrücklich nicht als Ranking-Kriterium (§2.2, §9.4).
 */
export function wilsonInterval(
  successes: number,
  total: number,
): { lower: number; upper: number } {
  if (total <= 0) return { lower: 0, upper: 1 };

  const z = CONFIDENCE_Z;
  const p = successes / total;
  const z2 = z * z;
  const denominator = 1 + z2 / total;
  const centre = p + z2 / (2 * total);
  const margin = z * Math.sqrt((p * (1 - p)) / total + z2 / (4 * total * total));

  return {
    lower: Math.max(0, (centre - margin) / denominator),
    upper: Math.min(1, (centre + margin) / denominator),
  };
}

/** Gibt null zurück, solange die Fallzahl zu klein ist (§9.4). */
export function rateOrNull(successes: number, total: number): number | null {
  if (total < MIN_N_FOR_RATE || total <= 0) return null;
  return successes / total;
}
