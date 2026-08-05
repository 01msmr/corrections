import { benenneFehlerart, canonicalizeUrl, generateRef, type NewCorrectionInput } from "@korrektur/shared";
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
      /** False, wenn der Abruf scheiterte oder kein Artikeltext extrahierbar war. */
      artikelGeladen: boolean;
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
 *
 * Der Insert kann zwei verschiedene Unique-Indizes verletzen: `ref` (Zufallstoken,
 * neu würfeln und erneut versuchen) und `idempotency_key` (ein gleichzeitiger
 * Request hat das Rennen gewonnen — kein Fehler, sondern ein Duplikat). Beide
 * erzeugen dieselbe generische "UNIQUE constraint failed"-Meldung, nur der
 * Spaltenname unterscheidet sie. Verwechselt man sie, verbraucht die zweite
 * Anfrage alle Ref-Versuche und scheitert mit dem rohen Treiberfehler, obwohl
 * die erste Anfrage bereits erfolgreich war.
 */
function uniqueViolationColumn(error: unknown): "ref" | "idempotency_key" | null {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && current instanceof Error; depth++) {
    if (/UNIQUE constraint failed: corrections\.ref\b/.test(current.message)) return "ref";
    if (/UNIQUE constraint failed: corrections\.idempotency_key\b/.test(current.message)) {
      return "idempotency_key";
    }
    current = current.cause;
  }
  return null;
}

/** Wirft, wenn der Insert an `idempotency_key` scheiterte statt an `ref`. */
class IdempotencyRaceLost extends Error {}

/**
 * DrizzleQueryError haengt `query` und `params` als eigene, aufzaehlbare
 * Eigenschaften an den Fehler — genau die Bind-Parameter (Empfaengeradresse,
 * Zitat, Vorschlag) einer unbehandelten `console.error(err)`-Ausgabe. Der
 * Fehler wird deshalb genau hier ersetzt, wo Ref und Operation ohnehin bekannt
 * sind: geloggt wird nur, was den Fehlschlag identifiziert, nicht seine Eingabe.
 * Die urspruengliche Fehlerursache wird bewusst nicht als `.cause` angehaengt —
 * sonst wuerde ein spaeteres `console.error` (z. B. Honos Standard-Fehlerpfad)
 * dieselben Bind-Parameter ueber die Ursachenkette erneut ausgeben.
 */
function sanitizedInsertFailure(ref: string, error: unknown): Error {
  console.error(
    JSON.stringify({
      level: "error",
      msg: "Anlegen der Meldung fehlgeschlagen",
      ref,
      operation: "insert correction",
      grund: error instanceof Error ? error.name : "unbekannt",
    }),
  );
  return new Error("Anlegen der Meldung fehlgeschlagen");
}

function reserveRef(makeRef: () => string, insert: (ref: string) => void): string {
  for (let attempt = 0; attempt < REF_ATTEMPTS; attempt++) {
    const ref = makeRef();
    try {
      insert(ref);
      return ref;
    } catch (error) {
      const column = uniqueViolationColumn(error);
      if (column === "idempotency_key") throw new IdempotencyRaceLost(undefined, { cause: error });
      if (column === "ref" && attempt < REF_ATTEMPTS - 1) continue;
      throw sanitizedInsertFailure(ref, error);
    }
  }
  throw new Error("Kein freier Referenz-Token gefunden");
}

function toDuplicateResult(row: typeof corrections.$inferSelect): CreateResult & { ok: true } {
  return {
    ok: true,
    created: false,
    id: row.id,
    ref: row.ref,
    anchorQuality: row.anchorQuality,
    artikelGeladen: row.anchorQuality !== "none",
    dispatchStatus: row.dispatchStatus === "sent" ? "sent" : "failed",
  };
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
  if (existing) return toDuplicateResult(existing);

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
  let artikelGeladen = false;
  const fetched = await deps.fetchArticle(canon.canonical);
  if (fetched.ok) {
    const article = extractArticle(fetched.html, canon.canonical);
    if (article) {
      artikelGeladen = true;
      anchors = deriveAnchors(article.text, input.quoteBefore);
      headline = headline ?? article.title;
    }
  }

  const id = createId();
  let ref: string;
  try {
    ref = reserveRef(deps.generateRef ?? generateRef, (candidate) => {
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
          errorCount: input.errorCount,
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
  } catch (error) {
    if (!(error instanceof IdempotencyRaceLost)) throw error;
    // Ein gleichzeitiger Request mit demselben Idempotency-Key hat zwischen unserer
    // frühen Duplikatsprüfung und diesem Insert gewonnen. Kein Fehler: den Gewinner
    // lesen und dasselbe Ergebnis liefern, das die frühe Prüfung geliefert hätte —
    // insbesondere keine zweite Mail verschicken.
    const winner = db
      .select()
      .from(corrections)
      .where(eq(corrections.idempotencyKey, input.idempotencyKey))
      .get();
    if (!winner) throw error;
    return toDuplicateResult(winner);
  }

  const mail = composeMail({
    ref,
    outletName: outlet.name,
    articleUrl: input.articleUrl,
    articleUrlCanon: canon.canonical,
    headline,
    errorTypeKey: errorType.key,
    errorTypeLabel: benenneFehlerart(errorType.key, errorType.label, input.errorCount),
    severity: input.severity,
    quoteBefore: input.quoteBefore,
    suggestionAfter: input.suggestionAfter,
    comment: input.comment,
    baseUrl: deps.baseUrl,
  });

  const sent = await deps.mailer.send({
    to: recipient,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  });

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
    // Ohne diese Zeile ist ein Fehlschlag nicht diagnostizierbar: die Oberflaeche
    // zeigt nur "Versand fehlgeschlagen", und send.ts verwirft den Grund danach.
    // Geloggt wird die SMTP-Antwort, nicht der Mailinhalt.
    console.error(
      JSON.stringify({
        level: "error",
        msg: "Versand fehlgeschlagen",
        ref,
        operation: "smtp send",
        grund: sent.error,
      }),
    );
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
    artikelGeladen,
    dispatchStatus: sent.ok ? "sent" : "failed",
  };
}
