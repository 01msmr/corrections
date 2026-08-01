import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { drizzle, type NodeSQLiteDatabase } from "drizzle-orm/node-sqlite";
import { migrate } from "drizzle-orm/node-sqlite/migrator";

export type Db = NodeSQLiteDatabase & { $client: DatabaseSync };

/**
 * node:sqlite ist in Node eingebaut — keine native Abhaengigkeit, nichts zu kompilieren (§3.4).
 *
 * `drizzle-orm@1.0.0-rc.4` nimmt fuer node-sqlite nur die Objektform
 * `drizzle({ client })` an (kein zweites Positionsargument, kein `schema`-Schluessel
 * mehr — `DrizzleSQLiteConfig` schliesst ihn explizit aus). Tabellen kommen direkt
 * aus `./schema.js`, ueber `db.query.*` wird hier nicht gearbeitet, daher genuegt der
 * Aufruf ohne Schema.
 */
export function createDb(path: string): Db {
  const sqlite = new DatabaseSync(path);
  sqlite.exec("PRAGMA journal_mode = WAL");
  sqlite.exec("PRAGMA foreign_keys = ON");
  return drizzle({ client: sqlite });
}

const DEFAULT_MIGRATIONS_DIR = "./packages/api/src/db/migrations";

/**
 * Der Ordner wird uebergeben statt aus import.meta.url abgeleitet: Das
 * ausgelieferte CJS-Buendel kennt import.meta.url nicht (§3.4). Auf dem Server
 * steht MIGRATIONS_DIR auf "./migrations", neben app.js.
 */
export function runMigrations(db: Db, migrationsFolder?: string): void {
  const folder = migrationsFolder ?? process.env["MIGRATIONS_DIR"] ?? DEFAULT_MIGRATIONS_DIR;
  migrate(db, { migrationsFolder: resolve(process.cwd(), folder) });
}
