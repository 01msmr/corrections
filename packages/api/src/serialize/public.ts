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
  /** Kanonisierte URL (`articleUrlCanon`) — die rohe Eingabe kann Tracking-Parameter
   *  oder personalisierte Tokens (z. B. Gift-Article-Links) enthalten. */
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
    articleUrl: row.articleUrlCanon,
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
  "rawMessageId",
  "raw_message_id",
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

type VerboteneFeldnamen = (typeof FORBIDDEN_PUBLIC_FIELDS)[number];

/** `true`, wenn der Typ keinen verbotenen Feldnamen deklariert — sonst `never`. */
type OhneVerbotenerFelder<T> = Extract<keyof T, VerboteneFeldnamen> extends never
  ? true
  : never;

/**
 * Prüfung zur Übersetzungszeit, nicht zur Laufzeit. `assertNoForbiddenFields`
 * sieht nur, was tatsächlich in einem Objekt steht — ein verbotenes Feld, das
 * jemand deklariert, aber nie befüllt, käme durch jeden Laufzeittest. Diese
 * Zeile lässt stattdessen `tsc` fehlschlagen, sobald der Name überhaupt im Typ
 * auftaucht. Exportiert, damit sie nicht als ungenutzt entfernt wird.
 */
export const PUBLIC_TYPEN_SIND_SAUBER: [
  OhneVerbotenerFelder<PublicCorrection>,
  OhneVerbotenerFelder<PublicOutlet>,
] = [true, true];

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
