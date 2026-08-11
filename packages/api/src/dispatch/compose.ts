import { PALETTE, TILGUNG_STRICH, diffWords, type DiffSegment } from "@korrektur/shared";
/* Reine Funktion; sie lebt bei den Ansichten, weil die Fahne dort entstand. */
import { vergleicheFassungen } from "../views/vergleich.js";

export interface ComposeInput {
  /** Kennung im Betreff; null bei Besucher-Hinweisen — niemand ordnet Antworten zu. */
  ref: string | null;
  /** Text unmittelbar vor der Fundstelle im Artikel (Kontext-Anker, §8.1). */
  quotePrefix?: string | null;
  /** Text unmittelbar dahinter. */
  quoteSuffix?: string | null;
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
const COLOR_BEFORE = PALETTE.korrektur;
const COLOR_AFTER = PALETTE.vorschlag;

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

/** Grenzen der Teilsaetze: Satzzeichen, an denen ein Satzteil endet. */
const TEILSATZ_GRENZE = /[,;.:!?\u2013\u2014]/;

/**
 * Baut die Zitatzeile fuer den HTML-Teil. Die Fehlerstelle traegt Grundfarbe
 * statt Schriftfarbe -- helle Schrift auf Karmin (falsch) bzw. Gruen
 * (richtig), wie ein Textmarker. Der Satzteil **um** die Stelle herum
 * laeuft fett wie die Marke selbst, die uebrigen Teilsaetze nicht: so
 * springt der Blick an die richtige Stelle, und die Marke faellt nicht aus
 * dem Gewicht ihrer Umgebung.
 */
function renderSegments(segments: DiffSegment[], color: string): string {
  /* Zusammenhaengende Laeufe erst buendeln: der Diff liefert wortweise
     Segmente, und jedes einzeln umschlossen ergaebe eine strong-Kette. */
  const laeufe: { changed: boolean; text: string }[] = [];
  for (const s of segments) {
    const letzter = laeufe[laeufe.length - 1];
    if (letzter && letzter.changed === s.changed) letzter.text += s.text;
    else laeufe.push({ changed: s.changed, text: s.text });
  }

  /* Fettzonen bestimmen: der Text zerfaellt an den Satzzeichen in
     Teilsaetze, und fett wird genau der Teilsatz, in dem eine Fehlstelle
     liegt. Ein Komma innerhalb einer Marke ("4,2") teilt zwar auch -- beide
     Haelften beruehren dann die Marke und werden gemeinsam fett. */
  const volltext = laeufe.map((l) => l.text).join("");
  const grenzen = [0];
  for (let i = 0; i < volltext.length; i++) {
    if (TEILSATZ_GRENZE.test(volltext[i] as string)) grenzen.push(i + 1);
  }
  grenzen.push(volltext.length);

  const marken: [number, number][] = [];
  let lauf_ab = 0;
  for (const lauf of laeufe) {
    if (lauf.changed) marken.push([lauf_ab, lauf_ab + lauf.text.length]);
    lauf_ab += lauf.text.length;
  }
  const fett = (von: number, bis: number): boolean =>
    marken.some(([a, b]) => a < bis && b > von);
  const fettzonen: [number, number][] = [];
  for (let g = 0; g + 1 < grenzen.length; g++) {
    const von = grenzen[g] as number;
    const bis = grenzen[g + 1] as number;
    if (fett(von, bis)) {
      const letzte = fettzonen[fettzonen.length - 1];
      if (letzte && letzte[1] === von) letzte[1] = bis;
      else fettzonen.push([von, bis]);
    }
  }
  const istFett = (stelle: number): boolean =>
    fettzonen.some(([a, b]) => stelle >= a && stelle < b);

  const teile: string[] = [];
  let ab = 0;
  for (const lauf of laeufe) {
    if (lauf.changed) {
      teile.push(
        `<span style="background:${color};color:${PALETTE.papier};font-weight:700;padding:1px 4px">${escapeHtml(lauf.text)}</span>`,
      );
    } else {
      /* Der Lauf kann eine Zonengrenze ueberspannen: stueckweise ausgeben. */
      let rest = lauf.text;
      let stelle = ab;
      while (rest.length > 0) {
        const zone = istFett(stelle);
        let laenge = rest.length;
        for (let i = 1; i < rest.length; i++) {
          if (istFett(stelle + i) !== zone) {
            laenge = i;
            break;
          }
        }
        const stueck = escapeHtml(rest.slice(0, laenge));
        teile.push(zone ? `<strong style="font-weight:700">${stueck}</strong>` : stueck);
        rest = rest.slice(laenge);
        stelle += laenge;
      }
    }
    ab += lauf.text.length;
  }
  return teile.join("");
}

function metaLine(input: ComposeInput): string {
  // url steht zuletzt und ist prozentkodiert: ein Semikolon in der Query ist
  // syntaktisch erlaubt und wuerde die Feldtrennung sonst zerreissen.
  // Ohne Kennung (Besucher-Hinweis) entfaellt das ref-Feld.
  const refTeil = input.ref ? `ref=${input.ref}; ` : "";
  return `v=2; ${refTeil}typ=${input.errorTypeKey}; sev=${input.severity}; url=${encodeURIComponent(input.articleUrlCanon)}`;
}

function buildSubject(input: ComposeInput): string {
  // Der Token muss immer ans Ende passen, unabhaengig von der Laenge der
  // Ueberschrift — deshalb wird gegen ein Budget gekuerzt. Ohne Kennung
  // (Besucher-Hinweis: niemand ordnet Antworten zu) entfaellt er.
  const tokenPart = input.ref ? ` [${input.ref}]` : "";
  if (!input.headline) return `${SUBJECT_PREFIX}${tokenPart}`;
  const budget = SUBJECT_MAX - SUBJECT_PREFIX.length - 2 - tokenPart.length;
  return `${SUBJECT_PREFIX}: ${truncate(input.headline, budget)}${tokenPart}`;
}

/**
 * Die Fundstelle im Satzzusammenhang. Die Anker stehen ohnehin schon fest
 * (§8.1) — sie hier zu zeigen erspart der Redaktion die Suche nach einem
 * isolierten Zitat. Fehlt ein Anker, entfaellt die Zeile ersatzlos.
 */
function fundstelleText(input: ComposeInput, quote: string): string[] {
  /* Die Leerzeichen an den Raendern gehoeren zum Satz — nur fuer die Frage,
     ob ueberhaupt ein Anker vorliegt, wird getrimmt. */
  const vor = input.quotePrefix ?? "";
  const nach = input.quoteSuffix ?? "";
  if (!vor.trim() && !nach.trim()) return [];
  return [
    "Im Artikel steht die Stelle hier:",
    "",
    `${QUOTE_INDENT}…${vor}»${quote}«${nach}…`,
    "",
  ];
}

function fundstelleHtml(
  input: ComposeInput,
  quote: string,
  beschriftung: (text: string) => string,
  schreibmaschine: string,
): string {
  const vor = input.quotePrefix ?? "";
  const nach = input.quoteSuffix ?? "";
  if (!vor.trim() && !nach.trim()) return "";
  const markiert = `<strong style="background:${COLOR_BEFORE};color:${PALETTE.papier};padding:1px 4px">${escapeHtml(quote)}</strong>`;
  return (
    beschriftung("Im Artikel steht die Stelle hier:") +
    `<div style="${schreibmaschine};font-size:13px;line-height:1.7;color:${PALETTE.rand};margin:0 0 16px">` +
    `…${escapeHtml(vor)}${markiert}${escapeHtml(nach)}…</div>`
  );
}

/** Rein. Baut Betreff und beide Koerper; Header und Versand liegen in send.ts (§6). */
export function composeMail(input: ComposeInput): { subject: string; text: string; html: string } {
  const quote = neutralizeMetaMarkers(input.quoteBefore);
  const suggestion = neutralizeMetaMarkers(input.suggestionAfter);
  const comment = input.comment?.trim() ? neutralizeMetaMarkers(input.comment.trim()) : null;
  const diff = diffWords(quote, suggestion);
  const meta = metaLine(input);

  const intro = input.headline
    ? ["es gibt einen Fehler im Artikel", `„${input.headline}“,`, "siehe:", input.articleUrl]
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
    ...fundstelleText(input, quote),
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
    ...(input.ref
      ? ["Lassen Sie die Kennung am Ende des Betreffs bitte stehen, damit Ihre", "Antwort zugeordnet werden kann."]
      : []),
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
    ? `es gibt einen Fehler im Artikel „${escapeHtml(input.headline)}“, siehe:<br><a href="${escapeHtml(input.articleUrl)}" style="color:${PALETTE.tinte}">${escapeHtml(input.articleUrl)}</a>`
    : `es gibt einen Fehler in diesem Artikel:<br><a href="${escapeHtml(input.articleUrl)}" style="color:${PALETTE.tinte}">${escapeHtml(input.articleUrl)}</a>`;

  // Formsprache der Anwendung, uebersetzt in Mail-taugliches HTML: nur
  // Inline-Stile, Tabellen-Wrapper fuer die Lesebreite (Outlook), und nur
  // Schriften, die ueberall liegen -- Georgia vertritt die Didone des
  // Titels auf Windows, Courier New gibt es auf jedem System. Die
  // Papierfarbe ist fest gesetzt, damit Dunkelmodi der Clients das Blatt
  // nicht umfaerben.
  const serif = `font-family:Georgia,'Times New Roman',serif;color:${PALETTE.tinte}`;
  const schreibmaschine = "font-family:'Courier New',Courier,monospace";
  const absatz = `margin:0 0 14px;${serif};font-size:16px;line-height:1.6`;
  const zitat = (inhalt: string, kante: string) =>
    `<div style="border-left:3px solid ${kante};background:${PALETTE.feld};border-top:1px solid ${PALETTE.linie};border-right:1px solid ${PALETTE.linie};border-bottom:1px solid ${PALETTE.linie};padding:10px 14px;margin:6px 0 16px;${schreibmaschine};font-size:14px;line-height:1.6;color:${PALETTE.tinte}">„${inhalt}“</div>`;
  const beschriftung = (text: string) =>
    `<div style="${schreibmaschine};font-size:13px;color:${PALETTE.tinte};margin:0 0 2px">${text}</div>`;
  const linie = `<div style="border-top:1px solid ${PALETTE.linie};margin:20px 0">&nbsp;</div>`;

  /* Die Wortmarke traegt den Filzstiftstrich des Titels (TILGUNG_STRICH,
     eine Quelle fuer Kopf, Mail und Icons). Als data-URI-Hintergrund: Apple
     Mail, Outlook (macOS) und Thunderbird zeigen ihn; Gmail und Outlook
     (Windows) verwerfen data-URIs, dort steht das H ungestrichen -- der
     Text darunter erklaert das Blatt ohnehin. Ein line-through als
     Rueckfall schiede aus: wo beides laeuft, staenden zwei Striche. */
  const kopf = [
    `<div style="text-align:center;font-family:Didot,'Bodoni 72',Georgia,'Times New Roman',serif;font-size:26px;font-weight:700;letter-spacing:2px;color:${PALETTE.tinte}">KORREKTU<span style="background:url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 ${TILGUNG_STRICH.breite} ${TILGUNG_STRICH.hoehe}%22 preserveAspectRatio=%22none%22%3E%3Cpath d=%22${TILGUNG_STRICH.pfad}%22 fill=%22${PALETTE.korrektur.replace("#", "%23")}%22/%3E%3C/svg%3E') center/100% 100% no-repeat;padding:2px 5px;margin:-2px -5px">H</span>REN</div>`,
    `<div style="background:${PALETTE.tinte};color:${PALETTE.papier};${schreibmaschine};font-size:11px;font-weight:700;letter-spacing:2px;text-align:center;padding:5px 8px;margin:10px 0 22px">BLATT ZUR TEXTPFLEGE &bull; UNABHÄNGIG &bull; ÜBERPARTEILICH</div>`,
    `<div style="${schreibmaschine};font-size:12px;font-weight:700;letter-spacing:2px;color:${PALETTE.korrektur};text-transform:uppercase;margin:0 0 4px">Korrektur</div>`,
    input.headline
      ? `<div style="${serif};font-size:21px;font-weight:700;line-height:1.3;margin:0 0 18px">${escapeHtml(input.headline)}</div>`
      : "",
  ];

  /* Die Korrekturfahne wie in der Vorschau: getilgt in Karmin
     durchgestrichen, eingesetzt in Gruen unterstrichen -- der kompakte
     Blick auf den Unterschied, bevor die beiden Fassungen folgen. */
  const fahneHtml = (() => {
    const stuecke = vergleicheFassungen(quote, suggestion);
    if (!stuecke.some((st) => st.art !== "gleich")) return "";
    const zeile = stuecke
      .map((st) => {
        const inhalt = escapeHtml(st.text);
        if (st.art === "getilgt")
          return `<del style="color:${COLOR_BEFORE};text-decoration:line-through">${inhalt}</del>`;
        if (st.art === "eingefuegt")
          return `<ins style="color:${COLOR_AFTER};text-decoration:underline">${inhalt}</ins>`;
        return inhalt;
      })
      .join(" ");
    return (
      beschriftung("Korrekturfahne:") +
      `<div style="${schreibmaschine};font-size:14px;line-height:1.7;margin:0 0 16px">${zeile}</div>`
    );
  })();

  const commentHtml = comment
    ? `${beschriftung("Anmerkung:")}<p style="${absatz}">${escapeHtml(comment).replace(/\n/g, "<br>")}</p>`
    : "";

  const inhalt = [
    ...kopf,
    `<p style="${absatz}">Liebe ${escapeHtml(input.outletName)}-Redaktion,</p>`,
    `<p style="${absatz}">${introHtml}</p>`,
    linie,
    fahneHtml,
    beschriftung(`Falsch ist (${escapeHtml(input.errorTypeLabel)}):`),
    zitat(renderSegments(diff.before, COLOR_BEFORE), COLOR_BEFORE),
    fundstelleHtml(input, quote, beschriftung, schreibmaschine),
    beschriftung("Meiner Einschätzung nach wäre richtig:"),
    zitat(renderSegments(diff.after, COLOR_AFTER), COLOR_AFTER),
    linie,
    commentHtml,
    `<p style="${absatz}">Eine Rückmeldung wäre wunderbar.${input.ref ? "<br>Lassen Sie die Kennung am Ende des Betreffs bitte stehen, damit Ihre Antwort zugeordnet werden kann." : ""}</p>`,
    `<p style="${absatz}">Mit freundlichen Grüßen</p>`,
    `<p style="margin:0 0 6px;color:${PALETTE.rand};font-size:13px;${serif.replace(PALETTE.tinte, PALETTE.rand)}">--<br>Diese Textkorrektur wurde über die Web-Anwendung <a href="${escapeHtml(input.baseUrl)}" style="color:${PALETTE.rand}">${escapeHtml(input.baseUrl)}</a> erstellt und ist ohne Unterschrift gültig.</p>`,
    // Der Block steht in beiden Teilen: welchen ein Mailprogramm beim Antworten
    // zitiert, ist nicht vorhersagbar. Beide tragen denselben Inhalt, ein Parser
    // darf deshalb den ersten Treffer nehmen.
    `<p style="margin:0;color:${PALETTE.rand};${schreibmaschine};font-size:12px">Meta-Informationen:<br>${META_OPEN}<br>${escapeHtml(meta)}<br>${META_CLOSE}</p>`,
  ]
    .filter((part) => part.length > 0)
    .join("\n");

  const html = [
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PALETTE.papier}"><tr><td align="center" style="padding:26px 12px 34px">`,
    '<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px"><tr><td align="left">',
    inhalt,
    "</td></tr></table>",
    "</td></tr></table>",
  ].join("\n");

  return { subject: buildSubject(input), text: lines.join("\n"), html };
}
