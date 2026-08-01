export interface ComposeInput {
  ref: string;
  articleUrl: string;
  articleUrlCanon: string;
  headline: string | null;
  errorTypeKey: string;
  errorTypeLabel: string;
  severity: 1 | 2 | 3;
  quoteBefore: string;
  suggestionAfter: string;
  comment: string | null;
  baseUrl: string;
}

const HEADLINE_MAX = 60;

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}

/** Rein. Baut Betreff und Textkörper; Header und Versand liegen in send.ts (§6). */
export function composeMail(input: ComposeInput): { subject: string; text: string } {
  const headlinePart = input.headline
    ? ` in "${truncate(input.headline, HEADLINE_MAX)}"`
    : "";
  const subject = `Korrekturhinweis: ${input.errorTypeLabel}${headlinePart} [${input.ref}]`;

  const lines = [
    "Sehr geehrte Redaktion,",
    "",
    "in folgendem Artikel ist mir eine Stelle aufgefallen, die nicht zutrifft:",
    input.articleUrl,
    "",
    `Art des Fehlers: ${input.errorTypeLabel}`,
    "",
    "Im Text steht:",
    input.quoteBefore,
    "",
    "Zutreffend wäre:",
    input.suggestionAfter,
  ];

  if (input.comment && input.comment.trim().length > 0) {
    lines.push("", `Anmerkung: ${input.comment.trim()}`);
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
    "[korrektur-meta]",
    `v=2; ref=${input.ref}; url=${input.articleUrlCanon}; typ=${input.errorTypeKey}; sev=${input.severity}`,
    "[/korrektur-meta]",
  );

  return { subject, text: lines.join("\n") };
}
