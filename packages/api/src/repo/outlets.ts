import { createId } from "@paralleldrive/cuid2";
import { and, eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { corrections, outletDomains, outlets } from "../db/schema.js";
import { removeOrArchive, type RemovalOutcome } from "./removal.js";

export type OutletRecord = typeof outlets.$inferSelect & { domains: string[] };

export interface OutletInput {
  name: string;
  primaryDomain: string;
  publisher: string | null;
  country: string | null;
  notes: string | null;
  contactEmails: string[];
}

function withDomains(db: Db, row: typeof outlets.$inferSelect): OutletRecord {
  const domains = db
    .select({ domain: outletDomains.domain })
    .from(outletDomains)
    .where(eq(outletDomains.outletId, row.id))
    .all()
    .map((d) => d.domain);
  return { ...row, domains };
}

export function resolveOutletByHost(db: Db, host: string): OutletRecord | null {
  const mapping = db
    .select()
    .from(outletDomains)
    .where(eq(outletDomains.domain, host.toLowerCase()))
    .get();
  if (!mapping) return null;

  const row = db.select().from(outlets).where(eq(outlets.id, mapping.outletId)).get();
  return row ? withDomains(db, row) : null;
}

/** Legt bei unbekanntem Host ein Outlet an; der Aufrufer markiert den Datensatz zur Prüfung. */
export function ensureOutletForHost(
  db: Db,
  host: string,
  now: number,
): { outlet: OutletRecord; created: boolean } {
  const existing = resolveOutletByHost(db, host);
  if (existing) return { outlet: existing, created: false };

  const normalized = host.toLowerCase();
  const id = createId();
  db.insert(outlets)
    .values({ id, name: normalized, primaryDomain: normalized, contactEmails: [], createdAt: now })
    .run();
  db.insert(outletDomains).values({ id: createId(), outletId: id, domain: normalized }).run();

  const row = db.select().from(outlets).where(eq(outlets.id, id)).get();
  if (!row) throw new Error("Outlet konnte nicht angelegt werden");
  return { outlet: withDomains(db, row), created: true };
}

export function listOutlets(db: Db, options: { includeArchived?: boolean } = {}): OutletRecord[] {
  const rows = options.includeArchived
    ? db.select().from(outlets).all()
    : db.select().from(outlets).where(eq(outlets.archived, false)).all();
  return rows
    .map((row) => withDomains(db, row))
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
}

export function createOutlet(db: Db, input: OutletInput, now: number): OutletRecord {
  const id = createId();
  const domain = input.primaryDomain.toLowerCase();
  db.insert(outlets)
    .values({
      id,
      name: input.name,
      primaryDomain: domain,
      publisher: input.publisher,
      country: input.country,
      notes: input.notes,
      contactEmails: input.contactEmails,
      createdAt: now,
    })
    .run();
  db.insert(outletDomains).values({ id: createId(), outletId: id, domain }).run();

  const row = db.select().from(outlets).where(eq(outlets.id, id)).get();
  if (!row) throw new Error("Outlet konnte nicht angelegt werden");
  return withDomains(db, row);
}

export function updateOutlet(db: Db, id: string, input: OutletInput): OutletRecord | null {
  const existing = db.select().from(outlets).where(eq(outlets.id, id)).get();
  if (!existing) return null;

  db.update(outlets)
    .set({
      name: input.name,
      primaryDomain: input.primaryDomain.toLowerCase(),
      publisher: input.publisher,
      country: input.country,
      notes: input.notes,
      contactEmails: input.contactEmails,
    })
    .where(eq(outlets.id, id))
    .run();

  const row = db.select().from(outlets).where(eq(outlets.id, id)).get();
  return row ? withDomains(db, row) : null;
}

/** Regel in removal.ts, Abfragen hier — siehe dort, warum das getrennt ist. */
export function removeOutlet(db: Db, id: string): RemovalOutcome {
  return removeOrArchive({
    exists: () => db.select().from(outlets).where(eq(outlets.id, id)).get() !== undefined,
    isReferenced: () =>
      db.select().from(corrections).where(eq(corrections.outletId, id)).get() !== undefined,
    archive: () => {
      db.update(outlets).set({ archived: true }).where(eq(outlets.id, id)).run();
    },
    hardDelete: () => {
      db.delete(outletDomains).where(eq(outletDomains.outletId, id)).run();
      db.delete(outlets).where(eq(outlets.id, id)).run();
    },
  });
}

export function addDomain(db: Db, outletId: string, domain: string): boolean {
  const normalized = domain.toLowerCase();
  const taken = db
    .select()
    .from(outletDomains)
    .where(eq(outletDomains.domain, normalized))
    .get();
  if (taken) return taken.outletId === outletId;

  db.insert(outletDomains).values({ id: createId(), outletId, domain: normalized }).run();
  return true;
}

export function removeDomain(db: Db, outletId: string, domain: string): boolean {
  const normalized = domain.toLowerCase();
  const remaining = db
    .select()
    .from(outletDomains)
    .where(eq(outletDomains.outletId, outletId))
    .all();
  if (remaining.length <= 1) return false;

  db.delete(outletDomains)
    .where(and(eq(outletDomains.outletId, outletId), eq(outletDomains.domain, normalized)))
    .run();
  return true;
}
