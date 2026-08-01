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
  const { document } = parseHTML(html);
  const base = document.createElement("base");
  base.setAttribute("href", url);
  document.head?.appendChild(base);

  // linkedom's Document ist strukturell kompatibel zum DOM-`Document`, gegen den
  // @mozilla/readability typisiert ist, aber kein Subtyp davon — daher hier der
  // einzige, minimale Cast an dieser Grenze.
  const article = new Readability(document as unknown as Document).parse();
  if (!article) return null;

  const text = normalizeText(article.textContent ?? "");
  if (text.length === 0) return null;

  const title = article.title ? normalizeText(article.title) : null;
  return { title: title && title.length > 0 ? title : null, text };
}
