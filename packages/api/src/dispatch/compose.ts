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
    ? `es gibt einen Fehler im Artikel „${escapeHtml(input.headline)}“, siehe: <a href="${escapeHtml(input.articleUrl)}" style="color:#1b1f23">${escapeHtml(input.articleUrl)}</a>`
    : `es gibt einen Fehler in diesem Artikel: <a href="${escapeHtml(input.articleUrl)}" style="color:#1b1f23">${escapeHtml(input.articleUrl)}</a>`;

  // Formsprache der Anwendung, uebersetzt in Mail-taugliches HTML: nur
  // Inline-Stile, Tabellen-Wrapper fuer die Lesebreite (Outlook), und nur
  // Schriften, die ueberall liegen -- Georgia vertritt die Didone des
  // Titels auf Windows, Courier New gibt es auf jedem System. Die
  // Papierfarbe ist fest gesetzt, damit Dunkelmodi der Clients das Blatt
  // nicht umfaerben.
  const serif = "font-family:Georgia,'Times New Roman',serif;color:#1b1f23";
  const schreibmaschine = "font-family:'Courier New',Courier,monospace";
  const absatz = `margin:0 0 14px;${serif};font-size:16px;line-height:1.6`;
  const zitat = (inhalt: string, kante: string) =>
    `<div style="border-left:3px solid ${kante};background:#fffffe;border-top:1px solid #dcddd8;border-right:1px solid #dcddd8;border-bottom:1px solid #dcddd8;padding:10px 14px;margin:6px 0 16px;${schreibmaschine};font-size:14px;line-height:1.6;color:#1b1f23">„${inhalt}“</div>`;
  const beschriftung = (text: string) =>
    `<div style="${schreibmaschine};font-size:13px;color:#1b1f23;margin:0 0 2px">${text}</div>`;
  const linie = '<div style="border-top:1px solid #dcddd8;margin:20px 0">&nbsp;</div>';

  const kopf = [
    `<div style="text-align:center;font-family:Didot,'Bodoni 72',Georgia,'Times New Roman',serif;font-size:26px;font-weight:700;letter-spacing:2px;color:#1b1f23">KORREKTU<span style="text-decoration:line-through;text-decoration-color:#a3323b">H</span>REN</div>`,
    `<div style="background:#1b1f23;color:#f7f7f4;${schreibmaschine};font-size:11px;font-weight:700;letter-spacing:2px;text-align:center;padding:5px 8px;margin:10px 0 22px">BLATT ZUR TEXTPFLEGE &bull; UNABHÄNGIG &bull; ÜBERPARTEILICH</div>`,
    `<div style="${schreibmaschine};font-size:12px;font-weight:700;letter-spacing:2px;color:#a3323b;text-transform:uppercase;margin:0 0 4px">Korrektur</div>`,
    input.headline
      ? `<div style="${serif};font-size:21px;font-weight:700;line-height:1.3;margin:0 0 18px">${escapeHtml(input.headline)}</div>`
      : "",
  ];

  const commentHtml = comment
    ? `${beschriftung("Anmerkung:")}<p style="${absatz}">${escapeHtml(comment).replace(/\n/g, "<br>")}</p>`
    : "";

  const inhalt = [
    ...kopf,
    `<p style="${absatz}">Liebe ${escapeHtml(input.outletName)}-Redaktion,</p>`,
    `<p style="${absatz}">${introHtml}</p>`,
    linie,
    beschriftung(`Falsch ist (${escapeHtml(input.errorTypeLabel)}):`),
    zitat(renderSegments(diff.before, COLOR_BEFORE), COLOR_BEFORE),
    beschriftung("Meiner Einschätzung nach wäre richtig:"),
    zitat(renderSegments(diff.after, COLOR_AFTER), COLOR_AFTER),
    linie,
    commentHtml,
    `<p style="${absatz}">Eine Rückmeldung wäre wunderbar.<br>Lassen Sie die Kennung am Ende des Betreffs bitte stehen, damit Ihre Antwort zugeordnet werden kann.</p>`,
    `<p style="${absatz}">Mit freundlichen Grüßen</p>`,
    `<p style="margin:0 0 6px;color:#6b7480;font-size:13px;${serif.replace("#1b1f23", "#6b7480")}">--<br>Diese Textkorrektur wurde über die Web-Anwendung <a href="${escapeHtml(input.baseUrl)}" style="color:#6b7480">${escapeHtml(input.baseUrl)}</a> erstellt und ist ohne Unterschrift gültig.</p>`,
    // Der Block steht in beiden Teilen: welchen ein Mailprogramm beim Antworten
    // zitiert, ist nicht vorhersagbar. Beide tragen denselben Inhalt, ein Parser
    // darf deshalb den ersten Treffer nehmen.
    `<p style="margin:0;color:#6b7480;${schreibmaschine};font-size:12px">Meta-Informationen:<br>${META_OPEN}<br>${escapeHtml(meta)}<br>${META_CLOSE}</p>`,
  ]
    .filter((part) => part.length > 0)
    .join("\n");

  const html = [
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f4"><tr><td align="center" style="padding:26px 12px 34px">',
    '<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px"><tr><td align="left">',
    inhalt,
    "</td></tr></table>",
    "</td></tr></table>",
  ].join("\n");

  return { subject: buildSubject(input), text: lines.join("\n"), html };
}
