import { canonicalizeUrl, detectErrorTypeKey, newCorrectionSchema } from "@korrektur/shared";
import { createId } from "@paralleldrive/cuid2";
import { Hono } from "hono";
import { listErrorTypes } from "../repo/errorTypes.js";
import { createCorrection, type CreateDeps } from "../repo/corrections.js";
import { CaptureForm, CaptureResult } from "../views/capture.js";

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
    return c.json({ kategorie: vorhanden ? erkannt : null });
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
