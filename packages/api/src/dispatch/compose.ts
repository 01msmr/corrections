import { diffWords, type DiffSegment } from "@korrektur/shared";

export interface ComposeInput {
  ref: string;
  /** Fuer die Anrede „Liebe <Name>-Redaktion“. */
  outletName: string;
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
const SUBJECT_PREFIX = "Textfehler im Artikel";
const META_OPEN = "[korrektur-meta]";
const META_CLOSE = "[/korrektur-meta]";
const RULE = "________ ________ ________";
const QUOTE_INDENT = "    ";

/**
 * Rot fuer die Fundstelle, Gruen fuer den Vorschlag — zusaetzlich fett, nie
 * allein ueber die Farbe: Rot-Gruen-Schwaeche ist die haeufigste Form der
 * Farbfehlsichtigkeit, und der Textteil kennt ohnehin keine Farbe.
 */
const COLOR_BEFORE = "#a3323b";
const COLOR_AFTER = "#2f6f4e";

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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Baut die Zitatzeile fuer den HTML-Teil; abweichende Woerter farbig und fett. */
function renderSegments(segments: DiffSegment[], color: string): string {
  return segments
    .map((s) =>
      s.changed
        ? `<span style="color:${color};font-weight:700">${escapeHtml(s.text)}</span>`
        : escapeHtml(s.text),
    )
    .join("");
}

function metaLine(input: ComposeInput): string {
  // url steht zuletzt und ist prozentkodiert: ein Semikolon in der Query ist
  // syntaktisch erlaubt und wuerde die Feldtrennung sonst zerreissen.
  return `v=2; ref=${input.ref}; typ=${input.errorTypeKey}; sev=${input.severity}; url=${encodeURIComponent(input.articleUrlCanon)}`;
}

function buildSubject(input: ComposeInput): string {
  // Der Token muss immer ans Ende passen, unabhaengig von der Laenge der
  // Ueberschrift — deshalb wird gegen ein Budget gekuerzt.
  const tokenPart = ` [${input.ref}]`;
  if (!input.headline) return `${SUBJECT_PREFIX}${tokenPart}`;
  const budget = SUBJECT_MAX - SUBJECT_PREFIX.length - 2 - tokenPart.length;
  return `${SUBJECT_PREFIX}: ${truncate(input.headline, budget)}${tokenPart}`;
}

/** Rein. Baut Betreff und beide Koerper; Header und Versand liegen in send.ts (§6). */
export function composeMail(input: ComposeInput): { subject: string; text: string; html: string } {
  const quote = neutralizeMetaMarkers(input.quoteBefore);
  const suggestion = neutralizeMetaMarkers(input.suggestionAfter);
  const comment = input.comment?.trim() ? neutralizeMetaMarkers(input.comment.trim()) : null;
  const diff = diffWords(quote, suggestion);
  const meta = metaLine(input);

  const intro = input.headline
    ? ["es gibt einen Fehler im Artikel", `„${input.headline}“,`, `siehe: ${input.articleUrl}`]
    : ["es gibt einen Fehler in diesem Artikel:", input.articleUrl];

  const lines = [
    `Liebe ${input.outletName}-Redaktion,`,
    "",
    ...intro,
    "",
    RULE,
    "",
    `Falsch ist (${input.errorTypeLabel}):`,
    "",
    `${QUOTE_INDENT}„${quote}“`,
    "",
    "Meiner Einschätzung nach wäre richtig:",
    "",
    `${QUOTE_INDENT}„${suggestion}“`,
    "",
    RULE,
    "",
  ];

  if (comment) {
    lines.push("Anmerkung:", comment, "");
  }

  lines.push(
    "Eine Rückmeldung wäre wunderbar.",
    "Lassen Sie die Kennung am Ende des Betreffs bitte stehen, damit Ihre",
    "Antwort zugeordnet werden kann.",
    "",
    "Mit freundlichen Grüßen",
    "",
    "--",
    `Diese Textkorrektur wurde über die Web-Anwendung ${input.baseUrl} erstellt`,
    "und ist ohne Unterschrift gültig.",
    "",
    "Meta-Informationen:",
    META_OPEN,
    meta,
    META_CLOSE,
  );

  const introHtml = input.headline
    ? `es gibt einen Fehler im Artikel<br>„${escapeHtml(input.headline)}“,<br>siehe: <a href="${escapeHtml(input.articleUrl)}">${escapeHtml(input.articleUrl)}</a>`
    : `es gibt einen Fehler in diesem Artikel:<br><a href="${escapeHtml(input.articleUrl)}">${escapeHtml(input.articleUrl)}</a>`;

  const commentHtml = comment
    ? `<p>Anmerkung:<br>${escapeHtml(comment).replace(/\n/g, "<br>")}</p>`
    : "";

  // Inline-Stile statt Stylesheet: Mailprogramme entfernen <style> haeufig.
  const html = [
    '<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.5;color:#1b1f23">',
    `<p>Liebe ${escapeHtml(input.outletName)}-Redaktion,</p>`,
    `<p>${introHtml}</p>`,
    '<hr style="border:none;border-top:1px solid #dcddd8;margin:20px 0">',
    `<p>Falsch ist (${escapeHtml(input.errorTypeLabel)}):</p>`,
    `<p style="margin-left:24px">„${renderSegments(diff.before, COLOR_BEFORE)}“</p>`,
    "<p>Meiner Einschätzung nach wäre richtig:</p>",
    `<p style="margin-left:24px">„${renderSegments(diff.after, COLOR_AFTER)}“</p>`,
    '<hr style="border:none;border-top:1px solid #dcddd8;margin:20px 0">',
    commentHtml,
    "<p>Eine Rückmeldung wäre wunderbar.<br>Lassen Sie die Kennung am Ende des Betreffs bitte stehen, damit Ihre Antwort zugeordnet werden kann.</p>",
    "<p>Mit freundlichen Grüßen</p>",
    '<p style="color:#6b7480;font-size:13px">--<br>',
    `Diese Textkorrektur wurde über die Web-Anwendung <a href="${escapeHtml(input.baseUrl)}">${escapeHtml(input.baseUrl)}</a> erstellt und ist ohne Unterschrift gültig.</p>`,
    // Der Block steht in beiden Teilen: welchen ein Mailprogramm beim Antworten
    // zitiert, ist nicht vorhersagbar. Beide tragen denselben Inhalt, ein Parser
    // darf deshalb den ersten Treffer nehmen.
    `<p style="color:#6b7480;font-size:13px">Meta-Informationen:<br>${META_OPEN}<br>${escapeHtml(meta)}<br>${META_CLOSE}</p>`,
    "</div>",
  ]
    .filter((part) => part.length > 0)
    .join("\n");

  return { subject: buildSubject(input), text: lines.join("\n"), html };
}
