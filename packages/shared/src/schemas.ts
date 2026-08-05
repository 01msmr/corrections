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
  /** Anzahl der Einheiten bei zaehlbaren Kategorien ("2 Zeichen fehlen");
   *  leeres Feld heisst: keine Anzahl. */
  errorCount: z.preprocess(
    (wert) => (wert === "" || wert === undefined || wert === null ? null : wert),
    z.coerce.number().int().min(1).max(999).nullable(),
  ),
  /** Konkretes Satzzeichen bei Satzzeichen-Kategorien ("," / "."). */
  errorChar: z.preprocess(
    (wert) => (wert === "" || wert === undefined || wert === null ? null : wert),
    z.string().max(3).nullable(),
  ),
  // union vor coerce: z.coerce.number() allein wuerde true zu 1 machen und
  // damit als gueltige Schwere durchgehen lassen.
  severity: z.union([z.string(), z.number()]).pipe(z.coerce.number().int().min(1).max(3)),
  quoteBefore: z.string().trim().min(1).max(QUOTE_MAX_LENGTH),
  suggestionAfter: z.string().trim().min(1).max(500),
  comment: nullableTrimmed(1000),
  recipientEmail: z.string().email().optional(),
});

export type NewCorrectionInput = z.infer<typeof newCorrectionSchema>;

// Erst transformieren, dann pruefen: laufen die Laengenpruefungen vorher,
// besteht "www.ab" die Mindestlaenge mit sechs Zeichen und landet danach als
// zweizeichige Domain in der Datenbank. Umgekehrt wuerde eine 250 Zeichen
// lange Domain mit www.-Praefix faelschlich an der Obergrenze scheitern.
//
// Eigene, exportierte Schema-Definition statt eines Inline-Felds in
// outletInputSchema: jeder Ort, an dem eine einzelne Domain entgegengenommen
// wird (z. B. "weitere Domain ergaenzen"), muss dieselbe Regel durchlaufen.
// Eine zweite, abweichende Pruefung ist die Ursache, nicht die Loesung.
export const domainSchema = z
  .string()
  .trim()
  .transform((v) => v.toLowerCase().replace(/^www\./, ""))
  .pipe(z.string().min(3).max(253));

export const outletInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  primaryDomain: domainSchema,
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
});

export type ErrorTypeInputDto = z.infer<typeof errorTypeInputSchema>;

/** Der Schlüssel fehlt bewusst: unveränderlich nach Anlage (§5.0). */
export const errorTypeUpdateSchema = errorTypeInputSchema.omit({ key: true });

/**
 * Die Reihenfolge kommt als kommagetrennte Liste der Ids, wie die ziehbare
 * Tabelle sie nach dem Loslassen einsammelt. Eine Sortiernummer gibt es fuer
 * Nutzer nicht mehr -- sie war der Grund fuer Zwischenwerte wie 21,5.
 */
export const errorTypeOrderSchema = z.object({
  ids: z
    .string()
    .trim()
    .min(1)
    .max(4000)
    .regex(/^[a-z0-9]+(,[a-z0-9]+)*$/, "Reihenfolge unlesbar"),
});
