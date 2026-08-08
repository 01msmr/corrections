import { z } from "zod";
import { ordneAlleZu, type Fund } from "./zuordnung.js";

/**
 * Netzabruf gegen LanguageTool (Spec 2026-08-08). IO-Schicht — die
 * Zuordnung daneben ist rein.
 *
 * Grundsatz: **Ein Ausfall ist kein Fehler.** Ist der Dienst nicht
 * erreichbar, zu langsam oder antwortet er unlesbar, kommen keine
 * Vorschlaege zurueck und das Formular arbeitet unveraendert weiter. Die
 * Pruefung ist eine Hilfe, keine Voraussetzung.
 */

const antwortSchema = z.object({
  matches: z.array(
    z.object({
      message: z.string(),
      offset: z.number().int().nonnegative(),
      length: z.number().int().positive(),
      replacements: z.array(z.object({ value: z.string() })),
      rule: z.object({
        id: z.string(),
        issueType: z.string(),
        category: z.object({ id: z.string() }),
      }),
    }),
  ),
  /* Satzgrenzen im eingereichten Text; ohne sie faellt die Zuordnung auf
     den ganzen Text zurueck. */
  sentenceRanges: z.array(z.tuple([z.number(), z.number()])).optional(),
});

/** Laenge, ab der die oeffentliche API abweist (20 KB je Anfrage). */
const TEXT_GRENZE = 18_000;
const ZEIT_GRENZE_MS = 8_000;

export interface PruefDeps {
  url: string;
  sprache: string;
}

/**
 * Schickt den Artikeltext zur Pruefung und gibt die zugeordneten Funde
 * zurueck — harte zuerst, Stil danach. Bei jedem Problem: leere Liste.
 */
export async function pruefeText(text: string, deps: PruefDeps): Promise<Fund[]> {
  const gekuerzt = text.slice(0, TEXT_GRENZE);
  if (gekuerzt.trim().length === 0) return [];

  const abbruch = AbortSignal.timeout(ZEIT_GRENZE_MS);
  try {
    const antwort = await fetch(deps.url, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ text: gekuerzt, language: deps.sprache }),
      signal: abbruch,
    });
    if (!antwort.ok) return [];

    const gelesen = antwortSchema.safeParse(await antwort.json());
    if (!gelesen.success) return [];

    const bereiche: [number, number][] = (gelesen.data.sentenceRanges ?? []).map(
      ([von, bis]) => [von, bis],
    );
    return ordneAlleZu(gelesen.data.matches, gekuerzt, bereiche);
  } catch {
    /* Netzfehler, Zeitueberschreitung, unlesbare Antwort — ohne Vorschlaege
       weiter. */
    return [];
  }
}
