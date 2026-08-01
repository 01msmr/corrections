import { z } from "zod";
import { QUOTE_MAX_LENGTH } from "./constants.js";

const nullableTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v.length === 0 ? null : v))
    .nullable()
    .default(null);

/**
 * Eingabe einer neuen Meldung. Kein Autorenfeld — bewusst nicht erhoben (§2.1).
 * `strip` (Zod-Vorgabe) entfernt unbekannte Felder, statt sie durchzureichen.
 */
export const newCorrectionSchema = z.object({
  idempotencyKey: z.string().min(8).max(128),
  articleUrl: z.string().url(),
  headline: nullableTrimmed(300),
  errorTypeKey: z.string().min(1).max(64),
  severity: z.coerce.number().int().min(1).max(3),
  quoteBefore: z.string().trim().min(1).max(QUOTE_MAX_LENGTH),
  suggestionAfter: z.string().trim().min(1).max(500),
  comment: nullableTrimmed(1000),
  recipientEmail: z.string().email().optional(),
});

export type NewCorrectionInput = z.infer<typeof newCorrectionSchema>;

export const outletInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  primaryDomain: z
    .string()
    .trim()
    .min(3)
    .max(253)
    .transform((v) => v.toLowerCase().replace(/^www\./, "")),
  publisher: nullableTrimmed(200),
  country: nullableTrimmed(2),
  notes: nullableTrimmed(2000),
  contactEmails: z.array(z.string().email()).max(10).default([]),
});

export type OutletInputDto = z.infer<typeof outletInputSchema>;

export const errorTypeInputSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9_]+$/, "Nur Kleinbuchstaben, Ziffern und Unterstrich"),
  label: z.string().trim().min(1).max(120),
  description: nullableTrimmed(500),
  sortOrder: z.coerce.number().int().min(0).max(10_000),
});

export type ErrorTypeInputDto = z.infer<typeof errorTypeInputSchema>;

/** Der Schlüssel fehlt bewusst: unveränderlich nach Anlage (§5.0). */
export const errorTypeUpdateSchema = errorTypeInputSchema.omit({ key: true });
