# Beispiel-Medien aus dem Seed entfernen — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `seed()` legt keine Platzhalter-Medien mehr an, und eine Aufräum-Migration entfernt sie aus Bestandsdatenbanken — sofern keine Meldung auf sie zeigt.

**Architecture:** Zwei unabhängig prüfbare Schritte: (1) `DEFAULT_OUTLETS` samt Schleife aus `seed()` streichen, betroffene Tests legen ihre Medien selbst über `createOutlet` an; (2) eine Drizzle-Custom-Migration löscht die drei Platzhalter-Domains aus Bestandsdatenbanken. Spec: `docs/superpowers/specs/2026-08-06-beispiel-medien-entfernen-design.md`.

**Tech Stack:** TypeScript (strict), Drizzle ORM 1.0.0-rc mit `node:sqlite`, Vitest, drizzle-kit (Migrationsordner `packages/api/src/db/migrations/<zeitstempel>_<name>/migration.sql`).

## Global Constraints

- TypeScript strict. Kein `any`, kein `as` außer in Typ-Guards. (CLAUDE.md)
- Datenbankänderungen nur über Drizzle-Migrationen. (CLAUDE.md)
- `tests/fixtures/**` nur ergänzen; `fixtures.local/**`, `.env` nicht anfassen. (CLAUDE.md)
- Kommentare/Bezeichner auf Deutsch, wie im Bestand.
- Alle Befehle vom Repo-Stamm `/Users/uli/github projects/corrections` aus, sofern nicht anders angegeben.

---

### Task 1: `seed()` sät keine Medien mehr; Tests legen ihre Medien selbst an

**Files:**
- Modify: `packages/api/src/db/seed.ts` (Zeilen 42–46 `DEFAULT_OUTLETS`, Zeilen 66–87 Schleife, Importe Zeile 4)
- Modify: `packages/api/src/db/seed.test.ts`
- Modify: `packages/api/src/routes/capture.test.ts` (beforeEach, Zeilen 18–35)
- Modify: `packages/api/src/repo/corrections.test.ts` (beforeEach, Zeilen 40–57)
- Modify: `packages/api/src/routes/bilanz.test.ts` (beforeEach, Zeilen 20–24)
- Modify: `packages/api/src/repo/bilanz.test.ts` (beforeEach, Zeilen 15–19)

**Interfaces:**
- Consumes: `createOutlet(db, input: OutletInput, now: number): OutletRecord` aus `packages/api/src/repo/outlets.ts` — `OutletInput` = `{ name; primaryDomain; publisher: string | null; country: string | null; notes: string | null; contactEmails: string[] }`.
- Produces: `seed(db)` sät nur noch Fehlerarten (Signatur unverändert). `DEFAULT_ERROR_TYPES` bleibt exportiert. `DEFAULT_OUTLETS` existiert danach nicht mehr — nichts darf mehr darauf zeigen.

- [ ] **Step 1: Failing Test — seed legt keine Medien an**

In `packages/api/src/db/seed.test.ts` die beiden Outlet-Tests ersetzen. Alt (Zeilen 26–39):

```ts
  it("legt drei Redaktionen mit je einer Domain an", () => {
    const db = freshDb();
    seed(db);
    expect(db.select().from(outlets).all()).toHaveLength(3);
    expect(db.select().from(outletDomains).all()).toHaveLength(3);
  });

  it("ist mehrfach ausführbar, ohne zu duplizieren", () => {
    const db = freshDb();
    seed(db);
    seed(db);
    expect(db.select().from(errorTypes).all()).toHaveLength(DEFAULT_ERROR_TYPES.length);
    expect(db.select().from(outlets).all()).toHaveLength(3);
  });
```

Neu:

