import { canonicalizeUrl, generateRef, type NewCorrectionInput } from "@korrektur/shared";
import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { deriveAnchors, type AnchorResult } from "../article/anchor.js";
import { extractArticle } from "../article/extract.js";
import type { FetchResult } from "../article/fetch.js";
import type { Db } from "../db/client.js";
import { corrections } from "../db/schema.js";
import { composeMail } from "../dispatch/compose.js";
import type { Mailer } from "../dispatch/send.js";
import { getErrorTypeByKey } from "./errorTypes.js";
import { ensureOutletForHost } from "./outlets.js";

export interface CreateDeps {
  db: Db;
  mailer: Mailer;
  fetchArticle: (url: string) => Promise<FetchResult>;
  now: () => number;
  baseUrl: string;
  /** Injizierbar, damit der Kollisionspfad ohne ESM-Mocking testbar bleibt. */
  generateRef?: () => string;
}

export type CreateResult =
  | {
      ok: true;
      created: boolean;
      id: string;
      ref: string;
      anchorQuality: AnchorResult["quality"];
      dispatchStatus: "sent" | "failed";
    }
  | {
      ok: false;
      error: "invalid_url" | "unknown_error_type" | "no_recipient";
      message: string;
    };

const REF_ATTEMPTS = 5;
const NO_ANCHOR: AnchorResult = { quality: "none", prefix: null, suffix: null, positionHint: null };

export function getCorrectionByRef(db: Db, ref: string): typeof corrections.$inferSelect | null {
  return db.select().from(corrections).where(eq(corrections.ref, ref)).get() ?? null;
}

/**
 * drizzle-orm@1.0.0-rc.4 wrapt Treiberfehler in DrizzleQueryError; dessen
 * `.message` ist nur "Failed query: ...", die SQLite-Meldung
 * ("UNIQUE constraint failed: ...") steckt in `.cause`. Deshalb wird hier
 * die Ursachenkette abgesucht statt nur `error.message`.
 */
function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current instanceof Error; depth++) {
    if (/UNIQUE/i.test(current.message)) return true;
    current = current.cause;
  }
  return false;
}

function reserveRef(makeRef: () => string, insert: (ref: string) => void): string {
  for (let attempt = 0; attempt < REF_ATTEMPTS; attempt++) {
    const ref = makeRef();
    try {
      insert(ref);
      return ref;
    } catch (error) {
      if (!isUniqueViolation(error) || attempt === REF_ATTEMPTS - 1) throw error;
    }
  }
  throw new Error("Kein freier Referenz-Token gefunden");
}

export async function createCorrection(
  deps: CreateDeps,
  input: NewCorrectionInput,
): Promise<CreateResult> {
  const { db } = deps;

  const existing = db
    .select()
    .from(corrections)
    .where(eq(corrections.idempotencyKey, input.idempotencyKey))
    .get();
  if (existing) {
    return {
      ok: true,
      created: false,
      id: existing.id,
      ref: existing.ref,
      anchorQuality: existing.anchorQuality,
      dispatchStatus: existing.dispatchStatus === "sent" ? "sent" : "failed",
    };
  }

  const canon = canonicalizeUrl(input.articleUrl);
  if (!canon) {
    return { ok: false, error: "invalid_url", message: "Die Artikel-URL ist nicht verwertbar." };
  }

  const errorType = getErrorTypeByKey(db, input.errorTypeKey);
  if (!errorType) {
    return {
      ok: false,
      error: "unknown_error_type",
      message: `Unbekannte Fehlerart: ${input.errorTypeKey}`,
    };
  }

  const now = deps.now();
  const { outlet, created: outletCreated } = ensureOutletForHost(db, canon.host, now);
  const recipient = input.recipientEmail ?? outlet.contactEmails[0];
  if (!recipient) {
    return {
      ok: false,
      error: "no_recipient",
      message: `Für ${canon.host} ist keine Kontaktadresse hinterlegt. Bitte unter /admin/redaktionen ergänzen.`,
    };
  }

  // Artikelabruf darf scheitern: dann fehlen nur die Anker (§6, Schritt 3).
  let anchors = NO_ANCHOR;
  let headline = input.headline;
  const fetched = await deps.fetchArticle(canon.canonical);
  if (fetched.ok) {
    const article = extractArticle(fetched.html, canon.canonical);
    if (article) {
      anchors = deriveAnchors(article.text, input.quoteBefore);
      headline = headline ?? article.title;
    }
  }

  const id = createId();
  const ref = reserveRef(deps.generateRef ?? generateRef, (candidate) => {
    db.insert(corrections)
      .values({
        id,
        ref: candidate,
        idempotencyKey: input.idempotencyKey,
        createdAt: now,
        dispatchMode: "smtp",
        articleUrl: input.articleUrl,
        articleUrlCanon: canon.canonical,
        outletId: outlet.id,
        headline,
        errorTypeId: errorType.id,
        severity: input.severity,
        quoteBefore: input.quoteBefore,
        quotePrefix: anchors.prefix,
        quoteSuffix: anchors.suffix,
        quotePositionHint: anchors.positionHint,
        anchorQuality: anchors.quality,
        suggestionAfter: input.suggestionAfter,
        comment: input.comment,
        recipientEmail: recipient,
        dispatchStatus: "prepared",
        source: "web",
        needsReview: outletCreated || anchors.quality !== "exact",
      })
      .run();
  });

  const mail = composeMail({
    ref,
    articleUrl: input.articleUrl,
    articleUrlCanon: canon.canonical,
    headline,
    errorTypeKey: errorType.key,
    errorTypeLabel: errorType.label,
    severity: input.severity as 1 | 2 | 3,
    quoteBefore: input.quoteBefore,
    suggestionAfter: input.suggestionAfter,
    comment: input.comment,
    baseUrl: deps.baseUrl,
  });

  const sent = await deps.mailer.send({ to: recipient, subject: mail.subject, text: mail.text });

  if (sent.ok) {
    // Eigener Weg: das Relay hat quittiert, der Versand ist belegt (§15.2).
    db.update(corrections)
      .set({
        dispatchStatus: "sent",
        sentAt: now,
        messageId: sent.messageId,
        sendConfirmedBy: "smtp",
      })
      .where(eq(corrections.id, id))
      .run();
  } else {
    db.update(corrections)
      .set({ dispatchStatus: "failed", needsReview: true })
      .where(eq(corrections.id, id))
      .run();
  }

  return {
    ok: true,
    created: true,
    id,
    ref,
    anchorQuality: anchors.quality,
    dispatchStatus: sent.ok ? "sent" : "failed",
  };
}
