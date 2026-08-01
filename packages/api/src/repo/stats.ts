import { rateOrNull } from "@korrektur/shared";
import type { Db } from "../db/client.js";

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

interface RawOutletRow {
  outlet_id: string;
  name: string;
  n_reports: number;
  n_correction_base: number;
  n_corrected: number;
  n_reply_base: number;
  n_replied: number;
}

interface RawErrorTypeRow {
  error_type_id: string;
  label: string;
  n_reports: number;
  n_correction_base: number;
  n_corrected: number;
}

/** Alphabetisch sortiert — die Reihenfolge ist keine Aussage (§2.2). */
export function outletStats(db: Db): OutletStatRow[] {
  const rows = db.$client
    .prepare("SELECT * FROM v_outlet_stats ORDER BY name COLLATE NOCASE")
    .all() as unknown as RawOutletRow[];

  return rows.map((r) => ({
    outletId: r.outlet_id,
    name: r.name,
    nReports: r.n_reports,
    nCorrectionBase: r.n_correction_base,
    nCorrected: r.n_corrected,
    nReplyBase: r.n_reply_base,
    nReplied: r.n_replied,
    correctionRate: rateOrNull(r.n_corrected, r.n_correction_base),
    replyRate: rateOrNull(r.n_replied, r.n_reply_base),
  }));
}

export function errorTypeStats(db: Db): ErrorTypeStatRow[] {
  const rows = db.$client
    .prepare("SELECT * FROM v_error_type_stats ORDER BY label COLLATE NOCASE")
    .all() as unknown as RawErrorTypeRow[];

  return rows.map((r) => ({
    errorTypeId: r.error_type_id,
    label: r.label,
    nReports: r.n_reports,
    nCorrectionBase: r.n_correction_base,
    nCorrected: r.n_corrected,
    correctionRate: rateOrNull(r.n_corrected, r.n_correction_base),
  }));
}