```ts
  it("legt keine Medien an — Stammdaten kommen aus medien.json, Tests bauen eigene", () => {
    const db = freshDb();
    seed(db);
    expect(db.select().from(outlets).all()).toHaveLength(0);
    expect(db.select().from(outletDomains).all()).toHaveLength(0);
  });

  it("ist mehrfach ausführbar, ohne zu duplizieren", () => {
    const db = freshDb();
    seed(db);
    seed(db);
    expect(db.select().from(errorTypes).all()).toHaveLength(DEFAULT_ERROR_TYPES.length);
  });
```

- [ ] **Step 2: Test laufen lassen — muss fehlschlagen**

Run: `pnpm exec vitest run packages/api/src/db/seed.test.ts  # vom Repo-Stamm: runMigrations loest relativ zum cwd auf`
Expected: FAIL — „legt keine Medien an“ erwartet 0, bekommt 3.

- [ ] **Step 3: `seed.ts` verschlanken**

In `packages/api/src/db/seed.ts`:
- Den Block `const DEFAULT_OUTLETS = [ … ] as const;` (Zeilen 42–46) ersatzlos streichen.
- Die Schleife `for (const entry of DEFAULT_OUTLETS) { … }` (Zeilen 66–87) ersatzlos streichen.
- Import in Zeile 4 auf `import { errorTypes } from "./schema.js";` kürzen (`outletDomains`, `outlets` entfallen).
- `createId` und `eq` bleiben — die Fehlerarten-Schleife braucht beide.

- [ ] **Step 4: Seed-Tests laufen lassen — müssen bestehen**

Run: `pnpm exec vitest run packages/api/src/db/seed.test.ts  # vom Repo-Stamm: runMigrations loest relativ zum cwd auf`
Expected: PASS (4 Tests).

- [ ] **Step 5: Gesamtsuite laufen lassen — zeigt die abhängigen Brüche**

Run: `pnpm test`
Expected: FAIL in `capture.test.ts` und `corrections.test.ts` („Seed-Outlet fehlt“) sowie in beiden `bilanz.test.ts` („Seed unvollstaendig“ / „Seed ohne Medien“). `backfillImport.test.ts` und `admin/backfill.test.ts` bleiben grün — deren Medien entstehen über `ensureOutletForHost` beim Import. Fällt dort doch etwas um, den Bruch ansehen und nach demselben Muster (eigenes Medium via `createOutlet`) beheben.

- [ ] **Step 6: `capture.test.ts` — Medium selbst anlegen**

In `packages/api/src/routes/capture.test.ts`, im `beforeEach` diesen Block ersetzen. Alt (nach `seed(db);`):

```ts
  // seed() legt "beispiel-zeitung.de" bereits ohne Kontaktadresse an (DEFAULT_OUTLETS
  // in db/seed.ts); ein zweites createOutlet() fuer dieselbe Domain wuerde die
  // Unique-Constraint auf outlet_domains.domain verletzen (siehe repo/corrections.test.ts).
  // Stattdessen wird die Kontaktadresse auf dem vorhandenen Outlet nachgetragen.
  const seeded = resolveOutletByHost(db, "beispiel-zeitung.de");
  if (!seeded) throw new Error("Seed-Outlet fehlt");
  updateOutlet(db, seeded.id, {
    name: seeded.name,
    primaryDomain: seeded.primaryDomain,
    publisher: seeded.publisher,
    country: seeded.country,
    notes: seeded.notes,
    contactEmails: ["leserbriefe@beispiel-zeitung.de"],
  });
```

Neu:

```ts
  // seed() saet nur Fehlerarten; das Testmedium samt Kontaktadresse entsteht hier.
  createOutlet(
    db,
    {
      name: "Beispiel-Zeitung",
      primaryDomain: "beispiel-zeitung.de",
      publisher: null,
      country: null,
      notes: null,
      contactEmails: ["leserbriefe@beispiel-zeitung.de"],
    },
    Math.floor(Date.now() / 1000),
  );
```

Import in Zeile 8 anpassen: `import { createOutlet } from "../repo/outlets.js";` (`resolveOutletByHost`, `updateOutlet` entfallen, falls sonst ungenutzt — mit `grep -n "resolveOutletByHost\|updateOutlet" packages/api/src/routes/capture.test.ts` prüfen).

