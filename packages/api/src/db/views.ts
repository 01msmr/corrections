import { MATURITY_SECONDS } from "@korrektur/shared";
import { sql } from "drizzle-orm";
import type { Db } from "./client.js";

/**
 * Views werden bei jedem Start neu erzeugt, damit die Reifegrenze aus
 * `shared` und die Reifegrenze im SQL nicht auseinanderdriften (§9.5).
 */
export function applyViews(db: Db): void {
  const statements = [
    "DROP VIEW IF EXISTS v_error_type_stats",
    "DROP VIEW IF EXISTS v_outlet_stats",
    "DROP VIEW IF EXISTS v_corrections_scope",
    `CREATE VIEW v_corrections_scope AS
     SELECT
       c.id,
       c.outlet_id,
       c.error_type_id,
       c.dispatch_mode,
       CASE WHEN c.dispatch_status = 'sent' AND c.sent_at IS NOT NULL THEN 1 ELSE 0 END AS deliverable,
       CASE WHEN c.sent_at IS NOT NULL AND c.sent_at <= (unixepoch() - ${MATURITY_SECONDS}) THEN 1 ELSE 0 END AS mature,
       CASE WHEN EXISTS (
         SELECT 1 FROM response_events r WHERE r.correction_id = c.id AND r.kind = 'reply'
       ) THEN 1 ELSE 0 END AS replied,
       CASE WHEN c.corrected_at IS NOT NULL AND c.verification = 'manual' THEN 1 ELSE 0 END AS corrected,
       CASE WHEN c.corrected_at IS NOT NULL OR NOT EXISTS (
         SELECT 1 FROM article_checks a
         WHERE a.correction_id = c.id
           AND a.quote_state = 'unreachable'
           AND a.checked_at = (SELECT MAX(a2.checked_at) FROM article_checks a2 WHERE a2.correction_id = c.id)
       ) THEN 1 ELSE 0 END AS checkable
     FROM corrections c`,
    `CREATE VIEW v_outlet_stats AS
     SELECT
       o.id AS outlet_id,
       o.name AS name,
       COUNT(s.id) AS n_reports,
       COALESCE(SUM(CASE WHEN s.deliverable=1 AND s.mature=1 AND s.checkable=1 THEN 1 ELSE 0 END), 0) AS n_correction_base,
       COALESCE(SUM(CASE WHEN s.deliverable=1 AND s.mature=1 AND s.checkable=1 AND s.corrected=1 THEN 1 ELSE 0 END), 0) AS n_corrected,
       COALESCE(SUM(CASE WHEN s.deliverable=1 AND s.mature=1 AND s.dispatch_mode='smtp' THEN 1 ELSE 0 END), 0) AS n_reply_base,
       COALESCE(SUM(CASE WHEN s.deliverable=1 AND s.mature=1 AND s.dispatch_mode='smtp' AND s.replied=1 THEN 1 ELSE 0 END), 0) AS n_replied
     FROM outlets o
     LEFT JOIN v_corrections_scope s ON s.outlet_id = o.id
     GROUP BY o.id, o.name`,
    `CREATE VIEW v_error_type_stats AS
     SELECT
       e.id AS error_type_id,
       e.label AS label,
       COUNT(s.id) AS n_reports,
       COALESCE(SUM(CASE WHEN s.deliverable=1 AND s.mature=1 AND s.checkable=1 THEN 1 ELSE 0 END), 0) AS n_correction_base,
       COALESCE(SUM(CASE WHEN s.deliverable=1 AND s.mature=1 AND s.checkable=1 AND s.corrected=1 THEN 1 ELSE 0 END), 0) AS n_corrected
     FROM error_types e
     LEFT JOIN v_corrections_scope s ON s.error_type_id = e.id
     GROUP BY e.id, e.label`,
  ];

  for (const statement of statements) db.run(sql.raw(statement));
}
