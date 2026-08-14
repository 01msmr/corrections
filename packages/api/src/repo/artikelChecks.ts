import { createId } from "@paralleldrive/cuid2";
import { sql } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { articleChecks } from "../db/schema.js";
import type { Fundstellenzustand } from "../article/pruefung.js";

/** Meilensteine nach dem Versand, in Tagen (Spec §14, P5). */
export const MEILENSTEINE_TAGE = [1, 3, 7, 30, 90] as const;
const TAG = 86_400;

export interface FaelligeMeldung {
  id: string;
  articleUrlCanon: string;
  quoteBefore: string;
  suggestionAfter: string;
  quotePrefix: string | null;
  quoteSuffix: string | null;
}

/**
 * Meldungen, deren naechster Meilenstein erreicht ist. Je Domain hoechstens
 * eine pro Lauf: der stuendliche Takt haelt damit die Zusage „ein Abruf pro
 * Domain und Minute" mit weitem Abstand ein.
 *
 * Ein Altbestand, bei dem alle Meilensteine laengst vorbei sind, wird
 * dadurch genau einmal nachgeholt, nicht fuenfmal.
 */
export function faelligeChecks(db: Db, jetzt: number): FaelligeMeldung[] {
  const zeilen = db.all<FaelligeMeldung & { sentAt: number; letzterCheck: number | null }>(sql`
    SELECT c.id, c.article_url_canon AS articleUrlCanon, c.quote_before AS quoteBefore,
           c.suggestion_after AS suggestionAfter, c.quote_prefix AS quotePrefix,
           c.quote_suffix AS quoteSuffix, c.sent_at AS sentAt,
           (SELECT MAX(a.checked_at) FROM article_checks a WHERE a.correction_id = c.id) AS letzterCheck
    FROM corrections c
    WHERE c.dispatch_status = 'sent' AND c.sent_at IS NOT NULL
    ORDER BY c.sent_at
  `);

  const proDomain = new Map<string, FaelligeMeldung>();
  for (const zeile of zeilen) {
    if (!istFaellig(zeile.sentAt, zeile.letzterCheck, jetzt)) continue;
    const host = domainVon(zeile.articleUrlCanon);
    if (host === null || proDomain.has(host)) continue;
    proDomain.set(host, {
      id: zeile.id,
      articleUrlCanon: zeile.articleUrlCanon,
      quoteBefore: zeile.quoteBefore,
      suggestionAfter: zeile.suggestionAfter,
      quotePrefix: zeile.quotePrefix,
      quoteSuffix: zeile.quoteSuffix,
    });
  }
  return [...proDomain.values()];
}

/** Faellig, sobald ein Meilenstein erreicht ist, den noch kein Check abdeckt. */
function istFaellig(sentAt: number, letzterCheck: number | null, jetzt: number): boolean {
  const erreicht = MEILENSTEINE_TAGE.filter((tage) => sentAt + tage * TAG <= jetzt);
  if (erreicht.length === 0) return false;
  const juengster = sentAt + (erreicht[erreicht.length - 1] ?? 0) * TAG;
  return letzterCheck === null || letzterCheck < juengster;
}

function domainVon(adresse: string): string | null {
  try {
    return new URL(adresse).host;
  } catch {
    return null;
  }
}

export interface CheckVermerk {
  checkedAt: number;
  httpStatus: number | null;
  zustand: Fundstellenzustand | "unreachable";
  beobachtet: string | null;
  sicherheit: number | null;
}

/** Haelt einen Befund fest. Der Ausgang der Meldung bleibt unberuehrt. */
export function vermerkeCheck(db: Db, correctionId: string, vermerk: CheckVermerk): void {
  db.insert(articleChecks)
    .values({
      id: createId(),
      correctionId,
      checkedAt: vermerk.checkedAt,
      httpStatus: vermerk.httpStatus,
      quoteState: vermerk.zustand,
      matchConfidence: vermerk.sicherheit,
      observedText: vermerk.beobachtet,
      pageTextHash: null,
    })
    .run();
}