Der Name muss exakt `"Beispiel-Zeitung"` bleiben — der Test erwartet „Liebe Beispiel-Zeitung-Redaktion,“ (Zeile 143).

- [ ] **Step 7: `corrections.test.ts` — gleiches Muster**

In `packages/api/src/repo/corrections.test.ts`, im `beforeEach` denselben Alt-Block (Kommentar + `resolveOutletByHost` + `updateOutlet`, Zeilen 43–56) durch denselben Neu-Block aus Step 6 ersetzen — mit einem Unterschied: Der Import kommt aus dem Nachbarmodul, Zeile 9 wird zu `import { createOutlet } from "./outlets.js";` (auch hier zuerst prüfen, ob `resolveOutletByHost`/`updateOutlet` an anderer Stelle der Datei vorkommen).

- [ ] **Step 8: Beide `bilanz.test.ts` — drei Medien im beforeEach**

In `packages/api/src/routes/bilanz.test.ts` und `packages/api/src/repo/bilanz.test.ts` jeweils im `beforeEach` nach `seed(db);` ergänzen:

```ts
  /* seed() saet nur Fehlerarten; die Tests brauchen bis zu drei Medien. */
  for (const [name, domain] of [
    ["Beispiel-Zeitung", "beispiel-zeitung.de"],
    ["Muster-Magazin", "muster-magazin.de"],
    ["Probe-Anzeiger", "probe-anzeiger.de"],
  ] as const) {
    createOutlet(
      db,
      { name, primaryDomain: domain, publisher: null, country: null, notes: null, contactEmails: [] },
      ALT,
    );
  }
```

`ALT` ist in beiden Dateien bereits als Epoch-Konstante definiert. Import ergänzen: in `routes/bilanz.test.ts` `import { createOutlet } from "../repo/outlets.js";`, in `repo/bilanz.test.ts` `import { createOutlet } from "./outlets.js";`. Die Helfer `meldung()`/`ersteMedien()` bleiben unverändert — sie lesen weiter aus `outlets`. Kein gemeinsamer Testhelfer: nur zwei Nutzer mit identischem Vier-Zeilen-Bedarf, und Nicht-`.test.ts`-Dateien in `src/` landen im Build (tsconfig schließt nur `*.test.ts` aus).

- [ ] **Step 9: Gesamtsuite, Typecheck, Lint**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: PASS überall (279 Tests, Stand vor dieser Änderung; die Zahl darf durch Umformulierung leicht abweichen, aber nichts rot).

- [ ] **Step 10: Commit**

