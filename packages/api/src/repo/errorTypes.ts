import { createId } from "@paralleldrive/cuid2";
import { asc, eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { corrections, errorTypes } from "../db/schema.js";
import { removeOrArchive, type RemovalOutcome } from "./removal.js";

export type ErrorTypeRecord = typeof errorTypes.$inferSelect;

export interface ErrorTypeInput {
  key: string;
  label: string;
  description: string | null;
}

export function listErrorTypes(
  db: Db,
  options: { includeArchived?: boolean } = {},
): ErrorTypeRecord[] {
  const query = db.select().from(errorTypes).orderBy(asc(errorTypes.sortOrder));
  const rows = query.all();
  return options.includeArchived ? rows : rows.filter((r) => !r.archived);
}

export function getErrorTypeByKey(db: Db, key: string): ErrorTypeRecord | null {
  return db.select().from(errorTypes).where(eq(errorTypes.key, key)).get() ?? null;
}

/**
 * Gibt null zurück, wenn der Schlüssel bereits vergeben ist. Neue Fehlerarten
 * haengen sich ans Ende; die Reihenfolge wird danach durch Ziehen gepflegt,
 * nicht ueber eine Nummer.
 */
export function createErrorType(db: Db, input: ErrorTypeInput, now: number): ErrorTypeRecord | null {
  if (getErrorTypeByKey(db, input.key)) return null;

  const hoechste = listErrorTypes(db, { includeArchived: true }).reduce(
    (max, row) => Math.max(max, row.sortOrder),
    0,
  );
  const id = createId();
  db.insert(errorTypes)
    .values({
      id,
      key: input.key,
      label: input.label,
      description: input.description,
      sortOrder: hoechste + 10,
      createdAt: now,
    })
    .run();
  return db.select().from(errorTypes).where(eq(errorTypes.id, id)).get() ?? null;
}

/**
 * Vergibt die Sortiernummern entlang der uebergebenen Id-Liste neu, in Zehner-
 * schritten. Unbekannte Ids werden uebersprungen; nicht genannte Zeilen
 * behalten ihre Nummer.
 */
export function reorderErrorTypes(db: Db, ids: string[]): void {
  ids.forEach((id, index) => {
    db.update(errorTypes)
      .set({ sortOrder: (index + 1) * 10 })
      .where(eq(errorTypes.id, id))
      .run();
  });
}

/** `key` ist nicht änderbar: er steht im Meta-Block versendeter Mails (§5.0). */
export function updateErrorType(
  db: Db,
  id: string,
  input: Omit<ErrorTypeInput, "key">,
): ErrorTypeRecord | null {
  const existing = db.select().from(errorTypes).where(eq(errorTypes.id, id)).get();
  if (!existing) return null;

  db.update(errorTypes)
    .set({ label: input.label, description: input.description })
    .where(eq(errorTypes.id, id))
    .run();
  return db.select().from(errorTypes).where(eq(errorTypes.id, id)).get() ?? null;
}

/** Dieselbe Regel wie bei Redaktionen — der Helfer liegt in removal.ts (Task 15). */
export function removeErrorType(db: Db, id: string): RemovalOutcome {
  return removeOrArchive({
    exists: () => db.select().from(errorTypes).where(eq(errorTypes.id, id)).get() !== undefined,
    isReferenced: () =>
      db.select().from(corrections).where(eq(corrections.errorTypeId, id)).get() !== undefined,
    archive: () => {
      db.update(errorTypes).set({ archived: true }).where(eq(errorTypes.id, id)).run();
    },
    hardDelete: () => {
      db.delete(errorTypes).where(eq(errorTypes.id, id)).run();
    },
  });
}
