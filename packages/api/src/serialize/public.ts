import type { corrections } from "../db/schema.js";
import type { OutletRecord } from "../repo/outlets.js";

type CorrectionRow = typeof corrections.$inferSelect;

/**
 * Öffentliche Sicht auf eine Meldung. Besitzt die kritischen Felder nicht —
 * es wird nichts zur Laufzeit herausgefiltert (§2.1).
 */
export interface PublicCorrection {
  ref: string;
  createdAt: number;
  sentAt: number | null;
  outletName: string;
  errorTypeLabel: string;
  severity: number;
  articleUrl: string;
  headline: string | null;
  quoteBefore: string;
  suggestionAfter: string;
  outcome: CorrectionRow["outcome"];
  correctedAt: number | null;
}

export interface PublicOutlet {
  name: string;
  publisher: string | null;
  country: string | null;
}

export function toPublicCorrection(
  row: CorrectionRow,
  outletName: string,
  errorTypeLabel: string,
): PublicCorrection {
  return {
    ref: row.ref,
    createdAt: row.createdAt,
    sentAt: row.sentAt,
    outletName,
    errorTypeLabel,
    severity: row.severity,
    articleUrl: row.articleUrl,
    headline: row.headline,
    quoteBefore: row.quoteBefore,
    suggestionAfter: row.suggestionAfter,
    outcome: row.outcome,
    correctedAt: row.correctedAt,
  };
}

export function toPublicOutlet(outlet: OutletRecord): PublicOutlet {
  return { name: outlet.name, publisher: outlet.publisher, country: outlet.country };
}

/** Feldnamen, die in keiner öffentlichen Antwort auftauchen dürfen (§2.1, §12, §13). */
export const FORBIDDEN_PUBLIC_FIELDS = [
  "author",
  "authorName",
  "author_name",
  "contactEmails",
  "contact_emails",
  "excerpt",
  "fromAddr",
  "from_addr",
  "idempotencyKey",
  "idempotency_key",
  "messageId",
  "message_id",
  "notes",
  "observedText",
  "observed_text",
  "quotePrefix",
  "quoteSuffix",
  "quote_prefix",
  "quote_suffix",
  "recipientEmail",
  "recipient_email",
] as const;

const FORBIDDEN = new Set<string>(FORBIDDEN_PUBLIC_FIELDS);

/** Wächter: prüft rekursiv, auch in Listen und verschachtelten Objekten. */
export function assertNoForbiddenFields(value: unknown, path = "$"): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoForbiddenFields(entry, `${path}[${index}]`));
    return;
  }
  if (value === null || typeof value !== "object") return;

  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN.has(key)) {
      throw new Error(`Verbotenes Feld in oeffentlicher Antwort: ${path}.${key}`);
    }
    assertNoForbiddenFields(nested, `${path}.${key}`);
  }
}