```bash
git add packages/api/src/db/seed.ts packages/api/src/db/seed.test.ts packages/api/src/routes/capture.test.ts packages/api/src/repo/corrections.test.ts packages/api/src/routes/bilanz.test.ts packages/api/src/repo/bilanz.test.ts
git commit -m "seed() saet keine Beispiel-Medien mehr

Stammdaten kommen seit dem 6.8. aus medien.json; die Platzhalter
erschienen nie oeffentlich und standen nur als Karteileichen im Admin.
Tests legen ihre Medien jetzt selbst an.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Aufräum-Migration für Bestandsdatenbanken

**Files:**
- Create: `packages/api/src/db/migrations/<zeitstempel>_beispiel-medien-entfernen/migration.sql` (Ordnername erzeugt drizzle-kit)
- Test: `packages/api/src/db/beispielMedienMigration.test.ts`

**Interfaces:**
- Consumes: `createDb`, `runMigrations` aus `./client.js` (`Db` hat `$client: DatabaseSync` mit `.exec(sql: string)`); `createOutlet` aus `../repo/outlets.js` (Signatur siehe Task 1); Tabellen `outlets`, `outletDomains`, `corrections`, `errorTypes` aus `./schema.js`; `seed` aus `./seed.js` (für Fehlerarten).
- Produces: nur die Migrationsdatei — kein Code-Interface. Spätere Tasks gibt es nicht.

- [ ] **Step 1: Custom-Migration erzeugen**

```bash
cd packages/api && pnpm exec drizzle-kit generate --custom --name=beispiel-medien-entfernen
```

Expected: neuer Ordner `src/db/migrations/<zeitstempel>_beispiel-medien-entfernen/` mit leerer `migration.sql`. Mit `ls src/db/migrations/` prüfen. (Falls drizzle-kit stattdessen nach dem alten Layout eine flache `.sql`-Datei anlegt, das tatsächlich erzeugte Layout beibehalten — maßgeblich ist, dass `runMigrations` sie findet; Step 4 beweist das.)

- [ ] **Step 2: Migrations-SQL schreiben**

Inhalt der erzeugten `migration.sql` (ersetzen, sie ist leer):

```sql
-- Die drei Platzhalter aus dem fruehen seed() (vor medien.json) verschwinden
-- aus Bestandsdatenbanken -- aber nur, wenn keine Meldung auf sie zeigt.
-- Zeigt doch eine darauf, bleibt das Medium samt Domain unangetastet.
DELETE FROM `outlet_domains` WHERE `outlet_id` IN (
  SELECT `id` FROM `outlets`
  WHERE `primary_domain` IN ('beispiel-zeitung.de', 'muster-magazin.de', 'probe-anzeiger.de')
    AND `id` NOT IN (SELECT `outlet_id` FROM `corrections`)
);
--> statement-breakpoint
DELETE FROM `outlets`
WHERE `primary_domain` IN ('beispiel-zeitung.de', 'muster-magazin.de', 'probe-anzeiger.de')
  AND `id` NOT IN (SELECT `outlet_id` FROM `corrections`);
```

(Die `outlet_domains`-Löschung wäre per `ON DELETE CASCADE` meist implizit, steht aber explizit da — Migrationen laufen nicht überall garantiert mit `PRAGMA foreign_keys = ON`.)

- [ ] **Step 3: Failing Test — Migration löscht Platzhalter, schont Genutztes**

Neue Datei `packages/api/src/db/beispielMedienMigration.test.ts`:

```ts
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createId } from "@paralleldrive/cuid2";
import { describe, expect, it } from "vitest";
import { createOutlet } from "../repo/outlets.js";
import { createDb, runMigrations } from "./client.js";
import { corrections, errorTypes, outletDomains, outlets } from "./schema.js";
import { seed } from "./seed.js";

const MIGRATIONS = "packages/api/src/db/migrations";

/**
 * runMigrations() fuehrt jede Migration nur einmal aus -- auf einer frischen
 * Datenbank laeuft die Aufraeum-Migration also ueber leere Tabellen. Der Test
 * spielt deshalb den Bestandsfall nach: erst Daten anlegen, dann das SQL der
 * Migration direkt ausfuehren.
 */
function migrationSql(): string[] {
  const ordner = readdirSync(MIGRATIONS).find((name) =>
    name.endsWith("_beispiel-medien-entfernen"),
  );
  if (!ordner) throw new Error("Migration beispiel-medien-entfernen fehlt");
  return readFileSync(join(MIGRATIONS, ordner, "migration.sql"), "utf8")
    .split("--> statement-breakpoint")
    .map((teil) => teil.trim())
    .filter((teil) => teil.length > 0);
}

