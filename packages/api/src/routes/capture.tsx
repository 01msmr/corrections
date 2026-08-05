import { canonicalizeUrl, detectErrorTypeKey, detectSeverity, newCorrectionSchema } from "@korrektur/shared";
import { createId } from "@paralleldrive/cuid2";
import { Hono } from "hono";
import { getErrorTypeByKey, listErrorTypes } from "../repo/errorTypes.js";
import { createCorrection, type CreateDeps } from "../repo/corrections.js";
import { resolveOutletByHost } from "../repo/outlets.js";
import { composeMail } from "../dispatch/compose.js";
import { CaptureForm, CapturePreview, CaptureResult } from "../views/capture.js";

export function captureRoutes(deps: CreateDeps): Hono {
  const app = new Hono();

  app.get("/neu", (c) =>
    c.html(
      <CaptureForm
        errorTypes={listErrorTypes(deps.db)}
        idempotencyKey={createId()}
        url={c.req.query("url") ?? ""}
        quote={c.req.query("text") ?? ""}
      />,
    ),
  );

  /**
   * Kategorie-Vorschlag fuer das Formular. Die Erkennung lebt in shared;
   * hier wird nur geprueft, ob es den Schluessel (noch) gibt -- Kategorien
   * sind ueber die Verwaltung loeschbar.
   */
  app.post("/neu/kategorie", async (c) => {
    const body = await c.req.parseBody();
    const falsch = typeof body["falsch"] === "string" ? body["falsch"] : "";
    const richtig = typeof body["richtig"] === "string" ? body["richtig"] : "";
    const erkannt = detectErrorTypeKey(falsch, richtig);
    const vorhanden = erkannt !== null && listErrorTypes(deps.db).some((t) => t.key === erkannt);
    return c.json({
      kategorie: vorhanden ? erkannt : null,
      schwere: vorhanden ? detectSeverity(falsch, richtig, erkannt) : null,
    });
  });

  /**
   * Vorschau vor dem Versand: dieselbe Pruefung wie beim Senden, aber ohne
   * Nebenwirkung -- kein Datensatz, kein Titel wird angelegt, keine Kennung
   * verbraucht. Die Mail steht mit dem Platzhalter VORSCHAU da.
   */
  app.post("/neu/vorschau", async (c) => {
    const body = await c.req.parseBody();
    const parsed = newCorrectionSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join(" | ");
      return c.html(
        <CaptureForm
          errorTypes={listErrorTypes(deps.db)}
          idempotencyKey={createId()}
          url={typeof body["articleUrl"] === "string" ? body["articleUrl"] : ""}
          quote={typeof body["quoteBefore"] === "string" ? body["quoteBefore"] : ""}
          fehler={message}
        />,
        400,
      );
    }

    const canon = canonicalizeUrl(parsed.data.articleUrl);
    const errorType = canon ? getErrorTypeByKey(deps.db, parsed.data.errorTypeKey) : null;
    const outlet = canon ? resolveOutletByHost(deps.db, canon.host) : null;
    const empfaenger = parsed.data.recipientEmail ?? outlet?.contactEmails[0];
    if (!canon || !errorType || !empfaenger) {
      const zurueck = `/neu?url=${encodeURIComponent(parsed.data.articleUrl)}&text=${encodeURIComponent(parsed.data.quoteBefore)}`;
      return c.html(
        <CaptureForm
          errorTypes={listErrorTypes(deps.db)}
          idempotencyKey={createId()}
          url={parsed.data.articleUrl}
          quote={parsed.data.quoteBefore}
          fehler={
            !canon
              ? "Die Artikel-URL ist nicht verwertbar."
              : !errorType
                ? `Unbekannte Kategorie: ${parsed.data.errorTypeKey}`
                : undefined
          }
          fehlendeRedaktion={canon && errorType ? { host: canon.host, zurueck } : undefined}
        />,
        400,
      );
    }

    const mail = composeMail({
      ref: "VORSCHAU",
      outletName: outlet?.name ?? canon.host,
      articleUrl: parsed.data.articleUrl,
      articleUrlCanon: canon.canonical,
      headline: parsed.data.headline ?? null,
      errorTypeKey: errorType.key,
      errorTypeLabel: errorType.label,
      severity: parsed.data.severity,
      quoteBefore: parsed.data.quoteBefore,
      suggestionAfter: parsed.data.suggestionAfter,
      comment: parsed.data.comment,
      baseUrl: deps.baseUrl,
    });

    const werte: Record<string, string> = {};
    for (const [name, wert] of Object.entries(body)) {
      if (typeof wert === "string") werte[name] = wert;
    }
    return c.html(
      <CapturePreview an={empfaenger} subject={mail.subject} mailHtml={mail.html} werte={werte} />,
    );
  });

  app.post("/neu", async (c) => {
    const body = await c.req.parseBody();
    const parsed = newCorrectionSchema.safeParse(body);

    if (!parsed.success) {
      const message = parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join(" | ");
      return c.html(
        <CaptureForm
          errorTypes={listErrorTypes(deps.db)}
          idempotencyKey={createId()}
          url={typeof body["articleUrl"] === "string" ? body["articleUrl"] : ""}
          quote={typeof body["quoteBefore"] === "string" ? body["quoteBefore"] : ""}
          fehler={message}
        />,
        400,
      );
    }

    const result = await createCorrection(deps, parsed.data);
    if (!result.ok) {
      // Bei fehlender Kontaktadresse fuehrt die Seite weiter, statt nur zu
      // melden. Der Host kommt aus der Kanonisierung, damit die Orchestrierung
      // dafuer nichts zurueckgeben muss.
      const canon =
        result.error === "no_recipient" ? canonicalizeUrl(parsed.data.articleUrl) : null;
      const zurueck = `/neu?url=${encodeURIComponent(parsed.data.articleUrl)}&text=${encodeURIComponent(parsed.data.quoteBefore)}`;

      return c.html(
        <CaptureForm
          errorTypes={listErrorTypes(deps.db)}
          idempotencyKey={createId()}
          url={parsed.data.articleUrl}
          quote={parsed.data.quoteBefore}
          fehler={canon ? undefined : result.message}
          fehlendeRedaktion={canon ? { host: canon.host, zurueck } : undefined}
        />,
        400,
      );
    }

    return c.html(
      <CaptureResult
        ref={result.ref}
        anchored={result.anchorQuality === "exact"}
        sent={result.dispatchStatus === "sent"}
      />,
    );
  });

  return app;
}
