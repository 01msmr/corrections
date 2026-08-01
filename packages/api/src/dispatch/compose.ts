export interface ComposeInput {
  ref: string;
  articleUrl: string;
  articleUrlCanon: string;
  headline: string | null;
  errorTypeKey: string;
  errorTypeLabel: string;
  // Zod bindet 1..3 bereits an der Quelle (newCorrectionSchema); hier reicht number,
  // damit corrections.ts den Wert ohne "as"-Cast durchreichen kann (Projektregel:
  // kein `as` ausserhalb von Typwaechtern).
  severity: number;
  quoteBefore: string;
  suggestionAfter: string;
  comment: string | null;
  baseUrl: string;
}

/** Obergrenze fuer den Betreff ohne den angehaengten Token. */
const SUBJECT_MAX = 120;
const SUBJECT_PREFIX = "Korrekturhinweis: ";
const META_OPEN = "[korrektur-meta]";
const META_CLOSE = "[/korrektur-meta]";

function truncate(value: string, max: number): string {
  if (max <= 0) return "";
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Nutzertext darf die Marker des Meta-Blocks nicht enthalten, sonst faende ein
 * Parser spaeter zwei Bloecke und griffe den falschen ab.
 */
function neutralizeMetaMarkers(value: string): string {
  return value.split(META_OPEN).join("(korrektur-meta)").split(META_CLOSE).join("(/korrektur-meta)");
}

/** Rein. Baut Betreff und Textkörper; Header und Versand liegen in send.ts (§6). */
export function composeMail(input: ComposeInput): { subject: string; text: string } {
  // Der Token muss immer ans Ende passen, unabhaengig davon wie lang die
  // Fehlerart-Bezeichnung ist — die ist ueber das Adminformular frei setzbar.
  // Deshalb wird der gesamte mittlere Teil gegen ein Budget gekuerzt, nicht
  // nur die Ueberschrift.
  const tokenPart = ` [${input.ref}]`;
  const headlinePart = input.headline ? ` in "${input.headline}"` : "";
  const budget = SUBJECT_MAX - SUBJECT_PREFIX.length - tokenPart.length;
  const middle = truncate(`${input.errorTypeLabel}${headlinePart}`, budget);
  const subject = `${SUBJECT_PREFIX}${middle}${tokenPart}`;

  const lines = [
    "Sehr geehrte Redaktion,",
    "",
    "in folgendem Artikel ist mir eine Stelle aufgefallen, die nicht zutrifft:",
    input.articleUrl,
    "",
    `Art des Fehlers: ${input.errorTypeLabel}`,
    "",
    "Im Text steht:",
    neutralizeMetaMarkers(input.quoteBefore),
    "",
    "Zutreffend wäre:",
    neutralizeMetaMarkers(input.suggestionAfter),
  ];

  if (input.comment && input.comment.trim().length > 0) {
    lines.push("", `Anmerkung: ${neutralizeMetaMarkers(input.comment.trim())}`);
  }

  lines.push(
    "",
    "Über eine kurze Rückmeldung würde ich mich freuen. Bitte lassen Sie das",
    "Kennzeichen am Ende des Betreffs stehen, damit ich Ihre Antwort zuordnen kann.",
    "",
    "Mit freundlichen Grüßen",
    "",
    "--",
    `Diese Meldung wurde über ${input.baseUrl} erstellt.`,
    META_OPEN,
    // url steht zuletzt und ist prozentkodiert: ein Semikolon in der Query ist
    // syntaktisch erlaubt und wuerde die Feldtrennung sonst zerreissen.
    `v=2; ref=${input.ref}; typ=${input.errorTypeKey}; sev=${input.severity}; url=${encodeURIComponent(input.articleUrlCanon)}`,
    META_CLOSE,
  );

  return { subject, text: lines.join("\n") };
}