describe("Migration beispiel-medien-entfernen", () => {
  it("loescht Platzhalter ohne Meldungen und laesst alles andere stehen", () => {
    const db = createDb(":memory:");
    runMigrations(db);
    seed(db);
    const jetzt = 1_754_000_000;

    // Platzhalter ohne Meldung: soll verschwinden.
    createOutlet(
      db,
      { name: "Beispiel-Zeitung", primaryDomain: "beispiel-zeitung.de", publisher: null, country: null, notes: null, contactEmails: [] },
      jetzt,
    );
    // Platzhalter MIT Meldung: soll bleiben.
    const muster = createOutlet(
      db,
      { name: "Muster-Magazin", primaryDomain: "muster-magazin.de", publisher: null, country: null, notes: null, contactEmails: [] },
      jetzt,
    );
    // Echtes Medium ohne Meldung: darf die Migration nicht anfassen.
    createOutlet(
      db,
      { name: "taz", primaryDomain: "taz.de", publisher: null, country: null, notes: null, contactEmails: [] },
      jetzt,
    );

    const fehlerart = db.select().from(errorTypes).all()[0];
    if (!fehlerart) throw new Error("Seed ohne Fehlerarten");
    const meldungsId = createId();
    db.insert(corrections)
      .values({
        id: meldungsId,
        ref: `K${meldungsId.slice(0, 5).toUpperCase()}`,
        idempotencyKey: meldungsId,
        createdAt: jetzt,
        dispatchMode: "smtp",
        articleUrl: "https://muster-magazin.de/a",
        articleUrlCanon: "https://muster-magazin.de/a",
        outletId: muster.id,
        errorTypeId: fehlerart.id,
        severity: 2,
        quoteBefore: "falsch",
        suggestionAfter: "richtig",
        recipientEmail: "korrektur@muster-magazin.de",
        dispatchStatus: "sent",
        sentAt: jetzt,
        source: "backfill",
      })
      .run();

    for (const anweisung of migrationSql()) db.$client.exec(anweisung);

    const domains = db.select().from(outletDomains).all().map((zeile) => zeile.domain);
    expect(db.select().from(outlets).all().map((zeile) => zeile.primaryDomain).sort()).toEqual([
      "muster-magazin.de",
      "taz.de",
    ]);
    expect(domains.sort()).toEqual(["muster-magazin.de", "taz.de"]);
    expect(db.select().from(corrections).all()).toHaveLength(1);
  });
});
```

Hinweis: `MIGRATIONS` ist relativ zum Repo-Stamm — Vitest läuft hier mit `cwd` = Repo-Stamm, genau wie `runMigrations` mit seiner Vorgabe `./packages/api/src/db/migrations` (siehe `client.ts`). Schlägt der Pfad fehl, stimmt das `cwd` nicht — dann nicht den Test verbiegen, sondern den Aufruf.

- [ ] **Step 4: Test laufen lassen — Stand prüfen**

Run: `pnpm exec vitest run packages/api/src/db/beispielMedienMigration.test.ts  # vom Repo-Stamm: runMigrations loest relativ zum cwd auf`
Expected vor Step 1+2: FAIL („Migration beispiel-medien-entfernen fehlt“). Nach Step 1+2: PASS. (Wer strikt rot-grün arbeitet: Step 3 vor Step 1+2 ziehen — die Reihenfolge oben gruppiert nur die Drizzle-Schritte.)

- [ ] **Step 5: Gesamtsuite, Typecheck, Lint**

Run: `pnpm test && pnpm typecheck && pnpm lint`
Expected: PASS überall. Wichtig: `runMigrations` läuft in jedem Test — die neue Migration muss auf leerer Datenbank fehlerfrei durchlaufen (tut sie: beide `DELETE`s treffen dann nichts).

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/db/migrations packages/api/src/db/beispielMedienMigration.test.ts
git commit -m "Migration raeumt die drei Beispiel-Medien aus Bestandsdatenbanken

Nur wenn keine Meldung auf sie zeigt; sonst bleibt alles stehen.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Betriebsnotiz (kein Task)

Das Deployment liefert `packages/api/src/db/migrations` als `build/migrations` mit aus (`.github/workflows/deploy.yml`, Schritt „Migrationen mitliefern“); auf dem Server zeigt `MIGRATIONS_DIR` auf `./migrations`. Beim ersten Start nach dem Deploy läuft die Aufräum-Migration einmal — mehr ist nicht zu tun. Ein DB-Reset (Memory `netcup-server-eigenheiten`) ist ausdrücklich **nicht** nötig.
