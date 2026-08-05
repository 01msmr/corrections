import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const outlets = sqliteTable("outlets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  primaryDomain: text("primary_domain").notNull(),
  publisher: text("publisher"),
  country: text("country"),
  notes: text("notes"),
  /** Intern. Erscheint in keiner öffentlichen Antwort (§2.1, §13). */
  contactEmails: text("contact_emails", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'`),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull(),
});

export const outletDomains = sqliteTable(
  "outlet_domains",
  {
    id: text("id").primaryKey(),
    outletId: text("outlet_id")
      .notNull()
      .references(() => outlets.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
  },
  (t) => ({
    domainUnique: uniqueIndex("outlet_domains_domain_unique").on(t.domain),
    byOutlet: index("outlet_domains_outlet_idx").on(t.outletId),
  }),
);

export const errorTypes = sqliteTable(
  "error_types",
  {
    id: text("id").primaryKey(),
    /** Nach Anlage unveränderlich — steht im Meta-Block versendeter Mails (§5.0). */
    key: text("key").notNull(),
    label: text("label").notNull(),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at").notNull(),
  },
  (t) => ({ keyUnique: uniqueIndex("error_types_key_unique").on(t.key) }),
);

export const corrections = sqliteTable(
  "corrections",
  {
    id: text("id").primaryKey(),
    ref: text("ref").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: integer("created_at").notNull(),
    dispatchMode: text("dispatch_mode", { enum: ["smtp", "mailto"] }).notNull(),

    articleUrl: text("article_url").notNull(),
    articleUrlCanon: text("article_url_canon").notNull(),
    outletId: text("outlet_id")
      .notNull()
      .references(() => outlets.id),
    headline: text("headline"),
    publishedAt: integer("published_at"),

    errorTypeId: text("error_type_id")
      .notNull()
      .references(() => errorTypes.id),
    /** Anzahl der Einheiten bei zaehlbaren Kategorien ("zwei Zeichen fehlen"). */
    errorCount: integer("error_count"),
    /** Konkretes Satzzeichen bei komma_-Kategorien ("," → "ein Komma zu viel"). */
    errorChar: text("error_char"),
    severity: integer("severity").notNull(),

    quoteBefore: text("quote_before").notNull(),
    quotePrefix: text("quote_prefix"),
    quoteSuffix: text("quote_suffix"),
    quotePositionHint: integer("quote_position_hint"),
    anchorQuality: text("anchor_quality", { enum: ["exact", "context", "none"] })
      .notNull()
      .default("none"),
    suggestionAfter: text("suggestion_after").notNull(),
    comment: text("comment"),

    /** Intern (§2.1). */
    recipientEmail: text("recipient_email").notNull(),
    messageId: text("message_id"),

    dispatchStatus: text("dispatch_status", {
      enum: ["prepared", "sent", "failed", "bounced"],
    })
      .notNull()
      .default("prepared"),
    sentAt: integer("sent_at"),
    /** Beleg (smtp, bcc) oder Behauptung (client) — trennt die Nenner (§15.2). */
    sendConfirmedBy: text("send_confirmed_by", { enum: ["smtp", "bcc", "client"] }),

    outcome: text("outcome", {
      enum: ["open", "acknowledged", "corrected", "rejected", "no_response"],
    })
      .notNull()
      .default("open"),
    respondedAt: integer("responded_at"),
    correctedAt: integer("corrected_at"),
    verification: text("verification", { enum: ["manual", "none"] }).notNull().default("none"),

    source: text("source", { enum: ["web", "backfill", "manual"] }).notNull(),
    needsReview: integer("needs_review", { mode: "boolean" }).notNull().default(false),
  },
  (t) => ({
    refUnique: uniqueIndex("corrections_ref_unique").on(t.ref),
    idempotencyUnique: uniqueIndex("corrections_idempotency_unique").on(t.idempotencyKey),
    byOutlet: index("corrections_outlet_sent_idx").on(t.outletId, t.sentAt),
    byErrorType: index("corrections_error_type_idx").on(t.errorTypeId),
    byDispatchStatus: index("corrections_dispatch_status_idx").on(t.dispatchStatus),
    byCanon: index("corrections_canon_idx").on(t.articleUrlCanon),
  }),
);

export const responseEvents = sqliteTable(
  "response_events",
  {
    id: text("id").primaryKey(),
    correctionId: text("correction_id")
      .notNull()
      .references(() => corrections.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["reply", "autoreply", "bounce"] }).notNull(),
    receivedAt: integer("received_at").notNull(),
    rawMessageId: text("raw_message_id"),
    /** Intern. Kein öffentlicher Serializer (§2.1, §12). */
    fromAddr: text("from_addr"),
    excerpt: text("excerpt"),
  },
  (t) => ({ byCorrection: index("response_events_correction_idx").on(t.correctionId) }),
);

export const articleChecks = sqliteTable(
  "article_checks",
  {
    id: text("id").primaryKey(),
    correctionId: text("correction_id")
      .notNull()
      .references(() => corrections.id, { onDelete: "cascade" }),
    checkedAt: integer("checked_at").notNull(),
    httpStatus: integer("http_status"),
    quoteState: text("quote_state", {
      enum: ["unchanged", "changed_as_suggested", "changed_otherwise", "passage_gone", "unreachable"],
    }).notNull(),
    matchConfidence: integer("match_confidence"),
    /** Intern (§12). */
    observedText: text("observed_text"),
    pageTextHash: text("page_text_hash"),
  },
  (t) => ({ byCorrection: index("article_checks_correction_idx").on(t.correctionId, t.checkedAt) }),
);

export const imapCursor = sqliteTable("imap_cursor", {
  folder: text("folder").primaryKey(),
  uidvalidity: integer("uidvalidity").notNull(),
  lastUid: integer("last_uid").notNull(),
});
