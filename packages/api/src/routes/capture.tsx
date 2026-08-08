import {
  benenneFehlerart,
  canonicalizeUrl,
  detectErrorChar,
  detectErrorCount,
  detectErrorTypeKey,
  detectSeverity,
  newCorrectionSchema,
} from "@korrektur/shared";
import { createId } from "@paralleldrive/cuid2";
import { Hono, type Handler } from "hono";
import { z } from "zod";
import { getErrorTypeByKey, listErrorTypes } from "../repo/errorTypes.js";
import { createCorrection, type CreateDeps } from "../repo/corrections.js";
import { extractArticle } from "../article/extract.js";
import { resolveOutletByHost } from "../repo/outlets.js";
import { composeMail } from "../dispatch/compose.js";
import { CaptureForm, CapturePreview, CaptureResult } from "../views/capture.js";

/**
 * Vorbefuellung aus der Query: bevorzugt der Base64-Parameter `b`
 * (base64url-kodiertes JSON {u, t}) — noetig, weil die "URL oeffnen"-Aktion
 * der iOS-Kurzbefehle Prozent-Kodierung wieder aufloest und die URL dann am
 * ersten Leerzeichen der Auswahl abreisst. `url`/`text` bleiben fuer das
 * Bookmarklet erhalten. Unlesbares wird ignoriert, nie beanstandet.
 */
function leseVorbefuellung(c: Parameters<Handler>[0]): { url: string; quote: string } {
  const b = c.req.query("b");
  if (b) {
    try {
      const json = Buffer.from(b.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
      const gelesen = z
        .object({ u: z.string().optional(), t: z.string().optional() })
        .safeParse(JSON.parse(json));
      if (gelesen.success) {
        return { url: gelesen.data.u ?? "", quote: gelesen.data.t ?? "" };
      }
    } catch {
      /* unlesbar -> leeres Formular */
    }
  }
  return { url: c.req.query("url") ?? "", quote: c.req.query("text") ?? "" };
}

export function captureRoutes(deps: CreateDeps & { mailFrom: string }): Hono {
  const app = new Hono();

  app.get("/neu", (c) => {
    const vorbefuellt = leseVorbefuellung(c);
    return c.html(
      <CaptureForm
        errorTypes={listErrorTypes(deps.db)}
        idempotencyKey={createId()}
        url={vorbefuellt.url}
        quote={vorbefuellt.quote}
      />,
    );
  });

  /* Der Besucherweg (§ Spec 2026-08-08): dasselbe Formular ohne Anmeldung,
     nur die Sendemethode am Ende ist das Mail-Programm des Besuchers. */
  app.get("/hinweis", (c) => {
    const vorbefuellt = leseVorbefuellung(c);
    return c.html(
      <CaptureForm
        errorTypes={listErrorTypes(deps.db)}
        idempotencyKey={createId()}
        url={vorbefuellt.url}
        quote={vorbefuellt.quote}
        basis="/hinweis"
      />,
    );
  });

  /** Holt die Ueberschrift, sobald die URL im Formular steht. */
  const ueberschriftHandler: Handler = async (c) => {
    const body = await c.req.parseBody();
    const roh = typeof body["url"] === "string" ? body["url"] : "";
    const canon = canonicalizeUrl(roh);
    if (!canon) return c.json({ ueberschrift: null });
    const fetched = await deps.fetchArticle(canon.canonical);
    if (!fetched.ok) return c.json({ ueberschrift: null });
    const article = extractArticle(fetched.html, canon.canonical);
    return c.json({ ueberschrift: article?.title ?? null });
  };
  app.post("/neu/ueberschrift", ueberschriftHandler);
  app.post("/hinweis/ueberschrift", ueberschriftHandler);

  /**
   * Kategorie-Vorschlag fuer das Formular. Die Erkennung lebt in shared;
   * hier wird nur geprueft, ob es den Schluessel (noch) gibt -- Kategorien
   * sind ueber die Verwaltung loeschbar.
   */
  const kategorieHandler: Handler = async (c) => {
    const body = await c.req.parseBody();
    const falsch = typeof body["falsch"] === "string" ? body["falsch"] : "";
    const richtig = typeof body["richtig"] === "string" ? body["richtig"] : "";
    const erkannt = detectErrorTypeKey(falsch, richtig);
    const vorhanden = erkannt !== null && listErrorTypes(deps.db).some((t) => t.key === erkannt);
    return c.json({
      kategorie: vorhanden ? erkannt : null,
      schwere: vorhanden ? detectSeverity(falsch, richtig, erkannt) : null,
      anzahl: vorhanden ? detectErrorCount(falsch, richtig, erkannt) : null,
      zeichen: vorhanden ? detectErrorChar(falsch, richtig, erkannt) : null,
    });
  };
  app.post("/neu/kategorie", kategorieHandler);
  app.post("/hinweis/kategorie", kategorieHandler);

  /**
   * Vorschau vor dem Versand: dieselbe Pruefung wie beim Senden, aber ohne
   * Nebenwirkung -- kein Datensatz, kein Titel wird angelegt, keine Kennung
   * verbraucht. Die Mail steht mit dem Platzhalter VORSCHAU da.
   */
  const vorschauHandler = (basis: "/neu" | "/hinweis"): Handler => async (c) => {
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
          basis={basis}
        />,
        400,
      );
    }

    const canon = canonicalizeUrl(parsed.data.articleUrl);
    const errorType = canon ? getErrorTypeByKey(deps.db, parsed.data.errorTypeKey) : null;
    const outlet = canon ? resolveOutletByHost(deps.db, canon.host) : null;
    /* Besucher brauchen kein hinterlegtes Medium: ohne Korrekturadresse geht
       der Hinweis an MAIL_FROM. Betreiber sollen das Medium erst anlegen. */
    const empfaenger =
      basis === "/hinweis"
        ? (outlet?.contactEmails[0] ?? deps.mailFrom)
        : (parsed.data.recipientEmail ?? outlet?.contactEmails[0]);
    if (!canon || !errorType || !empfaenger) {
      const zurueck = `${basis}?url=${encodeURIComponent(parsed.data.articleUrl)}&text=${encodeURIComponent(parsed.data.quoteBefore)}`;
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
          basis={basis}
        />,
        400,
      );
    }

    const mail = composeMail({
      /* Besucher-Hinweise tragen keine Kennung — niemand ordnet Antworten zu. */
      ref: basis === "/neu" ? "VORSCHAU" : null,
      outletName: outlet?.name ?? canon.host,
      articleUrl: parsed.data.articleUrl,
      articleUrlCanon: canon.canonical,
      headline: parsed.data.headline ?? null,
      errorTypeKey: errorType.key,
      errorTypeLabel: benenneFehlerart(
        errorType.key,
        errorType.label,
        parsed.data.errorCount,
        parsed.data.errorChar,
      ),
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
      <CapturePreview
        an={empfaenger}
        subject={mail.subject}
        mailHtml={mail.html}
        werte={werte}
        mailtoHref={
          basis === "/hinweis"
            ? `mailto:${empfaenger}?subject=${encodeURIComponent(mail.subject)}&body=${encodeURIComponent(mail.text)}`
            : undefined
        }
      />,
    );
  };
  app.post("/neu/vorschau", vorschauHandler("/neu"));
  app.post("/hinweis/vorschau", vorschauHandler("/hinweis"));

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
        artikelGeladen={result.artikelGeladen}
        sent={result.dispatchStatus === "sent"}
      />,
    );
  });

  return app;
}
