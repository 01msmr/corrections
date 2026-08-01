import { rateOrNull } from "@korrektur/shared";
import type { Db } from "../db/client.js";
import { vErrorTypeStats, vOutletStats } from "../db/views.js";

export interface OutletStatRow {
  outletId: string;
  name: string;
  nReports: number;
  nCorrectionBase: number;
  nCorrected: number;
  nReplyBase: number;
  nReplied: number;
  correctionRate: number | null;
  replyRate: number | null;
}

export interface ErrorTypeStatRow {
  errorTypeId: string;
  label: string;
  nReports: number;
  nCorrectionBase: number;
  nCorrected: number;
  correctionRate: number | null;
}

/**
 * Alphabetisch sortiert — die Reihenfolge ist keine Aussage (§2.2).
 * Sortiert wird mit deutscher Collation statt SQLites NOCASE: letzteres kennt
 * nur ASCII und ordnet Umlaute falsch ein.
 */
export function outletStats(db: Db): OutletStatRow[] {
  return db
    .select()
    .from(vOutletStats)
    .all()
    .map((r) => ({
      ...r,
      correctionRate: rateOrNull(r.nCorrected, r.nCorrectionBase),
      replyRate: rateOrNull(r.nReplied, r.nReplyBase),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
}

export function errorTypeStats(db: Db): ErrorTypeStatRow[] {
  return db
    .select()
    .from(vErrorTypeStats)
    .all()
    .map((r) => ({ ...r, correctionRate: rateOrNull(r.nCorrected, r.nCorrectionBase) }))
    .sort((a, b) => a.label.localeCompare(b.label, "de"));
}
