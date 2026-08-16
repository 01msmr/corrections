import {
  CONFIDENCE_Z,
  MATURITY_DAYS,
  MATURITY_SECONDS,
  MIN_N_FOR_RATE,
} from "./constants.js";

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

/**
 * Warum eine Meldung in der Korrekturquote zaehlt -- oder nicht. Dieselben
 * Bedingungen wie die Kennzahlen-View, nur einzeln benannt: Der Ausgang kann
 * gesetzt sein und die Zahl sich trotzdem nicht bewegen, und ohne diese
 * Auskunft ist das von aussen nicht zu sehen.
 */
export interface QuotenAngaben {
  dispatchStatus: string;
  sentAt: number | null;
  correctedAt: number | null;
  verification: string;
  /** Zustand der juengsten Artikel-Pruefung, null wenn keine gelaufen ist. */
  letzterBefund: string | null;
}

export type Quotenlage =
  | { zaehlt: true }
  | { zaehlt: false; grund: string };

export function quotenlage(angaben: QuotenAngaben, jetzt: number): Quotenlage {
  if (angaben.dispatchStatus !== "sent" || angaben.sentAt === null) {
    return { zaehlt: false, grund: "nicht versendet" };
  }
  if (angaben.sentAt > jetzt - MATURITY_SECONDS) {
    return { zaehlt: false, grund: `noch keine ${MATURITY_DAYS} Tage her (§9.3)` };
  }
  if (angaben.correctedAt === null) {
    return { zaehlt: false, grund: "kein Korrekturdatum gesetzt" };
  }
  if (angaben.verification !== "manual") {
    return { zaehlt: false, grund: "nicht von Hand bestaetigt" };
  }
  return { zaehlt: true };
}
