import { Readability } from "@mozilla/readability";
import { normalizeText } from "@korrektur/shared";
import { parseHTML } from "linkedom";

/**
 * Rein: nimmt HTML entgegen, greift nicht aufs Netz zu.
 * Autorenangaben werden bewusst nicht ausgelesen (§2.1).
 */
export function extractArticle(
  html: string,
  url: string,
): { title: string | null; text: string } | null {
  try {
    const { document } = parseHTML(html);

    // Ohne Wurzelelement wirft linkedom schon beim Lesen von document.head —
    // Optional Chaining hilft dort nicht, die Pruefung muss vorher stehen.
    if (!document.documentElement) return null;

    const base = document.createElement("base");
    base.setAttribute("href", url);
    document.head?.appendChild(base);

    // linkedom's Document ist strukturell kompatibel zum DOM-`Document`, gegen den
    // @mozilla/readability typisiert ist, aber kein Subtyp davon — daher hier der
    // einzige, minimale Cast an dieser Grenze.
    const article = new Readability(document as unknown as Document).parse();
    if (!article) return null;

    const text = baueText(article.content ?? "") || normalizeText(article.textContent ?? "");
    if (text.length === 0) return null;

    const title = article.title ? normalizeText(article.title) : null;
    return { title: title && title.length > 0 ? title : null, text };
  } catch {
    // Das HTML stammt von fremden Servern. Parser und Readability duerfen an
    // kaputtem Markup scheitern; der Aufrufer bekommt dann null statt einer
    // Ausnahme, die einen ganzen Request abbrechen wuerde.
    return null;
  }
}

/**
 * Baut den Fliesstext aus dem aufbereiteten HTML — Block fuer Block, mit
 * Leerzeile dazwischen.
 *
 * Noetig, weil `textContent` Blockelemente ohne Trennzeichen aneinanderhaengt:
 * Aus einer Zwischenueberschrift und dem folgenden Absatz wird dann
 * "unproblematischEine", aus Bildnachweis und Textanfang "Getty Images Wer".
 * Eine Rechtschreibpruefung meldet solche Stellen zu Recht — nur stehen sie
 * so nicht im Artikel. Bildstrecken und Nachweise fallen ganz weg; sie
 * gehoeren nicht zum Text, den eine Redaktion korrigieren wuerde.
 */
function baueText(inhalt: string): string {
  if (inhalt.length === 0) return "";
  /* linkedom fuellt <body> nur, wenn ein <html> drumherum steht — ohne das
     bleibt der Koerper leer und die Bloecke faenden sich nie. */
  const { document } = parseHTML(`<html><body>${inhalt}</body></html>`);
  const koerper = document.body;
  if (!koerper) return "";

  for (const beiwerk of koerper.querySelectorAll("figure, figcaption, aside, table")) {
    beiwerk.remove();
  }

  const bloecke: string[] = [];
  for (const block of koerper.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li, blockquote, pre")) {
    const zeile = normalizeText(block.textContent ?? "");
    /* Verschachtelte Bloecke (li in ul in div) wuerden sich sonst doppeln. */
    if (zeile.length > 0 && !bloecke.includes(zeile)) bloecke.push(zeile);
  }
  return bloecke.join("\n\n");
}
