# Korrektur-Tracker P0–P2 — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein lauffähiges System, in dem eine Korrekturmeldung über ein Web-Formular erfasst, mit Kontext-Ankern angereichert, in der Datenbank abgelegt und per SMTP an die Redaktion versendet wird — inklusive pflegbarer Stammdaten für Redaktionen und Fehlerarten.

**Architecture:** Zwei Einstiegspunkte auf einem Codestand — `app.js` fuer Passenger, `worker.js` fuer den Cronjob —, eine SQLite-Datei. Hono bedient API und serverseitig gerendertes HTML (JSX), Drizzle spricht ueber `node:sqlite`, den in Node eingebauten Treiber. Keine native Abhaengigkeit. Reine Funktionen (URL-Kanonisierung, Textnormalisierung, Ankerbildung, Mailkomposition) liegen ohne IO in eigenen Modulen und sind einzeln getestet; IO ist auf `article/fetch.ts`, `dispatch/send.ts` und `db/client.ts` beschränkt.

**Tech Stack:** TypeScript (strict), Node 26 auf dem Ziel, pnpm workspaces, Hono + `@hono/node-server`, Drizzle ORM + `node:sqlite`, Zod, Nodemailer, `@mozilla/readability` + `linkedom`, Vitest, esbuild, GitHub Actions.

**Zielumgebung:** netcup Webhosting 4000, Plesk, Node 26.5, kein Docker, kein Root. Gebaut wird auf dem Runner, hochgeladen wird ein fertiges Buendel.

**Referenz-Spec:** `docs/superpowers/specs/2026-08-01-korrektur-tracker-design.md`. Abschnittsverweise (§) beziehen sich darauf.

---

## Global Constraints

Diese gelten für **jede** Aufgabe, auch wenn sie dort nicht wiederholt werden.

- **TypeScript strict.** Kein `any`, kein `as` außer in Typ-Guards. `noUncheckedIndexedAccess: true`.
- **Zod-Schemas leben ausschließlich in `packages/shared`.** Keine parallelen Interfaces. Typen werden mit `z.infer` abgeleitet.
- **Reine Funktionen ohne IO.** Netz, Datei und Datenbank nur in `db/client.ts`, `article/fetch.ts`, `dispatch/send.ts`, `repo/*.ts`. Parser, Normalisierer, Ankerbildung und Mailkomposition sind rein und ohne Mock testbar.
- **Zeitstempel sind UTC-Epoch-Sekunden (`integer`)** in der Datenbank. Formatierung ausschließlich in der Darstellung.
- **Keine Personendaten in öffentlich erreichbaren Bereichen** (§2.1). `author` wird nirgends erhoben, gespeichert oder aus HTML extrahiert. Öffentliche Antworten serialisieren ausschließlich den Typ `PublicCorrection`.
- **Datenbankänderungen nur über Drizzle-Migrationen.** Kein manuelles SQL gegen die Live-Datei. Ausnahme: die Kennzahlen-Views, die beim Start deterministisch aus TS-Konstanten neu erzeugt werden (Task 9).
- **Nie echte Mailinhalte, Adressen oder Tokens committen.** Testfixtures sind synthetisch. `fixtures.local/` ist gitignored.
- **`ref`-Format:** `K` + 5 Zeichen Crockford-Base32 (Alphabet ohne `I`, `L`, `O`, `U`). Regex: `/^K[0-9A-HJKMNP-TV-Z]{5}$/`.
- **`quote_before` maximal 200 Zeichen** (§12, Zitatrecht).
- **Reifegrenze 14 Tage, Mindest-n für angezeigte Quoten 10, Konfidenzniveau 95 %** — als benannte Konstanten in `packages/shared/src/constants.ts`, nirgends als Literal.
- **Commit-Sprache:** Deutsch, Präsens, Imperativ. Jeder Task endet mit genau einem Commit.

### Abweichungen von der Spec, bewusst getroffen

1. **§4 sieht `packages/web` (Vite + React) vor.** In P0–P2 entsteht dort noch nichts. Erfassungs- und Adminformulare werden mit Honos JSX **serverseitig gerendert** (`packages/api/src/views/`) — kein Client-Bundle, kein SPA-Routing, funktioniert auf jedem Gerät. `packages/web` wird erst in P6 für das öffentliche Dashboard mit Tabelle und Charts angelegt, wo es tatsächlich gebraucht wird.
2. **Basic-Auth liegt auf Anwendungsebene**, nicht in einer Proxy-Middleware. Auf gemanagtem Hosting gibt es keinen eigenen Reverse Proxy zum Konfigurieren; TLS liefert Plesk.
3. **Die Stammdatenformulare stehen in §14 unter P6.** Sie werden nach P2 vorgezogen: ohne pflegbare Kontaktadressen kann P2 nichts versenden.

---

## File Structure

```
korrektur-tracker/
├─ package.json                       # Workspace-Root, Skripte
├─ pnpm-workspace.yaml
├─ tsconfig.base.json                 # strict, Basis für alle Pakete
├─ vitest.workspace.ts
├─ eslint.config.js
├─ .github/workflows/deploy.yml
├─ .env.example
├─ .claudeignore
├─ CLAUDE.md
│
├─ packages/shared/
│  ├─ package.json, tsconfig.json
│  └─ src/
│     ├─ index.ts                     # Re-Exports
│     ├─ constants.ts                 # Reifegrenze, n-Schwelle, Konfidenz, Längen
│     ├─ url.ts                       # canonicalizeUrl, extractHost
│     ├─ text.ts                      # normalizeText
│     ├─ ref.ts                       # generateRef, REF_PATTERN, isRef
│     ├─ stats.ts                     # wilsonInterval, rateOrNull
│     └─ schemas.ts                   # Zod: Erfassung, Outlet, Fehlerart
│
├─ packages/api/
│  ├─ package.json, tsconfig.json, drizzle.config.ts
│  └─ src/
│     ├─ index.ts                     # Bootstrap: Migration, Views, Server
│     ├─ app.ts                       # Hono-Zusammenbau
│     ├─ env.ts                       # Zod-geprüfte Umgebung
│     ├─ auth.ts                      # Basic-Auth-Middleware
│     ├─ db/
│     │  ├─ client.ts                 # node:sqlite + Drizzle
│     │  ├─ schema.ts                 # Tabellen
│     │  ├─ views.ts                  # View-SQL aus Konstanten erzeugen
│     │  ├─ seed.ts                   # 12 Fehlerarten, 3 Outlets
│     │  └─ migrations/               # von drizzle-kit erzeugt
│     ├─ repo/
│     │  ├─ outlets.ts                # Auflösung, Auto-Anlage, CRUD
│     │  ├─ errorTypes.ts             # CRUD
│     │  ├─ corrections.ts            # Anlage, Idempotenz, ref-Retry
│     │  └─ stats.ts                  # Abfragen gegen die Views
│     ├─ article/
│     │  ├─ extract.ts                # rein: HTML → Klartext
│     │  ├─ anchor.ts                 # rein: Anker ableiten
│     │  └─ fetch.ts                  # IO: HTTP-Abruf
│     ├─ dispatch/
│     │  ├─ compose.ts                # rein: Betreff + Body
│     │  └─ send.ts                   # IO: Nodemailer
│     ├─ serialize/
│     │  └─ public.ts                 # PublicCorrection + Feld-Sperrliste
│     ├─ routes/
│     │  ├─ health.ts
│     │  ├─ capture.ts                # GET/POST /neu
│     │  └─ admin/
│     │     ├─ outlets.ts
│     │     └─ errorTypes.ts
│     └─ views/
│        ├─ layout.tsx
│        ├─ capture.tsx
│        ├─ outlets.tsx
│        └─ errorTypes.tsx
│
├─ tests/fixtures/                    # synthetische HTML-Dateien
└─ fixtures.local/                    # gitignored, echte Daten
```

---

# Phase P0 — Gerüst

### Task 1: Workspace, TypeScript, Vitest

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `vitest.workspace.ts`, `eslint.config.js`
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/src/constants.ts`, `packages/shared/src/index.ts`
- Test: `packages/shared/src/constants.test.ts`

**Interfaces:**
- Consumes: nichts
- Produces: `MATURITY_DAYS: 14`, `MIN_N_FOR_RATE: 10`, `CONFIDENCE_Z: 1.96`, `QUOTE_MAX_LENGTH: 200`, `ANCHOR_LENGTH: 48`, `MATURITY_SECONDS: number` aus `@korrektur/shared`

- [ ] **Step 1: pnpm bereitstellen**

`pnpm` ist auf dieser Maschine nicht installiert. Über Corepack aktivieren:

```bash
corepack enable
corepack prepare pnpm@9 --activate
pnpm --version
```

Erwartet: eine 9er-Version.

- [ ] **Step 2: Workspace-Root anlegen**

`package.json`:

```json
{
  "name": "korrektur-tracker",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@9.15.0",
  "engines": { "node": ">=22" },
  "scripts": {
    "build": "pnpm -r build",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint .",
    "typecheck": "pnpm -r typecheck"
  },
  "devDependencies": {
    "@eslint/js": "^9.17.0",
    "typescript": "^5.7.2",
    "typescript-eslint": "^8.18.0",
    "eslint": "^9.17.0",
    "vitest": "^2.1.8"
  }
}
```

`pnpm-workspace.yaml`:

```yaml
packages:
  - "packages/*"
```

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "declaration": true,
    "sourceMap": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

`vitest.workspace.ts`:

```ts
export default ["packages/*"];
```

`eslint.config.js`:

```js
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/migrations/**", "fixtures.local/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
);
```

- [ ] **Step 3: shared-Paket anlegen**

`packages/shared/package.json`:

```json
{
  "name": "@korrektur/shared",
  "version": "0.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": { "zod": "^3.24.1" }
}
```

`packages/shared/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src/**/*"],
  "exclude": ["src/**/*.test.ts"]
}
```

- [ ] **Step 4: Den fehlschlagenden Test schreiben**

`packages/shared/src/constants.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  ANCHOR_LENGTH,
  CONFIDENCE_Z,
  MATURITY_DAYS,
  MATURITY_SECONDS,
  MIN_N_FOR_RATE,
  QUOTE_MAX_LENGTH,
} from "./constants.js";

describe("constants", () => {
  it("hält die in der Spec festgelegten Werte", () => {
    expect(MATURITY_DAYS).toBe(14);
    expect(MIN_N_FOR_RATE).toBe(10);
    expect(CONFIDENCE_Z).toBeCloseTo(1.96, 2);
    expect(QUOTE_MAX_LENGTH).toBe(200);
    expect(ANCHOR_LENGTH).toBe(48);
  });

  it("leitet die Reifegrenze in Sekunden aus den Tagen ab", () => {
    expect(MATURITY_SECONDS).toBe(MATURITY_DAYS * 24 * 60 * 60);
  });
});
```

- [ ] **Step 5: Test laufen lassen, Fehlschlag bestätigen**

```bash
pnpm install
pnpm vitest run packages/shared/src/constants.test.ts
```

Erwartet: FAIL — `Failed to resolve import "./constants.js"`.

- [ ] **Step 6: Konstanten implementieren**

`packages/shared/src/constants.ts`:

```ts
/** Eine Meldung zählt erst nach dieser Frist in einen Quoten-Nenner (§9.3). */
export const MATURITY_DAYS = 14;
export const MATURITY_SECONDS = MATURITY_DAYS * 24 * 60 * 60;

/** Unterhalb dieser Fallzahl wird keine Quote angezeigt, nur Rohzahlen (§9.4). */
export const MIN_N_FOR_RATE = 10;

/** z-Wert für das 95-%-Wilson-Intervall (§9.4). */
export const CONFIDENCE_Z = 1.959964;

/** Obergrenze für zitierte Fundstellen, Zitatrecht (§12). */
export const QUOTE_MAX_LENGTH = 200;

/** Zeichen vor und nach der Fundstelle je Kontext-Anker (§8.1). */
export const ANCHOR_LENGTH = 48;
```

`packages/shared/src/index.ts`:

```ts
export * from "./constants.js";
```

- [ ] **Step 7: Test laufen lassen, Erfolg bestätigen**

```bash
pnpm vitest run packages/shared/src/constants.test.ts
pnpm typecheck
pnpm lint
```

Erwartet: 2 Tests grün, Typecheck und Lint ohne Befund.

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json vitest.workspace.ts eslint.config.js packages/shared pnpm-lock.yaml
git commit -m "Monorepo-Geruest mit shared-Paket und Kennzahlen-Konstanten"
```

---

### Task 2: Hono-Server, Passenger-Einstiegspunkt, Deploy-Workflow

**Files:**
- Create: `packages/api/package.json`, `packages/api/tsconfig.json`
- Create: `packages/api/src/env.ts`, `packages/api/src/app.ts`, `packages/api/src/web.ts`, `packages/api/src/worker.ts`, `packages/api/src/routes/health.ts`
- Create: `.github/workflows/deploy.yml`, `.env.example`, `.claudeignore`
- Test: `packages/api/src/routes/health.test.ts`

**Interfaces:**
- Consumes: `@korrektur/shared`
- Produces: `createApp(): Hono` aus `packages/api/src/app.ts`; `loadEnv(source?: Record<string, string | undefined>): Env` aus `packages/api/src/env.ts` mit `Env = { PORT: number; DATABASE_PATH: string; MIGRATIONS_DIR: string; ADMIN_USER: string; ADMIN_PASSWORD: string; PUBLIC_BASE_URL: string; SMTP_HOST: string; SMTP_PORT: number; SMTP_USER: string; SMTP_PASSWORD: string; MAIL_FROM: string }`

**Zielumgebung:** netcup Webhosting mit Plesk, Node 26.5, kein Docker, kein Root. Gebaut wird auf dem GitHub-Runner, hochgeladen wird ein fertiges Bündel. Auf dem Server läuft weder npm noch ein Compiler.

- [ ] **Step 1: api-Paket anlegen**

`packages/api/package.json`:

```json
{
  "name": "@korrektur/api",
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "dev": "node --watch --experimental-strip-types src/web.ts"
  },
  "dependencies": {
    "@hono/node-server": "^1.13.7",
    "@korrektur/shared": "workspace:*",
    "hono": "^4.6.14",
    "zod": "^3.24.1"
  }
}
```

`packages/api/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "jsx": "react-jsx",
    "jsxImportSource": "hono/jsx"
  },
  "include": ["src/**/*"],
  "exclude": ["src/**/*.test.ts", "src/**/*.test.tsx"],
  "references": [{ "path": "../shared" }]
}
```

Bündler im Workspace-Root ergänzen:

```bash
pnpm add -Dw esbuild
```

- [ ] **Step 2: Den fehlschlagenden Test schreiben**

`packages/api/src/routes/health.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";

describe("GET /healthz", () => {
  it("antwortet mit 200 und Status ok", async () => {
    const app = createApp();
    const res = await app.request("/healthz");
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: "ok" });
  });
});
```

- [ ] **Step 3: Test laufen lassen, Fehlschlag bestätigen**

```bash
pnpm vitest run packages/api/src/routes/health.test.ts
```

Erwartet: FAIL — `Failed to resolve import "../app.js"`.

- [ ] **Step 4: Umgebung, Route und App implementieren**

`packages/api/src/env.ts`:

```ts
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_PATH: z.string().min(1).default("./data/korrektur.db"),
  /** Explizit, weil das CJS-Buendel kein import.meta.url kennt (Task 7). */
  MIGRATIONS_DIR: z.string().min(1).default("./packages/api/src/db/migrations"),
  ADMIN_USER: z.string().min(1),
  ADMIN_PASSWORD: z.string().min(8),
  PUBLIC_BASE_URL: z.string().url(),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().min(1),
  SMTP_PASSWORD: z.string().min(1),
  MAIL_FROM: z.string().email(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Unvollständige oder ungültige Umgebung: ${fields}`);
  }
  return parsed.data;
}
```

`packages/api/src/routes/health.ts`:

```ts
import { Hono } from "hono";

export const health = new Hono().get("/healthz", (c) => c.json({ status: "ok" }));
```

`packages/api/src/app.ts`:

```ts
import { Hono } from "hono";
import { health } from "./routes/health.js";

export function createApp(): Hono {
  const app = new Hono();
  app.route("/", health);
  return app;
}
```

- [ ] **Step 5: Die beiden Einstiegspunkte anlegen**

Getrennt sein müssen sie, weil Passenger den Webprozess bei Inaktivität herunterfährt — ein In-Process-Timer würde still aufhören zu laufen (§3.4).

`packages/api/src/web.ts`:

```ts
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { loadEnv } from "./env.js";

const env = loadEnv();

// Passenger reicht den Port über PORT herein und fängt listen() ab.
serve({ fetch: createApp().fetch, port: env.PORT }, (info) => {
  console.log(JSON.stringify({ level: "info", msg: "web gestartet", port: info.port }));
});
```

`packages/api/src/worker.ts`:

```ts
import { loadEnv } from "./env.js";

/**
 * Wird vom Plesk-Cronjob aufgerufen, läuft kurz und endet.
 * IMAP-Poll kommt in P3, Artikel-Checks in P5 hinzu.
 */
function main(): void {
  loadEnv();
  console.log(JSON.stringify({ level: "info", msg: "worker gelaufen", tasks: [] }));
}

main();
```

- [ ] **Step 6: Test laufen lassen, Erfolg bestätigen**

```bash
pnpm install
pnpm vitest run packages/api/src/routes/health.test.ts
```

Erwartet: PASS.

- [ ] **Step 7: Bündel-Skript ergänzen**

Gebündelt wird nach **CommonJS**: Passengers Node-Unterstützung lädt die Startdatei über einen eigenen Shim, und das ist mit CJS verlässlich. Im Zielverzeichnis liegt bewusst keine `package.json` — ein gebündeltes CJS-Skript braucht keine.

Root-`package.json` um ein Skript ergänzen:

```json
"bundle": "esbuild packages/api/src/web.ts packages/api/src/worker.ts --bundle --platform=node --format=cjs --target=node22 --outdir=build --out-extension:.js=.js && node -e \"require('node:fs').mkdirSync('build/tmp',{recursive:true})\""
```

`esbuild` behandelt `node:`-Builtins automatisch als extern — `node:sqlite` aus Task 7 wird also nicht mitgebündelt, sondern zur Laufzeit von Node 26 bereitgestellt.

Ergebnis in `build/`:

```
web.js        → wird beim Deploy zu app.js
worker.js     → Ziel des Cronjobs
tmp/          → für restart.txt
```

- [ ] **Step 8: Umgebungsvorlage anlegen**

`.env.example`:

```
PORT=3000
DATABASE_PATH=./data/korrektur.db
MIGRATIONS_DIR=./packages/api/src/db/migrations
PUBLIC_BASE_URL=https://korrekturen.msmr.co

ADMIN_USER=admin
ADMIN_PASSWORD=bitte-aendern-mindestens-8-zeichen

SMTP_HOST=mail.example.tld
SMTP_PORT=587
SMTP_USER=korrektur@example.tld
SMTP_PASSWORD=passwort-aus-plesk
MAIL_FROM=korrektur@example.tld
```

Auf dem Server wird **keine** dieser Dateien abgelegt. Die Werte trägt man in Plesk unter *Node.js → Benutzerdefinierte Umgebungsvariablen* ein; Passenger reicht sie an den Prozess weiter. `DATABASE_PATH` zeigt dort auf einen Pfad **außerhalb** von `httpdocs`, sonst wäre die Datenbank über die Domain abrufbar (§13).

`.claudeignore`:

```
.env
fixtures.local/
data/
build/
```

- [ ] **Step 9: Deploy-Workflow anlegen**

`.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: deploy
  cancel-in-progress: false

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - name: pnpm bereitstellen
        run: corepack enable && corepack prepare pnpm@9 --activate

      - name: Abhängigkeiten installieren
        run: pnpm install --frozen-lockfile

      - name: Prüfen
        run: |
          pnpm typecheck
          pnpm lint
          pnpm test

      - name: Bündeln
        run: pnpm bundle

      - name: Startdatei benennen
        run: mv build/web.js build/app.js

      - name: Migrationen mitliefern
        run: cp -r packages/api/src/db/migrations build/migrations || true

      - name: SSH vorbereiten
        run: |
          install -m 700 -d ~/.ssh
          printf '%s\n' "${{ secrets.NETCUP_SSH_KEY }}" > ~/.ssh/id_ed25519
          chmod 600 ~/.ssh/id_ed25519
          ssh-keyscan -H "${{ secrets.NETCUP_HOST }}" >> ~/.ssh/known_hosts

      - name: Hochladen
        run: |
          rsync -az --delete \
            --exclude 'tmp/' \
            -e "ssh -i ~/.ssh/id_ed25519" \
            build/ \
            "${{ secrets.NETCUP_USER }}@${{ secrets.NETCUP_HOST }}:${{ secrets.NETCUP_APP_ROOT }}/"

      - name: Anwendung neu starten
        run: |
          ssh -i ~/.ssh/id_ed25519 \
            "${{ secrets.NETCUP_USER }}@${{ secrets.NETCUP_HOST }}" \
            "mkdir -p '${{ secrets.NETCUP_APP_ROOT }}/tmp' && touch '${{ secrets.NETCUP_APP_ROOT }}/tmp/restart.txt'"
```

`--exclude 'tmp/'` ist wichtig: `--delete` würde sonst bei jedem Lauf das Verzeichnis leeren, in dem Passenger seine Neustart-Datei erwartet. Die Datenbank liegt aus demselben Grund außerhalb des Zielverzeichnisses.

Vier Secrets werden gebraucht — GitHub → Settings → Secrets and variables → Actions:

| Secret | Beispiel |
|---|---|
| `NETCUP_SSH_KEY` | Inhalt des privaten Deploy-Schlüssels |
| `NETCUP_HOST` | `ae8d9.netcup.net` |
| `NETCUP_USER` | `hosting189417` |
| `NETCUP_APP_ROOT` | `/korrekturen.msmr.co` |

- [ ] **Step 10: Server einrichten (einmalig, von Hand)**

1. **Subdomain anlegen**: Plesk → Websites & Domains → Subdomain hinzufügen.
2. **Deploy-Schlüssel hinterlegen**: lokal `ssh-keygen -t ed25519 -f ~/.ssh/netcup_deploy -N ""`, dann `ssh-copy-id -i ~/.ssh/netcup_deploy.pub BENUTZER@HOST`. Der private Teil wird zum Secret `NETCUP_SSH_KEY`, er verlässt den eigenen Rechner sonst nicht.
3. **Node.js aktivieren**: Plesk → die Subdomain → Node.js → *Node.js aktivieren*. Anwendungsstamm auf das Subdomain-Verzeichnis, **Anwendungsstartdatei `app.js`**, Anwendungsmodus `production`.
4. **Umgebungsvariablen** aus `.env.example` dort eintragen, mit den echten Werten. `MIGRATIONS_DIR` steht auf dem Server auf `./migrations` — der Ordner liegt neben `app.js`. `DATABASE_PATH` zeigt auf einen Pfad ausserhalb von `httpdocs`.
5. **Cronjob** anlegen: Plesk → Geplante Aufgaben, stündlich, Befehl `/opt/plesk/node/26/bin/node /var/www/vhosts/…/korrekturen.msmr.co/worker.js`. Den genauen Node-Pfad zeigt Plesk in der Node.js-Ansicht an.

- [ ] **Step 11: Deployment prüfen**

```bash
git push
```

Workflow abwarten, dann:

```bash
curl -fsS https://korrekturen.msmr.co/healthz
```

Erwartet: `{"status":"ok"}`. Bei einem 503 hilft das Passenger-Log unter `logs/` im Subdomain-Verzeichnis — meist eine fehlende Umgebungsvariable, die `loadEnv` mit klarer Meldung quittiert.

- [ ] **Step 12: Commit**

```bash
git add packages/api .github/workflows/deploy.yml .env.example .claudeignore package.json pnpm-lock.yaml
git commit -m "Hono-Server, Passenger-Einstiegspunkte und Deploy-Workflow"
```

---

# Phase P1 — Datenmodell, reine Bausteine, Kennzahlen

### Task 3: URL-Kanonisierung

**Files:**
- Create: `packages/shared/src/url.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/url.test.ts`

**Interfaces:**
- Consumes: nichts
- Produces: `canonicalizeUrl(raw: string): { canonical: string; host: string } | null` aus `@korrektur/shared`

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`packages/shared/src/url.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { canonicalizeUrl } from "./url.js";

describe("canonicalizeUrl", () => {
  it("entfernt Tracking-Parameter und Fragment", () => {
    const result = canonicalizeUrl(
      "https://www.example.de/politik/artikel-123?utm_source=twitter&utm_medium=social&id=7#absatz-2",
    );
    expect(result).toEqual({
      canonical: "https://example.de/politik/artikel-123?id=7",
      host: "example.de",
    });
  });

  it("normalisiert Host und Protokoll auf Kleinschreibung", () => {
    expect(canonicalizeUrl("HTTPS://WWW.Example.DE/Pfad")?.canonical).toBe(
      "https://example.de/Pfad",
    );
  });

  it("sortiert verbleibende Parameter stabil", () => {
    expect(canonicalizeUrl("https://example.de/a?b=2&a=1")?.canonical).toBe(
      "https://example.de/a?a=1&b=2",
    );
  });

  it("entfernt einen abschließenden Schrägstrich, außer bei der Wurzel", () => {
    expect(canonicalizeUrl("https://example.de/pfad/")?.canonical).toBe("https://example.de/pfad");
    expect(canonicalizeUrl("https://example.de/")?.canonical).toBe("https://example.de/");
  });

  it("behält Subdomains, die kein www sind", () => {
    expect(canonicalizeUrl("https://sz-magazin.example.de/x")?.host).toBe("sz-magazin.example.de");
  });

  it("gibt null zurück bei ungültiger Eingabe", () => {
    expect(canonicalizeUrl("kein-url")).toBeNull();
    expect(canonicalizeUrl("ftp://example.de/x")).toBeNull();
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
pnpm vitest run packages/shared/src/url.test.ts
```

Erwartet: FAIL — `Failed to resolve import "./url.js"`.

- [ ] **Step 3: Implementieren**

`packages/shared/src/url.ts`:

```ts
const TRACKING_PARAMS = new Set([
  "fbclid",
  "gclid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "msclkid",
  "ref",
  "ref_src",
  "wt_mc",
  "wt_zmc",
  "xtor",
]);

const TRACKING_PREFIXES = ["utm_", "pk_", "at_"];

function isTracking(key: string): boolean {
  const lower = key.toLowerCase();
  return TRACKING_PARAMS.has(lower) || TRACKING_PREFIXES.some((p) => lower.startsWith(p));
}

export function canonicalizeUrl(raw: string): { canonical: string; host: string } | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  url.hostname = host;
  url.protocol = url.protocol.toLowerCase();
  url.hash = "";
  url.username = "";
  url.password = "";

  const kept = [...url.searchParams.entries()].filter(([key]) => !isTracking(key));
  kept.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  url.search = "";
  for (const [key, value] of kept) url.searchParams.append(key, value);

  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }

  return { canonical: url.toString(), host };
}
```

`packages/shared/src/index.ts` ergänzen:

```ts
export * from "./constants.js";
export * from "./url.js";
```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

```bash
pnpm vitest run packages/shared/src/url.test.ts
```

Erwartet: 6 Tests grün.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/url.ts packages/shared/src/url.test.ts packages/shared/src/index.ts
git commit -m "URL-Kanonisierung mit Tracking-Parameter-Filter"
```

---

### Task 4: Textnormalisierung

**Files:**
- Create: `packages/shared/src/text.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/text.test.ts`

**Interfaces:**
- Consumes: nichts
- Produces: `normalizeText(input: string): string` aus `@korrektur/shared`

Diese Funktion ist die Voraussetzung dafür, dass Ankervergleiche nicht an Renderer-Eigenheiten scheitern (§8.2). Sie wird bei der Erfassung **und** beim späteren Check identisch angewendet.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`packages/shared/src/text.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normalizeText } from "./text.js";

describe("normalizeText", () => {
  it("vereinheitlicht typografische Anführungszeichen", () => {
    expect(normalizeText("„Zitat“ und ‚Zitat‘ und »Zitat«")).toBe('"Zitat" und \'Zitat\' und "Zitat"');
  });

  it("vereinheitlicht Striche", () => {
    expect(normalizeText("A–B —C −D")).toBe("A-B -C -D");
  });

  it("entfernt weiche Trennstriche und geschützte Leerzeichen", () => {
    expect(normalizeText("Fahr­gast zahlen")).toBe("Fahrgast zahlen");
  });

  it("faltet Whitespace zusammen und trimmt", () => {
    expect(normalizeText("  viel\n\n  Platz\t hier  ")).toBe("viel Platz hier");
  });

  it("bildet das Zollzeichen auf ein doppeltes Anfuehrungszeichen ab", () => {
    expect(normalizeText("5\u2033 Bildschirm")).toBe('5" Bildschirm');
  });

  it("wendet NFKC an", () => {
    expect(normalizeText("ﬁnal")).toBe("final");
  });

  it("faengt auch Zeichen ab, die erst NFKC erzeugt", () => {
    expect(normalizeText("12\u2034 Winkel")).toBe("12''' Winkel");
    expect(normalizeText("a\ufe31b")).toBe("a-b");
  });

  it("ist idempotent, auch fuer Zeichen die NFKC erst zerlegt", () => {
    const eingaben = ["„Test“ –  mit Raum", "5\u2033 Zoll", "12\u2034 Winkel", "a\ufe31b"];
    for (const input of eingaben) {
      const once = normalizeText(input);
      expect(normalizeText(once)).toBe(once);
    }
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
pnpm vitest run packages/shared/src/text.test.ts
```

Erwartet: FAIL — Modul nicht auflösbar.

- [ ] **Step 3: Implementieren**

`packages/shared/src/text.ts`:

```ts
const DOUBLE_QUOTES = /[“”„‟«»″]/g;
const SINGLE_QUOTES = /[‘’‚‛‹›′]/g;
const DASHES = /[‐‑‒–—―−]/g;
const SOFT_HYPHEN = /­/g;
const SPACES = /[  -   　]/g;
const ZERO_WIDTH = /[​‌‍﻿]/g;

/**
 * Bringt Text in eine Form, in der Vergleiche nicht an Renderer-Eigenheiten
 * scheitern. Muss bei Erfassung und Check identisch angewendet werden (§8.2).
 */
/** Einmal geschrieben, zweimal aufgerufen — siehe normalizeText. */
function replaceTypography(value: string): string {
  return value
    .replace(SOFT_HYPHEN, "")
    .replace(ZERO_WIDTH, "")
    .replace(DOUBLE_QUOTES, '"')
    .replace(SINGLE_QUOTES, "'")
    .replace(DASHES, "-")
    .replace(SPACES, " ");
}

/**
 * Bringt Text in eine Form, in der Vergleiche nicht an Renderer-Eigenheiten
 * scheitern. Muss bei Erfassung und Check identisch angewendet werden (§8.2).
 *
 * Zweimal ersetzen mit NFKC dazwischen, und beide Durchgaenge sind noetig:
 * Der erste bildet U+2033 (Zollzeichen) auf " ab, bevor NFKC es in zwei U+2032
 * zerlegen und daraus zwei Apostrophe machen kann. Der zweite faengt ab, was
 * NFKC selbst erst erzeugt — U+2034, U+2057 und die Bindestrich-
 * Praesentationsformen zerfallen in Klassenmitglieder. Erst dadurch enthaelt
 * die Ausgabe garantiert kein Zeichen der Klassen mehr; die Idempotenz haengt
 * dann an der Struktur und nicht an den zufaellig getesteten Eingaben.
 */
export function normalizeText(input: string): string {
  return replaceTypography(replaceTypography(input).normalize("NFKC"))
    .replace(/\s+/g, " ")
    .trim();
}
```

`packages/shared/src/index.ts` ergänzen: `export * from "./text.js";`

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

```bash
pnpm vitest run packages/shared/src/text.test.ts
```

Erwartet: 6 Tests grün.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/text.ts packages/shared/src/text.test.ts packages/shared/src/index.ts
git commit -m "Textnormalisierung fuer Ankervergleiche"
```

---

### Task 5: Referenz-Token

**Files:**
- Create: `packages/shared/src/ref.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/ref.test.ts`

**Interfaces:**
- Consumes: nichts
- Produces: `generateRef(): string`, `isRef(value: string): boolean`, `REF_PATTERN: RegExp`, `extractRefFromSubject(subject: string): string | null` aus `@korrektur/shared`

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`packages/shared/src/ref.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { extractRefFromSubject, generateRef, isRef, REF_PATTERN } from "./ref.js";

describe("generateRef", () => {
  it("erzeugt K plus fünf Crockford-Zeichen", () => {
    for (let i = 0; i < 200; i++) {
      const ref = generateRef();
      expect(ref).toHaveLength(6);
      expect(ref).toMatch(REF_PATTERN);
    }
  });

  it("verwendet keine verwechselbaren Zeichen", () => {
    const many = Array.from({ length: 500 }, () => generateRef()).join("");
    expect(many).not.toMatch(/[ILOU]/);
  });

  it("liefert praktisch nie denselben Wert", () => {
    const set = new Set(Array.from({ length: 1000 }, () => generateRef()));
    expect(set.size).toBeGreaterThan(995);
  });
});

describe("isRef", () => {
  it("erkennt gültige und ungültige Werte", () => {
    expect(isRef("K7QW3")).toBe(false);
    expect(isRef("K7QW3M")).toBe(true);
    expect(isRef("K7QW3I")).toBe(false);
    expect(isRef("X7QW3M")).toBe(false);
  });
});

describe("extractRefFromSubject", () => {
  it("findet den Token am Ende", () => {
    expect(extractRefFromSubject("Korrekturhinweis: Zahlendreher [K7QW3M]")).toBe("K7QW3M");
  });

  it("findet den Token trotz Antwort-Präfixen und Ticketnummer", () => {
    expect(
      extractRefFromSubject("AW: [Ticket#88213] Korrekturhinweis: Zahlendreher [K7QW3M]"),
    ).toBe("K7QW3M");
  });

  it("ignoriert fremde Klammerausdrücke", () => {
    expect(extractRefFromSubject("Re: [Ticket#88213] Ihre Anfrage")).toBeNull();
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
pnpm vitest run packages/shared/src/ref.test.ts
```

Erwartet: FAIL — Modul nicht auflösbar.

- [ ] **Step 3: Implementieren**

`packages/shared/src/ref.ts`:

```ts
import { randomInt } from "node:crypto";

/** Crockford-Base32 ohne I, L, O, U — nichts Verwechselbares (§5.2). */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const REF_BODY_LENGTH = 5;

/**
 * Beide Muster werden aus ALPHABET abgeleitet, nicht danebengeschrieben.
 * Eine zweite, von Hand gepflegte Zeichenklasse koennte vom Alphabet
 * abweichen — dann erzeugte generateRef Token, die isRef ablehnt, und der
 * Fehler zeigte sich erst, wenn genau dieses Zeichen gezogen wird.
 */
const BODY_CLASS = `[${ALPHABET}]{${REF_BODY_LENGTH}}`;

export const REF_PATTERN = new RegExp(`^K${BODY_CLASS}$`);
const SUBJECT_PATTERN = new RegExp(`\\[(K${BODY_CLASS})\\]`);

export function generateRef(): string {
  let body = "";
  for (let i = 0; i < REF_BODY_LENGTH; i++) {
    body += ALPHABET[randomInt(ALPHABET.length)];
  }
  return `K${body}`;
}

export function isRef(value: string): boolean {
  return REF_PATTERN.test(value);
}

/** Sucht im gesamten Betreff, nicht nur am Ende (§7, Stufe 2). */
export function extractRefFromSubject(subject: string): string | null {
  const match = SUBJECT_PATTERN.exec(subject);
  return match?.[1] ?? null;
}
```

`packages/shared/src/index.ts` ergänzen: `export * from "./ref.js";`

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

```bash
pnpm vitest run packages/shared/src/ref.test.ts
```

Erwartet: 7 Tests grün.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/ref.ts packages/shared/src/ref.test.ts packages/shared/src/index.ts
git commit -m "Referenz-Token K plus fuenf Crockford-Zeichen"
```

---

### Task 6: Quoten und Wilson-Intervall

**Files:**
- Create: `packages/shared/src/stats.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/stats.test.ts`

**Interfaces:**
- Consumes: `MIN_N_FOR_RATE`, `CONFIDENCE_Z` aus `./constants.js`
- Produces: `wilsonInterval(successes: number, total: number): { lower: number; upper: number }`, `rateOrNull(successes: number, total: number): number | null` aus `@korrektur/shared`

`rateOrNull` gibt `null` zurück, solange die Fallzahl unter `MIN_N_FOR_RATE` liegt — die Zahl existiert, wird aber nicht behauptet (§9.4). Die Darstellung zeigt dann nur die Rohzahlen.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`packages/shared/src/stats.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { rateOrNull, wilsonInterval } from "./stats.js";

describe("wilsonInterval", () => {
  it("reproduziert einen aus der Literatur bekannten Kontrollfall", () => {
    // Wilson-Score-Intervall fuer 40 von 100, 95 % — Standardwert aus der
    // Literatur. Verankert den Test an einer externen Quelle statt an der
    // eigenen Implementierung.
    const { lower, upper } = wilsonInterval(40, 100);
    expect(lower).toBeCloseTo(0.3094, 4);
    expect(upper).toBeCloseTo(0.498, 3);
  });

  it("liefert für 5 von 12 ein enges 95-%-Intervall", () => {
    const { lower, upper } = wilsonInterval(5, 12);
    expect(lower).toBeCloseTo(0.1933, 4);
    expect(upper).toBeCloseTo(0.6805, 4);
  });

  it("gibt bei n=0 das volle Intervall zurück", () => {
    expect(wilsonInterval(0, 0)).toEqual({ lower: 0, upper: 1 });
  });

  it("zieht die untere Grenze bei 1 von 1 deutlich unter 1", () => {
    const { lower, upper } = wilsonInterval(1, 1);
    expect(lower).toBeLessThan(0.3);
    expect(upper).toBe(1);
  });
});

describe("rateOrNull", () => {
  it("unterdrückt Quoten unterhalb der Mindestfallzahl", () => {
    expect(rateOrNull(4, 9)).toBeNull();
  });

  it("liefert die Quote ab der Mindestfallzahl", () => {
    expect(rateOrNull(5, 10)).toBeCloseTo(0.5, 6);
  });

  it("gibt bei n=0 null zurück", () => {
    expect(rateOrNull(0, 0)).toBeNull();
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
pnpm vitest run packages/shared/src/stats.test.ts
```

Erwartet: FAIL — Modul nicht auflösbar.

- [ ] **Step 3: Implementieren**

`packages/shared/src/stats.ts`:

```ts
import { CONFIDENCE_Z, MIN_N_FOR_RATE } from "./constants.js";

/**
 * Wilson-Score-Intervall. Dient als Fehlerbalken gegen Überinterpretation
 * kleiner Unterschiede — ausdrücklich nicht als Ranking-Kriterium (§2.2, §9.4).
 */
export function wilsonInterval(
  successes: number,
  total: number,
): { lower: number; upper: number } {
  if (total <= 0) return { lower: 0, upper: 1 };

  const z = CONFIDENCE_Z;
  const p = successes / total;
  const z2 = z * z;
  const denominator = 1 + z2 / total;
  const centre = p + z2 / (2 * total);
  const margin = z * Math.sqrt((p * (1 - p)) / total + z2 / (4 * total * total));

  return {
    lower: Math.max(0, (centre - margin) / denominator),
    upper: Math.min(1, (centre + margin) / denominator),
  };
}

/** Gibt null zurück, solange die Fallzahl zu klein ist (§9.4). */
export function rateOrNull(successes: number, total: number): number | null {
  if (total < MIN_N_FOR_RATE || total <= 0) return null;
  return successes / total;
}
```

`packages/shared/src/index.ts` ergänzen: `export * from "./stats.js";`

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

```bash
pnpm vitest run packages/shared/src/stats.test.ts
```

Erwartet: 6 Tests grün.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/stats.ts packages/shared/src/stats.test.ts packages/shared/src/index.ts
git commit -m "Wilson-Intervall und Quotenschwelle"
```

---

### Task 7: Datenbankschema und Migration

**Files:**
- Create: `packages/api/drizzle.config.ts`, `packages/api/src/db/schema.ts`, `packages/api/src/db/client.ts`
- Modify: `packages/api/package.json`, `package.json` (Root-Skripte)
- Test: `packages/api/src/db/schema.test.ts`

**Interfaces:**
- Consumes: nichts aus früheren Tasks
- Produces: aus `packages/api/src/db/schema.ts` die Tabellen `outlets`, `outletDomains`, `errorTypes`, `corrections`, `responseEvents`, `articleChecks`, `imapCursor`; aus `packages/api/src/db/client.ts` die Funktionen `createDb(path: string): Db` und `runMigrations(db: Db): void` mit `export type Db = BetterSQLite3Database<typeof schema>`

- [ ] **Step 1: Abhängigkeiten ergänzen**

```bash
pnpm --filter @korrektur/api add drizzle-orm @paralleldrive/cuid2
pnpm --filter @korrektur/api add -D drizzle-kit
```

`packages/api/package.json` um Skripte ergänzen:

```json
"db:generate": "drizzle-kit generate",
"db:migrate": "node dist/db/migrate.js",
"db:seed": "node dist/db/seed.js"
```

Root-`package.json` um Durchreicher ergänzen:

```json
"db:generate": "pnpm --filter @korrektur/api db:generate",
"db:seed": "pnpm --filter @korrektur/api db:seed"
```

- [ ] **Step 2: Den fehlschlagenden Test schreiben**

`packages/api/src/db/schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createDb, runMigrations } from "./client.js";
import { errorTypes, outletDomains, outlets } from "./schema.js";

describe("Schema und Migration", () => {
  it("legt alle Tabellen an und ist idempotent", () => {
    const db = createDb(":memory:");
    runMigrations(db);
    runMigrations(db);

    const rows = db.$client
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];
    const names = rows.map((r) => r.name);

    for (const table of [
      "article_checks",
      "corrections",
      "error_types",
      "imap_cursor",
      "outlet_domains",
      "outlets",
      "response_events",
    ]) {
      expect(names).toContain(table);
    }
  });

  it("erzwingt Eindeutigkeit der Domain über Outlets hinweg", () => {
    const db = createDb(":memory:");
    runMigrations(db);
    const now = Math.floor(Date.now() / 1000);

    db.insert(outlets).values({ id: "o1", name: "A", primaryDomain: "a.de", createdAt: now }).run();
    db.insert(outlets).values({ id: "o2", name: "B", primaryDomain: "b.de", createdAt: now }).run();
    db.insert(outletDomains).values({ id: "d1", outletId: "o1", domain: "geteilt.de" }).run();

    expect(() =>
      db.insert(outletDomains).values({ id: "d2", outletId: "o2", domain: "geteilt.de" }).run(),
    ).toThrow(/UNIQUE/i);
  });

  it("erzwingt Eindeutigkeit des Fehlerart-Schlüssels", () => {
    const db = createDb(":memory:");
    runMigrations(db);
    const now = Math.floor(Date.now() / 1000);

    db.insert(errorTypes).values({ id: "e1", key: "zahl", label: "Zahl", sortOrder: 1, createdAt: now }).run();
    expect(() =>
      db.insert(errorTypes).values({ id: "e2", key: "zahl", label: "Zahl 2", sortOrder: 2, createdAt: now }).run(),
    ).toThrow(/UNIQUE/i);
  });
});
```

- [ ] **Step 3: Test laufen lassen, Fehlschlag bestätigen**

```bash
pnpm vitest run packages/api/src/db/schema.test.ts
```

Erwartet: FAIL — `./client.js` nicht auflösbar.

- [ ] **Step 4: Schema implementieren**

`packages/api/src/db/schema.ts`:

```ts
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
```

- [ ] **Step 5: Client und Migrationslauf implementieren**

`packages/api/drizzle.config.ts`:

```ts
import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "sqlite",
} satisfies Config;
```

`packages/api/src/db/client.ts`:

```ts
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { drizzle, type NodeSQLiteDatabase } from "drizzle-orm/node-sqlite";
import { migrate } from "drizzle-orm/node-sqlite/migrator";
import * as schema from "./schema.js";

export type Db = NodeSQLiteDatabase<typeof schema> & { $client: DatabaseSync };

/** node:sqlite ist in Node eingebaut — keine native Abhaengigkeit, nichts zu kompilieren (§3.4). */
export function createDb(path: string): Db {
  const sqlite = new DatabaseSync(path);
  sqlite.exec("PRAGMA journal_mode = WAL");
  sqlite.exec("PRAGMA foreign_keys = ON");
  return drizzle(sqlite, { schema }) as Db;
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
```

- [ ] **Step 6: Migration erzeugen**

```bash
pnpm --filter @korrektur/api exec drizzle-kit generate
ls packages/api/src/db/migrations
```

Erwartet: eine `.sql`-Datei und ein `meta/`-Verzeichnis.

- [ ] **Step 7: Test laufen lassen, Erfolg bestätigen**

```bash
pnpm vitest run packages/api/src/db/schema.test.ts
```

Erwartet: 3 Tests grün. Der zweite Lauf von `runMigrations` darf nicht scheitern — das ist der Idempotenz-Nachweis.

- [ ] **Step 8: Commit**

```bash
git add packages/api/src/db packages/api/drizzle.config.ts packages/api/package.json package.json pnpm-lock.yaml
git commit -m "Drizzle-Schema mit Stammdatentabellen und Migrationslauf"
```

---

### Task 8: Seed für Fehlerarten und Redaktionen

**Files:**
- Create: `packages/api/src/db/seed.ts`
- Test: `packages/api/src/db/seed.test.ts`

**Interfaces:**
- Consumes: `createDb`, `runMigrations`, Tabellen aus Task 7
- Produces: `seed(db: Db): void` und `DEFAULT_ERROR_TYPES: ReadonlyArray<{ key: string; label: string; description: string }>` aus `packages/api/src/db/seed.ts`

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`packages/api/src/db/seed.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createDb, runMigrations } from "./client.js";
import { DEFAULT_ERROR_TYPES, seed } from "./seed.js";
import { errorTypes, outletDomains, outlets } from "./schema.js";

function freshDb() {
  const db = createDb(":memory:");
  runMigrations(db);
  return db;
}

describe("seed", () => {
  it("legt die zwölf Fehlerarten aus der Spec an", () => {
    const db = freshDb();
    seed(db);
    const rows = db.select().from(errorTypes).all();
    expect(rows).toHaveLength(12);
    expect(rows.map((r) => r.key)).toContain("ueberschrift_deckt_nicht");
    expect(DEFAULT_ERROR_TYPES).toHaveLength(12);
  });

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
    expect(db.select().from(errorTypes).all()).toHaveLength(12);
    expect(db.select().from(outlets).all()).toHaveLength(3);
  });

  it("vergibt eine stabile Sortierreihenfolge", () => {
    const db = freshDb();
    seed(db);
    const orders = db.select().from(errorTypes).all().map((r) => r.sortOrder);
    expect(new Set(orders).size).toBe(12);
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
pnpm vitest run packages/api/src/db/seed.test.ts
```

Erwartet: FAIL — `./seed.js` nicht auflösbar.

- [ ] **Step 3: Implementieren**

`packages/api/src/db/seed.ts`:

```ts
import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import type { Db } from "./client.js";
import { errorTypes, outletDomains, outlets } from "./schema.js";

/** Die zwölf Ausgangswerte aus §5.0. Weitere werden über das Adminformular gepflegt. */
export const DEFAULT_ERROR_TYPES = [
  { key: "rechtschreibung", label: "Rechtschreibung", description: "Falsch geschriebenes Wort." },
  { key: "grammatik", label: "Grammatik", description: "Fehlerhafter Satzbau oder Beugung." },
  { key: "zeichensetzung", label: "Zeichensetzung", description: "Komma, Punkt, Anführungszeichen." },
  { key: "zahl", label: "Zahl", description: "Falsche Zahl, Einheit oder Größenordnung." },
  { key: "datum", label: "Datum", description: "Falsches Datum, Jahr oder Zeitangabe." },
  { key: "name", label: "Name", description: "Falsch geschriebener oder verwechselter Name." },
  { key: "faktenfehler", label: "Faktenfehler", description: "Sachlich unzutreffende Aussage." },
  { key: "falschzitat", label: "Falschzitat", description: "Zitat unzutreffend oder sinnentstellend." },
  { key: "uebersetzung", label: "Übersetzung", description: "Fehlerhafte Übertragung aus einer Fremdsprache." },
  { key: "bild", label: "Bild", description: "Falsche Bildunterschrift oder unpassendes Bild." },
  { key: "ueberschrift_deckt_nicht", label: "Überschrift deckt nicht", description: "Überschrift wird vom Text nicht getragen." },
  { key: "sonstiges", label: "Sonstiges", description: "Passt in keine der übrigen Kategorien." },
] as const;

const DEFAULT_OUTLETS = [
  { name: "Beispiel-Zeitung", domain: "beispiel-zeitung.de", publisher: "Beispiel Verlag" },
  { name: "Muster-Magazin", domain: "muster-magazin.de", publisher: "Muster Medien" },
  { name: "Probe-Anzeiger", domain: "probe-anzeiger.de", publisher: "Probe Presse" },
] as const;

export function seed(db: Db): void {
  const now = Math.floor(Date.now() / 1000);

  DEFAULT_ERROR_TYPES.forEach((entry, index) => {
    const existing = db.select().from(errorTypes).where(eq(errorTypes.key, entry.key)).get();
    if (existing) return;
    db.insert(errorTypes)
      .values({
        id: createId(),
        key: entry.key,
        label: entry.label,
        description: entry.description,
        sortOrder: (index + 1) * 10,
        createdAt: now,
      })
      .run();
  });

  for (const entry of DEFAULT_OUTLETS) {
    const existing = db
      .select()
      .from(outletDomains)
      .where(eq(outletDomains.domain, entry.domain))
      .get();
    if (existing) continue;

    const outletId = createId();
    db.insert(outlets)
      .values({
        id: outletId,
        name: entry.name,
        primaryDomain: entry.domain,
        publisher: entry.publisher,
        country: "DE",
        contactEmails: [],
        createdAt: now,
      })
      .run();
    db.insert(outletDomains).values({ id: createId(), outletId, domain: entry.domain }).run();
  }
}
```

Die Seed-Redaktionen sind bewusst erfunden. Echte Kontaktadressen werden über das Adminformular aus Task 19 gepflegt und gehören nicht ins öffentliche Repository.

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

```bash
pnpm vitest run packages/api/src/db/seed.test.ts
```

Erwartet: 4 Tests grün.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/db/seed.ts packages/api/src/db/seed.test.ts
git commit -m "Seed mit zwoelf Fehlerarten und drei Beispiel-Redaktionen"
```

---

### Task 9: Kennzahlen-Views und Abfragen

**Files:**
- Create: `packages/api/src/db/views.ts`, `packages/api/src/repo/stats.ts`
- Test: `packages/api/src/repo/stats.test.ts`

**Interfaces:**
- Consumes: `MATURITY_SECONDS` aus `@korrektur/shared`, Tabellen aus Task 7
- Produces: `applyViews(db: Db): void` aus `packages/api/src/db/views.ts`; `outletStats(db: Db): OutletStatRow[]` und `errorTypeStats(db: Db): ErrorTypeStatRow[]` aus `packages/api/src/repo/stats.ts` mit `OutletStatRow = { outletId: string; name: string; nReports: number; nCorrectionBase: number; nCorrected: number; nReplyBase: number; nReplied: number; correctionRate: number | null; replyRate: number | null }`

Die Views werden beim Start aus den TS-Konstanten neu erzeugt statt in einer Migration eingefroren — sonst driften Reifegrenze in `shared` und Reifegrenze in SQL auseinander. Das ist die in den Global Constraints genannte Ausnahme.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`packages/api/src/repo/stats.test.ts`:

```ts
import { MATURITY_SECONDS } from "@korrektur/shared";
import { createId } from "@paralleldrive/cuid2";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, runMigrations, type Db } from "../db/client.js";
import { articleChecks, corrections, errorTypes, outlets, responseEvents } from "../db/schema.js";
import { applyViews } from "../db/views.js";
import { outletStats } from "./stats.js";

const NOW = Math.floor(Date.now() / 1000);
const MATURE = NOW - MATURITY_SECONDS - 86_400;
const FRESH = NOW - 3600;

let db: Db;
let outletId: string;
let errorTypeId: string;

function addCorrection(overrides: Partial<typeof corrections.$inferInsert> = {}): string {
  const id = createId();
  db.insert(corrections)
    .values({
      id,
      ref: `K${id.slice(0, 5).toUpperCase().replace(/[ILOU]/g, "X")}`,
      idempotencyKey: id,
      createdAt: MATURE,
      dispatchMode: "smtp",
      articleUrl: "https://beispiel-zeitung.de/a",
      articleUrlCanon: "https://beispiel-zeitung.de/a",
      outletId,
      errorTypeId,
      severity: 2,
      quoteBefore: "Zitat",
      suggestionAfter: "Vorschlag",
      recipientEmail: "leserbriefe@beispiel-zeitung.de",
      dispatchStatus: "sent",
      sentAt: MATURE,
      source: "web",
      ...overrides,
    })
    .run();
  return id;
}

beforeEach(() => {
  db = createDb(":memory:");
  runMigrations(db);
  applyViews(db);

  outletId = createId();
  errorTypeId = createId();
  db.insert(outlets)
    .values({ id: outletId, name: "Beispiel-Zeitung", primaryDomain: "beispiel-zeitung.de", createdAt: NOW })
    .run();
  db.insert(errorTypes)
    .values({ id: errorTypeId, key: "zahl", label: "Zahl", sortOrder: 10, createdAt: NOW })
    .run();
});

describe("Kennzahlen-Views", () => {
  it("zählt eine reife, zugestellte, manuell bestätigte Korrektur", () => {
    addCorrection({ correctedAt: MATURE + 3600, verification: "manual", outcome: "corrected" });
    const [row] = outletStats(db);
    expect(row?.nCorrectionBase).toBe(1);
    expect(row?.nCorrected).toBe(1);
  });

  it("hält eine frische Meldung aus jedem Nenner heraus", () => {
    addCorrection({ createdAt: FRESH, sentAt: FRESH });
    const [row] = outletStats(db);
    expect(row?.nReports).toBe(1);
    expect(row?.nReplyBase).toBe(0);
    expect(row?.nCorrectionBase).toBe(0);
  });

  it("hält eine gebouncte Meldung aus jedem Nenner heraus", () => {
    addCorrection({ dispatchStatus: "bounced" });
    const [row] = outletStats(db);
    expect(row?.nReplyBase).toBe(0);
  });

  it("hält eine nur vorbereitete Meldung aus jedem Nenner heraus", () => {
    addCorrection({ dispatchStatus: "prepared", sentAt: null });
    const [row] = outletStats(db);
    expect(row?.nReplyBase).toBe(0);
  });

  it("wertet eine Autoreply nicht als Antwort", () => {
    const id = addCorrection();
    db.insert(responseEvents)
      .values({ id: createId(), correctionId: id, kind: "autoreply", receivedAt: MATURE + 60 })
      .run();
    const [row] = outletStats(db);
    expect(row?.nReplyBase).toBe(1);
    expect(row?.nReplied).toBe(0);
  });

  it("wertet eine echte Antwort als Antwort", () => {
    const id = addCorrection();
    db.insert(responseEvents)
      .values({ id: createId(), correctionId: id, kind: "reply", receivedAt: MATURE + 60 })
      .run();
    const [row] = outletStats(db);
    expect(row?.nReplied).toBe(1);
  });

  it("hält eine nicht abrufbare Seite aus dem Korrektur-Nenner heraus", () => {
    const id = addCorrection();
    db.insert(articleChecks)
      .values({ id: createId(), correctionId: id, checkedAt: MATURE + 86_400, quoteState: "unreachable" })
      .run();
    const [row] = outletStats(db);
    expect(row?.nCorrectionBase).toBe(0);
    expect(row?.nReplyBase).toBe(1);
  });

  it("zählt mailto-Meldungen nicht in den Antwort-Nenner", () => {
    addCorrection({ dispatchMode: "mailto" });
    const [row] = outletStats(db);
    expect(row?.nReplyBase).toBe(0);
  });

  it("unterdrückt die Quote bei n unter der Mindestfallzahl", () => {
    addCorrection({ correctedAt: MATURE + 3600, verification: "manual" });
    const [row] = outletStats(db);
    expect(row?.correctionRate).toBeNull();
  });

  it("liefert die Quote ab der Mindestfallzahl", () => {
    for (let i = 0; i < 10; i++) {
      addCorrection(i < 4 ? { correctedAt: MATURE + 3600, verification: "manual" } : {});
    }
    const [row] = outletStats(db);
    expect(row?.nCorrectionBase).toBe(10);
    expect(row?.correctionRate).toBeCloseTo(0.4, 6);
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
pnpm vitest run packages/api/src/repo/stats.test.ts
```

Erwartet: FAIL — `../db/views.js` nicht auflösbar.

- [ ] **Step 3: Views implementieren**

`packages/api/src/db/views.ts`:

```ts
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
```

- [ ] **Step 4: Abfragen implementieren**

`packages/api/src/repo/stats.ts`:

```ts
import { rateOrNull } from "@korrektur/shared";
import type { Db } from "../db/client.js";

export interface OutletStatRow {
  outletId: string;
  name: string;
  nReports: number;
  nCorrectionBase: number;
  nCorrected: number;
  nReplyBase: number;
  nReplied: number;
  correctionRate: number | null;
  replyRate: number | null;
}

export interface ErrorTypeStatRow {
  errorTypeId: string;
  label: string;
  nReports: number;
  nCorrectionBase: number;
  nCorrected: number;
  correctionRate: number | null;
}

interface RawOutletRow {
  outlet_id: string;
  name: string;
  n_reports: number;
  n_correction_base: number;
  n_corrected: number;
  n_reply_base: number;
  n_replied: number;
}

interface RawErrorTypeRow {
  error_type_id: string;
  label: string;
  n_reports: number;
  n_correction_base: number;
  n_corrected: number;
}

/** Alphabetisch sortiert — die Reihenfolge ist keine Aussage (§2.2). */
export function outletStats(db: Db): OutletStatRow[] {
  const rows = db.$client
    .prepare("SELECT * FROM v_outlet_stats ORDER BY name COLLATE NOCASE")
    .all() as RawOutletRow[];

  return rows.map((r) => ({
    outletId: r.outlet_id,
    name: r.name,
    nReports: r.n_reports,
    nCorrectionBase: r.n_correction_base,
    nCorrected: r.n_corrected,
    nReplyBase: r.n_reply_base,
    nReplied: r.n_replied,
    correctionRate: rateOrNull(r.n_corrected, r.n_correction_base),
    replyRate: rateOrNull(r.n_replied, r.n_reply_base),
  }));
}

export function errorTypeStats(db: Db): ErrorTypeStatRow[] {
  const rows = db.$client
    .prepare("SELECT * FROM v_error_type_stats ORDER BY label COLLATE NOCASE")
    .all() as RawErrorTypeRow[];

  return rows.map((r) => ({
    errorTypeId: r.error_type_id,
    label: r.label,
    nReports: r.n_reports,
    nCorrectionBase: r.n_correction_base,
    nCorrected: r.n_corrected,
    correctionRate: rateOrNull(r.n_corrected, r.n_correction_base),
  }));
}
```

- [ ] **Step 5: Test laufen lassen, Erfolg bestätigen**

```bash
pnpm vitest run packages/api/src/repo/stats.test.ts
```

Erwartet: 10 Tests grün. Damit ist die Abnahme von P1 erfüllt: Migration idempotent, Seed läuft, Views liefern gegen Bounce, Autoreply, frische Meldung, Paywall, `mailto:` und n=1 die erwarteten Zahlen.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/db/views.ts packages/api/src/repo/stats.ts packages/api/src/repo/stats.test.ts
git commit -m "Kennzahlen-Views mit Reife-, Zustellbarkeits- und Pruefbarkeitsfilter"
```

---

# Phase P2 — Erfassung, Stammdaten, Versand

Ab dem Ende dieser Phase wird produktiv gesammelt.

### Task 10: Artikeltext aus HTML extrahieren

**Files:**
- Create: `packages/api/src/article/extract.ts`
- Create: `tests/fixtures/artikel-standard.html`, `tests/fixtures/artikel-typografie.html`
- Test: `packages/api/src/article/extract.test.ts`

**Interfaces:**
- Consumes: `normalizeText` aus `@korrektur/shared`
- Produces: `extractArticle(html: string, url: string): { title: string | null; text: string } | null` aus `packages/api/src/article/extract.ts`

Reine Funktion: nimmt HTML als String entgegen, macht kein Netz. Der Abruf liegt in Task 12.

- [ ] **Step 1: Abhängigkeiten ergänzen**

```bash
pnpm --filter @korrektur/api add @mozilla/readability linkedom
```

- [ ] **Step 2: Fixtures anlegen**

`tests/fixtures/artikel-standard.html`:

```html
<!doctype html>
<html lang="de">
  <head><title>Fahrgastzahlen steigen deutlich</title></head>
  <body>
    <nav>Ressorts Politik Wirtschaft Sport</nav>
    <article>
      <h1>Fahrgastzahlen steigen deutlich</h1>
      <p>Der Verkehrsverbund meldet einen Zuwachs. Im vergangenen Jahr nutzten
      rund 4,2 Millionen Menschen die Linie, ein Plus von zwölf Prozent.</p>
      <p>Für das laufende Jahr rechnet der Verbund mit einer weiteren Steigerung.</p>
    </article>
    <footer>Impressum Datenschutz</footer>
  </body>
</html>
```

`tests/fixtures/artikel-typografie.html`:

```html
<!doctype html>
<html lang="de">
  <head><title>Ein Zitat mit Eigenheiten</title></head>
  <body>
    <article>
      <h1>Ein Zitat mit Eigenheiten</h1>
      <p>Die Sprecherin sagte: „Wir haben&nbsp;alle Fahr&shy;gastzahlen geprüft“ –
      und verwies auf den Bericht.</p>
    </article>
  </body>
</html>
```

- [ ] **Step 3: Den fehlschlagenden Test schreiben**

`packages/api/src/article/extract.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { extractArticle } from "./extract.js";

function fixture(name: string): string {
  return readFileSync(resolve(process.cwd(), "tests/fixtures", name), "utf8");
}

describe("extractArticle", () => {
  it("liefert Titel und Fließtext ohne Navigation und Fußzeile", () => {
    const result = extractArticle(fixture("artikel-standard.html"), "https://beispiel-zeitung.de/a");
    expect(result?.title).toBe("Fahrgastzahlen steigen deutlich");
    expect(result?.text).toContain("rund 4,2 Millionen Menschen die Linie");
    expect(result?.text).not.toContain("Impressum");
    expect(result?.text).not.toContain("Ressorts Politik");
  });

  it("normalisiert Typografie, damit Zitate vergleichbar werden", () => {
    const result = extractArticle(fixture("artikel-typografie.html"), "https://beispiel-zeitung.de/b");
    expect(result?.text).toContain('"Wir haben alle Fahrgastzahlen geprüft"');
    expect(result?.text).not.toMatch(/[„“–]/);
  });

  it("gibt null zurück, wenn kein Artikelinhalt erkennbar ist", () => {
    expect(extractArticle("<html><body></body></html>", "https://beispiel-zeitung.de/c")).toBeNull();
  });
});
```

- [ ] **Step 4: Test laufen lassen, Fehlschlag bestätigen**

```bash
pnpm vitest run packages/api/src/article/extract.test.ts
```

Erwartet: FAIL — `./extract.js` nicht auflösbar.

- [ ] **Step 5: Implementieren**

`packages/api/src/article/extract.ts`:

```ts
import { Readability } from "@mozilla/readability";
import { normalizeText } from "@korrektur/shared";
import { parseHTML } from "linkedom";

/**
 * Rein: nimmt HTML entgegen, greift nicht aufs Netz zu.
 * Autorenangaben werden bewusst nicht ausgelesen (§2.1).
 */
export function extractArticle(
  html: string,
  url: string,
): { title: string | null; text: string } | null {
  const { document } = parseHTML(html);
  const base = document.createElement("base");
  base.setAttribute("href", url);
  document.head?.appendChild(base);

  const article = new Readability(document as unknown as Document).parse();
  if (!article) return null;

  const text = normalizeText(article.textContent ?? "");
  if (text.length === 0) return null;

  const title = article.title ? normalizeText(article.title) : null;
  return { title: title && title.length > 0 ? title : null, text };
}
```

- [ ] **Step 6: Test laufen lassen, Erfolg bestätigen**

```bash
pnpm vitest run packages/api/src/article/extract.test.ts
```

Erwartet: 3 Tests grün.

- [ ] **Step 7: Commit**

```bash
git add packages/api/src/article/extract.ts packages/api/src/article/extract.test.ts tests/fixtures packages/api/package.json pnpm-lock.yaml
git commit -m "Artikeltext-Extraktion mit Readability und Normalisierung"
```

---

### Task 11: Kontext-Anker ableiten

**Files:**
- Create: `packages/api/src/article/anchor.ts`
- Test: `packages/api/src/article/anchor.test.ts`

**Interfaces:**
- Consumes: `ANCHOR_LENGTH`, `normalizeText` aus `@korrektur/shared`
- Produces: `deriveAnchors(articleText: string, quote: string): AnchorResult` aus `packages/api/src/article/anchor.ts` mit `AnchorResult = { quality: "exact" | "context" | "none"; prefix: string | null; suffix: string | null; positionHint: number | null }`

Bedeutung der drei Stufen, verbindlich für alle Folgetasks:

| `quality` | Bedeutung |
|---|---|
| `exact` | Zitat kommt im Artikel **genau einmal** vor. Die Fundstelle ist allein durch das Zitat bestimmt. |
| `context` | Zitat kommt **mehrfach** vor. Prefix, Suffix und `positionHint` (nullbasierter Index des gewählten Vorkommens) lösen auf. Der Datensatz wird zur Prüfung markiert. |
| `none` | Zitat nicht auffindbar. Später ist nur eine Substring-Prüfung möglich (§11.2). |

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`packages/api/src/article/anchor.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { deriveAnchors } from "./anchor.js";

const TEXT =
  "Der Verkehrsverbund meldet einen Zuwachs. Im vergangenen Jahr nutzten rund 4,2 Millionen Menschen die Linie, ein Plus von zwoelf Prozent. Fuer das laufende Jahr rechnet der Verbund mit einer weiteren Steigerung.";

describe("deriveAnchors", () => {
  it("meldet exact bei eindeutigem Zitat und schneidet Kontext heraus", () => {
    const result = deriveAnchors(TEXT, "rund 4,2 Millionen Menschen");
    expect(result.quality).toBe("exact");
    expect(result.positionHint).toBe(0);
    expect(result.prefix).toContain("Im vergangenen Jahr nutzten");
    expect(result.suffix).toContain("die Linie");
  });

  it("begrenzt Prefix und Suffix auf die konfigurierte Länge", () => {
    const result = deriveAnchors(TEXT, "rund 4,2 Millionen Menschen");
    expect(result.prefix?.length).toBeLessThanOrEqual(48);
    expect(result.suffix?.length).toBeLessThanOrEqual(48);
  });

  it("meldet context bei mehrfachem Vorkommen und wählt das erste", () => {
    const result = deriveAnchors("Alpha Beta Gamma. Delta Beta Epsilon.", "Beta");
    expect(result.quality).toBe("context");
    expect(result.positionHint).toBe(0);
    expect(result.prefix).toBe("Alpha ");
    expect(result.suffix).toBe(" Gamma. Delta Beta Epsilon.");
  });

  it("meldet none, wenn das Zitat nicht vorkommt", () => {
    expect(deriveAnchors(TEXT, "Ein Satz, der nirgends steht")).toEqual({
      quality: "none",
      prefix: null,
      suffix: null,
      positionHint: null,
    });
  });

  it("findet das Zitat trotz abweichender Typografie", () => {
    const result = deriveAnchors('Sie sagte: "Wir haben geprüft" und ging.', "„Wir haben geprüft“");
    expect(result.quality).toBe("exact");
  });

  it("liefert leere Kontexte am Textrand statt null", () => {
    const result = deriveAnchors("Anfang und Ende", "Anfang");
    expect(result.quality).toBe("exact");
    expect(result.prefix).toBe("");
    expect(result.suffix).toBe(" und Ende");
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
pnpm vitest run packages/api/src/article/anchor.test.ts
```

Erwartet: FAIL — `./anchor.js` nicht auflösbar.

- [ ] **Step 3: Implementieren**

`packages/api/src/article/anchor.ts`:

```ts
import { ANCHOR_LENGTH, normalizeText } from "@korrektur/shared";

export interface AnchorResult {
  quality: "exact" | "context" | "none";
  prefix: string | null;
  suffix: string | null;
  positionHint: number | null;
}

const NOT_FOUND: AnchorResult = {
  quality: "none",
  prefix: null,
  suffix: null,
  positionHint: null,
};

function allIndexesOf(haystack: string, needle: string): number[] {
  const found: number[] = [];
  let from = 0;
  for (;;) {
    const index = haystack.indexOf(needle, from);
    if (index === -1) return found;
    found.push(index);
    from = index + needle.length;
  }
}

/**
 * Bildet Kontext-Anker nach dem TextQuoteSelector-Muster (§8.1).
 * Beide Seiten werden normalisiert, damit Renderer-Eigenheiten nicht stören (§8.2).
 */
export function deriveAnchors(articleText: string, quote: string): AnchorResult {
  const text = normalizeText(articleText);
  const needle = normalizeText(quote);
  if (needle.length === 0) return NOT_FOUND;

  const occurrences = allIndexesOf(text, needle);
  if (occurrences.length === 0) return NOT_FOUND;

  const start = occurrences[0] ?? 0;
  const end = start + needle.length;

  return {
    quality: occurrences.length === 1 ? "exact" : "context",
    prefix: text.slice(Math.max(0, start - ANCHOR_LENGTH), start),
    suffix: text.slice(end, end + ANCHOR_LENGTH),
    positionHint: 0,
  };
}
```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

```bash
pnpm vitest run packages/api/src/article/anchor.test.ts
```

Erwartet: 6 Tests grün.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/article/anchor.ts packages/api/src/article/anchor.test.ts
git commit -m "Kontext-Anker nach TextQuoteSelector-Muster ableiten"
```

---

### Task 12: Artikel abrufen

**Files:**
- Create: `packages/api/src/article/fetch.ts`
- Test: `packages/api/src/article/fetch.test.ts`

**Interfaces:**
- Consumes: nichts aus früheren Tasks
- Produces: `fetchArticle(url: string, options?: { fetchImpl?: typeof fetch; timeoutMs?: number }): Promise<FetchResult>` aus `packages/api/src/article/fetch.ts` mit `FetchResult = { ok: true; status: number; html: string } | { ok: false; status: number | null; reason: "http" | "timeout" | "too_large" | "not_html" | "network" }`

Einziges Modul mit Netzzugriff in dieser Phase. `robots.txt` und Domain-Rate-Limit gehören zu den periodischen Checks und kommen in P5 — hier wird genau einmal auf ausdrückliche Nutzerhandlung hin abgerufen.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`packages/api/src/article/fetch.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { fetchArticle } from "./fetch.js";

function stubFetch(response: Response): typeof fetch {
  return (async () => response) as unknown as typeof fetch;
}

describe("fetchArticle", () => {
  it("liefert HTML bei Status 200", async () => {
    const stub = stubFetch(
      new Response("<html><body>Text</body></html>", {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
    );
    const result = await fetchArticle("https://beispiel-zeitung.de/a", { fetchImpl: stub });
    expect(result).toEqual({ ok: true, status: 200, html: "<html><body>Text</body></html>" });
  });

  it("meldet http bei Fehlerstatus", async () => {
    const stub = stubFetch(new Response("", { status: 403, headers: { "content-type": "text/html" } }));
    const result = await fetchArticle("https://beispiel-zeitung.de/a", { fetchImpl: stub });
    expect(result).toEqual({ ok: false, status: 403, reason: "http" });
  });

  it("meldet not_html bei fremdem Content-Type", async () => {
    const stub = stubFetch(
      new Response("{}", { status: 200, headers: { "content-type": "application/json" } }),
    );
    const result = await fetchArticle("https://beispiel-zeitung.de/a", { fetchImpl: stub });
    expect(result).toEqual({ ok: false, status: 200, reason: "not_html" });
  });

  it("meldet too_large bei überschrittener Größe", async () => {
    const stub = stubFetch(
      new Response("x".repeat(6_000_000), {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );
    const result = await fetchArticle("https://beispiel-zeitung.de/a", { fetchImpl: stub });
    expect(result).toEqual({ ok: false, status: 200, reason: "too_large" });
  });

  it("meldet network, wenn der Abruf wirft", async () => {
    const stub = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    const result = await fetchArticle("https://beispiel-zeitung.de/a", { fetchImpl: stub });
    expect(result).toEqual({ ok: false, status: null, reason: "network" });
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
pnpm vitest run packages/api/src/article/fetch.test.ts
```

Erwartet: FAIL — `./fetch.js` nicht auflösbar.

- [ ] **Step 3: Implementieren**

`packages/api/src/article/fetch.ts`:

```ts
const MAX_BYTES = 5_000_000;
const DEFAULT_TIMEOUT_MS = 12_000;
const USER_AGENT =
  "KorrekturTracker/1.0 (+https://korrekturen.msmr.co/anleitung; Fehlermeldungen an Redaktionen)";

export type FetchResult =
  | { ok: true; status: number; html: string }
  | {
      ok: false;
      status: number | null;
      reason: "http" | "timeout" | "too_large" | "not_html" | "network";
    };

export async function fetchArticle(
  url: string,
  options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<FetchResult> {
  const doFetch = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await doFetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
    });

    if (!response.ok) return { ok: false, status: response.status, reason: "http" };

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("html")) {
      return { ok: false, status: response.status, reason: "not_html" };
    }

    const html = await response.text();
    if (html.length > MAX_BYTES) {
      return { ok: false, status: response.status, reason: "too_large" };
    }

    return { ok: true, status: response.status, html };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return { ok: false, status: null, reason: aborted ? "timeout" : "network" };
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

```bash
pnpm vitest run packages/api/src/article/fetch.test.ts
```

Erwartet: 5 Tests grün.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/article/fetch.ts packages/api/src/article/fetch.test.ts
git commit -m "Artikelabruf mit Timeout, Groessen- und Content-Type-Grenze"
```

---

### Task 13: Mail zusammenbauen

**Files:**
- Create: `packages/api/src/dispatch/compose.ts`
- Test: `packages/api/src/dispatch/compose.test.ts`

**Interfaces:**
- Consumes: nichts aus früheren Tasks
- Produces: `composeMail(input: ComposeInput): { subject: string; text: string }` aus `packages/api/src/dispatch/compose.ts` mit `ComposeInput = { ref: string; articleUrl: string; articleUrlCanon: string; headline: string | null; errorTypeKey: string; errorTypeLabel: string; severity: 1 | 2 | 3; quoteBefore: string; suggestionAfter: string; comment: string | null; baseUrl: string }`

Reine Funktion. Kein `Reply-To`, kein Tag in der Absenderadresse (§7).

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`packages/api/src/dispatch/compose.test.ts`:

```ts
import { extractRefFromSubject } from "@korrektur/shared";
import { describe, expect, it } from "vitest";
import { composeMail } from "./compose.js";

const INPUT = {
  ref: "K7QW3M",
  articleUrl: "https://beispiel-zeitung.de/politik/artikel-123",
  articleUrlCanon: "https://beispiel-zeitung.de/politik/artikel-123",
  headline: "Fahrgastzahlen steigen deutlich",
  errorTypeKey: "zahl",
  errorTypeLabel: "Zahl",
  severity: 2 as const,
  quoteBefore: "rund 4,2 Millionen Menschen",
  suggestionAfter: "rund 2,4 Millionen Menschen",
  comment: "Der Jahresbericht nennt 2,4 Millionen.",
  baseUrl: "https://korrektur.example.tld",
};

describe("composeMail", () => {
  it("setzt den Referenz-Token ans Ende des Betreffs", () => {
    const { subject } = composeMail(INPUT);
    expect(subject.endsWith("[K7QW3M]")).toBe(true);
    expect(extractRefFromSubject(subject)).toBe("K7QW3M");
  });

  it("nennt Fundstelle, Zitat und Vorschlag im Text", () => {
    const { text } = composeMail(INPUT);
    expect(text).toContain("https://beispiel-zeitung.de/politik/artikel-123");
    expect(text).toContain("rund 4,2 Millionen Menschen");
    expect(text).toContain("rund 2,4 Millionen Menschen");
    expect(text).toContain("Der Jahresbericht nennt 2,4 Millionen.");
  });

  it("hängt einen maschinenlesbaren Meta-Block an", () => {
    const { text } = composeMail(INPUT);
    const block = /\[korrektur-meta\]([\s\S]*?)\[\/korrektur-meta\]/.exec(text);
    expect(block?.[1]?.trim()).toBe(
      "v=2; ref=K7QW3M; url=https://beispiel-zeitung.de/politik/artikel-123; typ=zahl; sev=2",
    );
  });

  it("kommt ohne Überschrift und ohne Kommentar aus", () => {
    const { subject, text } = composeMail({ ...INPUT, headline: null, comment: null });
    expect(extractRefFromSubject(subject)).toBe("K7QW3M");
    expect(text).not.toContain("Anmerkung:");
  });

  it("kürzt sehr lange Überschriften im Betreff", () => {
    const { subject } = composeMail({ ...INPUT, headline: "A".repeat(200) });
    expect(subject.length).toBeLessThan(140);
    expect(subject.endsWith("[K7QW3M]")).toBe(true);
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
pnpm vitest run packages/api/src/dispatch/compose.test.ts
```

Erwartet: FAIL — `./compose.js` nicht auflösbar.

- [ ] **Step 3: Implementieren**

`packages/api/src/dispatch/compose.ts`:

```ts
export interface ComposeInput {
  ref: string;
  articleUrl: string;
  articleUrlCanon: string;
  headline: string | null;
  errorTypeKey: string;
  errorTypeLabel: string;
  severity: 1 | 2 | 3;
  quoteBefore: string;
  suggestionAfter: string;
  comment: string | null;
  baseUrl: string;
}

const HEADLINE_MAX = 60;

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}

/** Rein. Baut Betreff und Textkörper; Header und Versand liegen in send.ts (§6). */
export function composeMail(input: ComposeInput): { subject: string; text: string } {
  const headlinePart = input.headline
    ? ` in "${truncate(input.headline, HEADLINE_MAX)}"`
    : "";
  const subject = `Korrekturhinweis: ${input.errorTypeLabel}${headlinePart} [${input.ref}]`;

  const lines = [
    "Sehr geehrte Redaktion,",
    "",
    "in folgendem Artikel ist mir eine Stelle aufgefallen, die nicht zutrifft:",
    input.articleUrl,
    "",
    `Art des Fehlers: ${input.errorTypeLabel}`,
    "",
    "Im Text steht:",
    input.quoteBefore,
    "",
    "Zutreffend wäre:",
    input.suggestionAfter,
  ];

  if (input.comment && input.comment.trim().length > 0) {
    lines.push("", `Anmerkung: ${input.comment.trim()}`);
  }

  lines.push(
    "",
    "Über eine kurze Rückmeldung würde ich mich freuen. Bitte lassen Sie das",
    "Kennzeichen am Ende des Betreffs stehen, damit ich Ihre Antwort zuordnen kann.",
    "",
    "Mit freundlichen Grüßen",
    "",
    "--",
    `Diese Meldung wurde über ${input.baseUrl} erstellt.`,
    "[korrektur-meta]",
    `v=2; ref=${input.ref}; url=${input.articleUrlCanon}; typ=${input.errorTypeKey}; sev=${input.severity}`,
    "[/korrektur-meta]",
  );

  return { subject, text: lines.join("\n") };
}
```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

```bash
pnpm vitest run packages/api/src/dispatch/compose.test.ts
```

Erwartet: 5 Tests grün.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/dispatch/compose.ts packages/api/src/dispatch/compose.test.ts
git commit -m "Mailkomposition mit Betreff-Token und Meta-Block"
```

---

### Task 14: Versand über SMTP-Relay

**Files:**
- Create: `packages/api/src/dispatch/send.ts`
- Test: `packages/api/src/dispatch/send.test.ts`

**Interfaces:**
- Consumes: `Env` aus `packages/api/src/env.ts`
- Produces: aus `packages/api/src/dispatch/send.ts`: `interface Mailer { send(message: OutgoingMail): Promise<SendResult> }`, `OutgoingMail = { to: string; subject: string; text: string }`, `SendResult = { ok: true; messageId: string } | { ok: false; error: string }`, `createSmtpMailer(env: Env): Mailer`, `createJsonMailer(from: string): Mailer`

`createJsonMailer` nutzt Nodemailers `jsonTransport` — sie baut die Nachricht vollständig, verschickt aber nichts. Damit wird der Versandpfad getestet, ohne echte Zugangsdaten oder Netz.

- [ ] **Step 1: Abhängigkeiten ergänzen**

```bash
pnpm --filter @korrektur/api add nodemailer
pnpm --filter @korrektur/api add -D @types/nodemailer
```

- [ ] **Step 2: Den fehlschlagenden Test schreiben**

`packages/api/src/dispatch/send.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createJsonMailer } from "./send.js";

describe("Mailer", () => {
  it("liefert eine Message-ID zurück", async () => {
    const mailer = createJsonMailer("korrektur@example.tld");
    const result = await mailer.send({
      to: "leserbriefe@beispiel-zeitung.de",
      subject: "Korrekturhinweis: Zahl [K7QW3M]",
      text: "Sehr geehrte Redaktion,",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.messageId).toMatch(/^<.+@.+>$/);
    }
  });

  it("setzt keinen Reply-To-Header", async () => {
    const mailer = createJsonMailer("korrektur@example.tld");
    const result = await mailer.send({
      to: "leserbriefe@beispiel-zeitung.de",
      subject: "Betreff [K7QW3M]",
      text: "Text",
    });
    expect(result.ok).toBe(true);
  });

  it("meldet einen Fehler statt zu werfen", async () => {
    const mailer = createJsonMailer("korrektur@example.tld");
    const result = await mailer.send({ to: "", subject: "x", text: "y" });
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 3: Test laufen lassen, Fehlschlag bestätigen**

```bash
pnpm vitest run packages/api/src/dispatch/send.test.ts
```

Erwartet: FAIL — `./send.js` nicht auflösbar.

- [ ] **Step 4: Implementieren**

`packages/api/src/dispatch/send.ts`:

```ts
import nodemailer, { type Transporter } from "nodemailer";
import type { Env } from "../env.js";

export interface OutgoingMail {
  to: string;
  subject: string;
  text: string;
}

export type SendResult = { ok: true; messageId: string } | { ok: false; error: string };

export interface Mailer {
  send(message: OutgoingMail): Promise<SendResult>;
}

function wrap(transport: Transporter, from: string): Mailer {
  return {
    async send(message: OutgoingMail): Promise<SendResult> {
      if (message.to.trim().length === 0) {
        return { ok: false, error: "Kein Empfänger angegeben" };
      }
      try {
        // Bewusst ohne Reply-To: der Referenz-Token lebt im Betreff (§7).
        const info = await transport.sendMail({
          from,
          to: message.to,
          subject: message.subject,
          text: message.text,
        });
        return { ok: true, messageId: info.messageId };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Unbekannter Fehler" };
      }
    },
  };
}

export function createSmtpMailer(env: Env): Mailer {
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    requireTLS: env.SMTP_PORT !== 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
  });
  return wrap(transport, env.MAIL_FROM);
}

/** Baut die Nachricht vollständig, verschickt aber nichts — für Tests und Trockenläufe. */
export function createJsonMailer(from: string): Mailer {
  return wrap(nodemailer.createTransport({ jsonTransport: true }), from);
}
```

- [ ] **Step 5: Test laufen lassen, Erfolg bestätigen**

```bash
pnpm vitest run packages/api/src/dispatch/send.test.ts
```

Erwartet: 3 Tests grün.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/dispatch/send.ts packages/api/src/dispatch/send.test.ts packages/api/package.json pnpm-lock.yaml
git commit -m "SMTP-Versand ueber Relay mit JSON-Transport fuer Tests"
```

---

### Task 15: Outlet-Auflösung und automatische Anlage

**Files:**
- Create: `packages/api/src/repo/outlets.ts`
- Test: `packages/api/src/repo/outlets.test.ts`

**Interfaces:**
- Consumes: Tabellen aus Task 7, `Db` aus Task 7
- Produces: aus `packages/api/src/repo/outlets.ts`: `resolveOutletByHost(db: Db, host: string): OutletRecord | null`, `ensureOutletForHost(db: Db, host: string, now: number): { outlet: OutletRecord; created: boolean }`, `listOutlets(db: Db, options?: { includeArchived?: boolean }): OutletRecord[]`, `createOutlet(db: Db, input: OutletInput, now: number): OutletRecord`, `updateOutlet(db: Db, id: string, input: OutletInput): OutletRecord | null`, `removeOutlet(db: Db, id: string): "deleted" | "archived" | "missing"`, `addDomain(db: Db, outletId: string, domain: string): boolean`, `removeDomain(db: Db, outletId: string, domain: string): boolean`
- `OutletRecord = typeof outlets.$inferSelect & { domains: string[] }`
- `OutletInput = { name: string; primaryDomain: string; publisher: string | null; country: string | null; notes: string | null; contactEmails: string[] }`

Die Auflösung geht über `outlet_domains`, nicht über `outlets.primary_domain` — ein Outlet führt beliebig viele Domains (§5.0).

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`packages/api/src/repo/outlets.test.ts`:

```ts
import { createId } from "@paralleldrive/cuid2";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, runMigrations, type Db } from "../db/client.js";
import { corrections, errorTypes } from "../db/schema.js";
import {
  addDomain,
  createOutlet,
  ensureOutletForHost,
  listOutlets,
  removeOutlet,
  resolveOutletByHost,
  updateOutlet,
} from "./outlets.js";

const NOW = 1_800_000_000;
let db: Db;

beforeEach(() => {
  db = createDb(":memory:");
  runMigrations(db);
});

function baseInput(name: string, domain: string) {
  return {
    name,
    primaryDomain: domain,
    publisher: null,
    country: "DE",
    notes: null,
    contactEmails: ["leserbriefe@" + domain],
  };
}

describe("Outlet-Auflösung", () => {
  it("findet ein Outlet über eine Nebendomain", () => {
    const outlet = createOutlet(db, baseInput("Beispiel-Zeitung", "beispiel-zeitung.de"), NOW);
    addDomain(db, outlet.id, "magazin.beispiel-zeitung.de");

    expect(resolveOutletByHost(db, "magazin.beispiel-zeitung.de")?.id).toBe(outlet.id);
    expect(resolveOutletByHost(db, "unbekannt.de")).toBeNull();
  });

  it("legt bei unbekanntem Host ein Outlet an und meldet das", () => {
    const first = ensureOutletForHost(db, "neue-zeitung.de", NOW);
    expect(first.created).toBe(true);
    expect(first.outlet.name).toBe("neue-zeitung.de");
    expect(first.outlet.domains).toEqual(["neue-zeitung.de"]);

    const second = ensureOutletForHost(db, "neue-zeitung.de", NOW);
    expect(second.created).toBe(false);
    expect(second.outlet.id).toBe(first.outlet.id);
  });

  it("verweigert eine Domain, die schon zu einem anderen Outlet gehört", () => {
    const a = createOutlet(db, baseInput("A", "a.de"), NOW);
    createOutlet(db, baseInput("B", "b.de"), NOW);
    expect(addDomain(db, a.id, "b.de")).toBe(false);
  });
});

describe("Outlet-Pflege", () => {
  it("ändert Stammdaten und Kontaktadressen", () => {
    const outlet = createOutlet(db, baseInput("Alt", "alt.de"), NOW);
    const updated = updateOutlet(db, outlet.id, {
      ...baseInput("Neu", "alt.de"),
      contactEmails: ["redaktion@alt.de", "leserbriefe@alt.de"],
    });
    expect(updated?.name).toBe("Neu");
    expect(updated?.contactEmails).toHaveLength(2);
  });

  it("löscht ein Outlet ohne Referenzen hart", () => {
    const outlet = createOutlet(db, baseInput("Leer", "leer.de"), NOW);
    expect(removeOutlet(db, outlet.id)).toBe("deleted");
    expect(listOutlets(db, { includeArchived: true })).toHaveLength(0);
  });

  it("archiviert ein referenziertes Outlet, statt es zu löschen", () => {
    const outlet = createOutlet(db, baseInput("Benutzt", "benutzt.de"), NOW);
    const errorTypeId = createId();
    db.insert(errorTypes)
      .values({ id: errorTypeId, key: "zahl", label: "Zahl", sortOrder: 10, createdAt: NOW })
      .run();
    db.insert(corrections)
      .values({
        id: createId(),
        ref: "K7QW3M",
        idempotencyKey: "idem-1",
        createdAt: NOW,
        dispatchMode: "smtp",
        articleUrl: "https://benutzt.de/a",
        articleUrlCanon: "https://benutzt.de/a",
        outletId: outlet.id,
        errorTypeId,
        severity: 2,
        quoteBefore: "Zitat",
        suggestionAfter: "Vorschlag",
        recipientEmail: "leserbriefe@benutzt.de",
        source: "web",
      })
      .run();

    expect(removeOutlet(db, outlet.id)).toBe("archived");
    expect(listOutlets(db)).toHaveLength(0);
    expect(listOutlets(db, { includeArchived: true })).toHaveLength(1);
  });

  it("meldet missing bei unbekannter Kennung", () => {
    expect(removeOutlet(db, "gibt-es-nicht")).toBe("missing");
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
pnpm vitest run packages/api/src/repo/outlets.test.ts
```

Erwartet: FAIL — `./outlets.js` nicht auflösbar.

- [ ] **Step 3: Implementieren**

`packages/api/src/repo/outlets.ts`:

```ts
import { createId } from "@paralleldrive/cuid2";
import { and, eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { corrections, outletDomains, outlets } from "../db/schema.js";

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

/**
 * Referenzierte Stammdaten werden archiviert, nie gelöscht — sonst änderten sich
 * veröffentlichte Zahlen rückwirkend (§5.0).
 */
export function removeOutlet(db: Db, id: string): "deleted" | "archived" | "missing" {
  const existing = db.select().from(outlets).where(eq(outlets.id, id)).get();
  if (!existing) return "missing";

  const referenced = db.select().from(corrections).where(eq(corrections.outletId, id)).get();
  if (referenced) {
    db.update(outlets).set({ archived: true }).where(eq(outlets.id, id)).run();
    return "archived";
  }

  db.delete(outletDomains).where(eq(outletDomains.outletId, id)).run();
  db.delete(outlets).where(eq(outlets.id, id)).run();
  return "deleted";
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
```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

```bash
pnpm vitest run packages/api/src/repo/outlets.test.ts
```

Erwartet: 8 Tests grün.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/repo/outlets.ts packages/api/src/repo/outlets.test.ts
git commit -m "Outlet-Aufloesung ueber Domaintabelle mit Archivierung statt Loeschung"
```

---

### Task 16: Fehlerarten-Pflege

**Files:**
- Create: `packages/api/src/repo/errorTypes.ts`
- Test: `packages/api/src/repo/errorTypes.test.ts`

**Interfaces:**
- Consumes: Tabellen aus Task 7
- Produces: aus `packages/api/src/repo/errorTypes.ts`: `listErrorTypes(db: Db, options?: { includeArchived?: boolean }): ErrorTypeRecord[]`, `getErrorTypeByKey(db: Db, key: string): ErrorTypeRecord | null`, `createErrorType(db: Db, input: ErrorTypeInput, now: number): ErrorTypeRecord | null`, `updateErrorType(db: Db, id: string, input: Omit<ErrorTypeInput, "key">): ErrorTypeRecord | null`, `removeErrorType(db: Db, id: string): "deleted" | "archived" | "missing"`
- `ErrorTypeRecord = typeof errorTypes.$inferSelect`
- `ErrorTypeInput = { key: string; label: string; description: string | null; sortOrder: number }`

`updateErrorType` nimmt `key` bewusst nicht entgegen: Er steht im Meta-Block versendeter Mails und ist dort nicht nachträglich korrigierbar (§5.0).

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`packages/api/src/repo/errorTypes.test.ts`:

```ts
import { createId } from "@paralleldrive/cuid2";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, runMigrations, type Db } from "../db/client.js";
import { corrections, outlets } from "../db/schema.js";
import {
  createErrorType,
  getErrorTypeByKey,
  listErrorTypes,
  removeErrorType,
  updateErrorType,
} from "./errorTypes.js";

const NOW = 1_800_000_000;
let db: Db;

beforeEach(() => {
  db = createDb(":memory:");
  runMigrations(db);
});

describe("Fehlerarten", () => {
  it("legt eine Fehlerart an und findet sie über den Schlüssel", () => {
    const created = createErrorType(
      db,
      { key: "link", label: "Toter Link", description: null, sortOrder: 130 },
      NOW,
    );
    expect(created?.key).toBe("link");
    expect(getErrorTypeByKey(db, "link")?.id).toBe(created?.id);
  });

  it("verweigert einen doppelten Schlüssel", () => {
    createErrorType(db, { key: "link", label: "Toter Link", description: null, sortOrder: 130 }, NOW);
    expect(
      createErrorType(db, { key: "link", label: "Anderer Name", description: null, sortOrder: 140 }, NOW),
    ).toBeNull();
  });

  it("ändert Bezeichnung und Reihenfolge, aber nicht den Schlüssel", () => {
    const created = createErrorType(
      db,
      { key: "link", label: "Toter Link", description: null, sortOrder: 130 },
      NOW,
    );
    const updated = updateErrorType(db, created!.id, {
      label: "Defekter Link",
      description: "Ziel nicht erreichbar.",
      sortOrder: 90,
    });
    expect(updated?.label).toBe("Defekter Link");
    expect(updated?.sortOrder).toBe(90);
    expect(updated?.key).toBe("link");
  });

  it("sortiert nach sortOrder", () => {
    createErrorType(db, { key: "b", label: "B", description: null, sortOrder: 20 }, NOW);
    createErrorType(db, { key: "a", label: "A", description: null, sortOrder: 10 }, NOW);
    expect(listErrorTypes(db).map((e) => e.key)).toEqual(["a", "b"]);
  });

  it("löscht eine unbenutzte Fehlerart hart", () => {
    const created = createErrorType(db, { key: "link", label: "L", description: null, sortOrder: 1 }, NOW);
    expect(removeErrorType(db, created!.id)).toBe("deleted");
    expect(listErrorTypes(db, { includeArchived: true })).toHaveLength(0);
  });

  it("archiviert eine benutzte Fehlerart", () => {
    const created = createErrorType(db, { key: "link", label: "L", description: null, sortOrder: 1 }, NOW);
    const outletId = createId();
    db.insert(outlets).values({ id: outletId, name: "X", primaryDomain: "x.de", createdAt: NOW }).run();
    db.insert(corrections)
      .values({
        id: createId(),
        ref: "K7QW3M",
        idempotencyKey: "idem-1",
        createdAt: NOW,
        dispatchMode: "smtp",
        articleUrl: "https://x.de/a",
        articleUrlCanon: "https://x.de/a",
        outletId,
        errorTypeId: created!.id,
        severity: 2,
        quoteBefore: "Zitat",
        suggestionAfter: "Vorschlag",
        recipientEmail: "leserbriefe@x.de",
        source: "web",
      })
      .run();

    expect(removeErrorType(db, created!.id)).toBe("archived");
    expect(listErrorTypes(db)).toHaveLength(0);
    expect(listErrorTypes(db, { includeArchived: true })).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
pnpm vitest run packages/api/src/repo/errorTypes.test.ts
```

Erwartet: FAIL — `./errorTypes.js` nicht auflösbar.

- [ ] **Step 3: Implementieren**

`packages/api/src/repo/errorTypes.ts`:

```ts
import { createId } from "@paralleldrive/cuid2";
import { asc, eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { corrections, errorTypes } from "../db/schema.js";

export type ErrorTypeRecord = typeof errorTypes.$inferSelect;

export interface ErrorTypeInput {
  key: string;
  label: string;
  description: string | null;
  sortOrder: number;
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

/** Gibt null zurück, wenn der Schlüssel bereits vergeben ist. */
export function createErrorType(db: Db, input: ErrorTypeInput, now: number): ErrorTypeRecord | null {
  if (getErrorTypeByKey(db, input.key)) return null;

  const id = createId();
  db.insert(errorTypes)
    .values({
      id,
      key: input.key,
      label: input.label,
      description: input.description,
      sortOrder: input.sortOrder,
      createdAt: now,
    })
    .run();
  return db.select().from(errorTypes).where(eq(errorTypes.id, id)).get() ?? null;
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
    .set({ label: input.label, description: input.description, sortOrder: input.sortOrder })
    .where(eq(errorTypes.id, id))
    .run();
  return db.select().from(errorTypes).where(eq(errorTypes.id, id)).get() ?? null;
}

export function removeErrorType(db: Db, id: string): "deleted" | "archived" | "missing" {
  const existing = db.select().from(errorTypes).where(eq(errorTypes.id, id)).get();
  if (!existing) return "missing";

  const referenced = db.select().from(corrections).where(eq(corrections.errorTypeId, id)).get();
  if (referenced) {
    db.update(errorTypes).set({ archived: true }).where(eq(errorTypes.id, id)).run();
    return "archived";
  }

  db.delete(errorTypes).where(eq(errorTypes.id, id)).run();
  return "deleted";
}
```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

```bash
pnpm vitest run packages/api/src/repo/errorTypes.test.ts
```

Erwartet: 6 Tests grün.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/repo/errorTypes.ts packages/api/src/repo/errorTypes.test.ts
git commit -m "Fehlerarten-Pflege mit gesperrtem Schluessel und Archivierung"
```

---

### Task 17: Zod-Schemas in `shared`

**Files:**
- Create: `packages/shared/src/schemas.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/schemas.test.ts`

**Interfaces:**
- Consumes: `QUOTE_MAX_LENGTH` aus `./constants.js`
- Produces: aus `@korrektur/shared`: `newCorrectionSchema`, `type NewCorrectionInput`, `outletInputSchema`, `type OutletInputDto`, `errorTypeInputSchema`, `type ErrorTypeInputDto`, `errorTypeUpdateSchema`

Einzige Quelle der Wahrheit für die Eingabetypen — Formular, API-Endpunkt und späterer Altbestands-Import validieren gegen dieselben Schemas.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`packages/shared/src/schemas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { QUOTE_MAX_LENGTH } from "./constants.js";
import { errorTypeInputSchema, newCorrectionSchema, outletInputSchema } from "./schemas.js";

const VALID = {
  idempotencyKey: "abcdef0123456789",
  articleUrl: "https://beispiel-zeitung.de/a",
  errorTypeKey: "zahl",
  severity: 2,
  quoteBefore: "rund 4,2 Millionen",
  suggestionAfter: "rund 2,4 Millionen",
};

describe("newCorrectionSchema", () => {
  it("nimmt eine gültige Eingabe an und setzt Vorgaben", () => {
    const parsed = newCorrectionSchema.parse(VALID);
    expect(parsed.headline).toBeNull();
    expect(parsed.comment).toBeNull();
  });

  it("weist ein zu langes Zitat ab", () => {
    const result = newCorrectionSchema.safeParse({
      ...VALID,
      quoteBefore: "x".repeat(QUOTE_MAX_LENGTH + 1),
    });
    expect(result.success).toBe(false);
  });

  it("weist eine unzulässige Schwere ab", () => {
    expect(newCorrectionSchema.safeParse({ ...VALID, severity: 4 }).success).toBe(false);
  });

  it("weist eine ungültige URL ab", () => {
    expect(newCorrectionSchema.safeParse({ ...VALID, articleUrl: "kein-url" }).success).toBe(false);
  });

  it("kennt kein Autorenfeld", () => {
    const parsed = newCorrectionSchema.parse({ ...VALID, author: "Jemand" });
    expect(Object.keys(parsed)).not.toContain("author");
  });
});

describe("outletInputSchema", () => {
  it("nimmt mehrere Kontaktadressen an", () => {
    const parsed = outletInputSchema.parse({
      name: "Beispiel-Zeitung",
      primaryDomain: "Beispiel-Zeitung.DE",
      contactEmails: ["leserbriefe@beispiel-zeitung.de", "redaktion@beispiel-zeitung.de"],
    });
    expect(parsed.primaryDomain).toBe("beispiel-zeitung.de");
    expect(parsed.contactEmails).toHaveLength(2);
  });

  it("weist eine ungültige Adresse ab", () => {
    const result = outletInputSchema.safeParse({
      name: "X",
      primaryDomain: "x.de",
      contactEmails: ["keine-adresse"],
    });
    expect(result.success).toBe(false);
  });
});

describe("errorTypeInputSchema", () => {
  it("erzwingt einen Slug als Schlüssel", () => {
    expect(errorTypeInputSchema.safeParse({ key: "Toter Link", label: "L", sortOrder: 10 }).success).toBe(false);
    expect(errorTypeInputSchema.safeParse({ key: "toter_link", label: "L", sortOrder: 10 }).success).toBe(true);
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
pnpm vitest run packages/shared/src/schemas.test.ts
```

Erwartet: FAIL — `./schemas.js` nicht auflösbar.

- [ ] **Step 3: Implementieren**

`packages/shared/src/schemas.ts`:

```ts
import { z } from "zod";
import { QUOTE_MAX_LENGTH } from "./constants.js";

const nullableTrimmed = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v.length === 0 ? null : v))
    .nullable()
    .default(null);

/**
 * Eingabe einer neuen Meldung. Kein Autorenfeld — bewusst nicht erhoben (§2.1).
 * `strip` (Zod-Vorgabe) entfernt unbekannte Felder, statt sie durchzureichen.
 */
export const newCorrectionSchema = z.object({
  idempotencyKey: z.string().min(8).max(128),
  articleUrl: z.string().url(),
  headline: nullableTrimmed(300),
  errorTypeKey: z.string().min(1).max(64),
  severity: z.coerce.number().int().min(1).max(3),
  quoteBefore: z.string().trim().min(1).max(QUOTE_MAX_LENGTH),
  suggestionAfter: z.string().trim().min(1).max(500),
  comment: nullableTrimmed(1000),
  recipientEmail: z.string().email().optional(),
});

export type NewCorrectionInput = z.infer<typeof newCorrectionSchema>;

export const outletInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  primaryDomain: z
    .string()
    .trim()
    .min(3)
    .max(253)
    .transform((v) => v.toLowerCase().replace(/^www\./, "")),
  publisher: nullableTrimmed(200),
  country: nullableTrimmed(2),
  notes: nullableTrimmed(2000),
  contactEmails: z.array(z.string().email()).max(10).default([]),
});

export type OutletInputDto = z.infer<typeof outletInputSchema>;

export const errorTypeInputSchema = z.object({
  key: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9_]+$/, "Nur Kleinbuchstaben, Ziffern und Unterstrich"),
  label: z.string().trim().min(1).max(120),
  description: nullableTrimmed(500),
  sortOrder: z.coerce.number().int().min(0).max(10_000),
});

export type ErrorTypeInputDto = z.infer<typeof errorTypeInputSchema>;

/** Der Schlüssel fehlt bewusst: unveränderlich nach Anlage (§5.0). */
export const errorTypeUpdateSchema = errorTypeInputSchema.omit({ key: true });
```

`packages/shared/src/index.ts` ergänzen: `export * from "./schemas.js";`

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

```bash
pnpm vitest run packages/shared/src/schemas.test.ts
```

Erwartet: 8 Tests grün.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/schemas.ts packages/shared/src/schemas.test.ts packages/shared/src/index.ts
git commit -m "Zod-Schemas fuer Meldung, Redaktion und Fehlerart"
```

---

### Task 18: Meldung anlegen und versenden

**Files:**
- Create: `packages/api/src/repo/corrections.ts`
- Test: `packages/api/src/repo/corrections.test.ts`

**Interfaces:**
- Consumes: `canonicalizeUrl`, `generateRef`, `NewCorrectionInput` aus `@korrektur/shared`; `ensureOutletForHost` aus Task 15; `getErrorTypeByKey` aus Task 16; `extractArticle` aus Task 10; `deriveAnchors` aus Task 11; `fetchArticle`/`FetchResult` aus Task 12; `composeMail` aus Task 13; `Mailer` aus Task 14
- Produces: aus `packages/api/src/repo/corrections.ts`:
  - `interface CreateDeps { db: Db; mailer: Mailer; fetchArticle: (url: string) => Promise<FetchResult>; now: () => number; baseUrl: string }`
  - `type CreateResult = { ok: true; created: boolean; id: string; ref: string; anchorQuality: "exact" | "context" | "none"; dispatchStatus: "sent" | "failed" } | { ok: false; error: "invalid_url" | "unknown_error_type" | "no_recipient"; message: string }`
  - `createCorrection(deps: CreateDeps, input: NewCorrectionInput): Promise<CreateResult>`
  - `getCorrectionByRef(db: Db, ref: string): typeof corrections.$inferSelect | null`

Das ist die gemeinsame Orchestrierung. Formular (Task 20) und API-Endpunkt (Task 23) sind beide nur dünne Adapter darauf — es gibt genau einen Schreibpfad.

Reihenfolge nach §6: Validierung → Kanonisierung → Outlet → Artikel abrufen und Anker → `ref` → Mail → Status setzen. Ein fehlgeschlagener Artikelabruf bricht **nicht** ab; er führt zu `anchorQuality: "none"` und `needsReview`.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`packages/api/src/repo/corrections.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, runMigrations, type Db } from "../db/client.js";
import { seed } from "../db/seed.js";
import { corrections } from "../db/schema.js";
import { createJsonMailer, type Mailer } from "../dispatch/send.js";
import type { FetchResult } from "../article/fetch.js";
import { createOutlet } from "./outlets.js";
import { createCorrection, getCorrectionByRef, type CreateDeps } from "./corrections.js";

const NOW = 1_800_000_000;
const HTML = readFileSync(resolve(process.cwd(), "tests/fixtures/artikel-standard.html"), "utf8");

let db: Db;

const INPUT = {
  idempotencyKey: "abcdef0123456789",
  articleUrl: "https://beispiel-zeitung.de/politik/artikel-123?utm_source=x",
  headline: null,
  errorTypeKey: "zahl",
  severity: 2,
  quoteBefore: "rund 4,2 Millionen Menschen",
  suggestionAfter: "rund 2,4 Millionen Menschen",
  comment: null,
};

function deps(overrides: Partial<CreateDeps> = {}): CreateDeps {
  return {
    db,
    mailer: createJsonMailer("korrektur@example.tld"),
    fetchArticle: async (): Promise<FetchResult> => ({ ok: true, status: 200, html: HTML }),
    now: () => NOW,
    baseUrl: "https://korrektur.example.tld",
    ...overrides,
  };
}

beforeEach(() => {
  db = createDb(":memory:");
  runMigrations(db);
  seed(db);
  createOutlet(
    db,
    {
      name: "Beispiel-Zeitung",
      primaryDomain: "beispiel-zeitung.de",
      publisher: null,
      country: "DE",
      notes: null,
      contactEmails: ["leserbriefe@beispiel-zeitung.de"],
    },
    NOW,
  );
});

describe("createCorrection", () => {
  it("legt eine Meldung an, versendet sie und leitet Anker ab", async () => {
    const result = await createCorrection(deps(), INPUT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.created).toBe(true);
    expect(result.dispatchStatus).toBe("sent");
    expect(result.anchorQuality).toBe("exact");
    expect(result.ref).toMatch(/^K[0-9A-HJKMNP-TV-Z]{5}$/);

    const row = getCorrectionByRef(db, result.ref);
    expect(row?.articleUrlCanon).toBe("https://beispiel-zeitung.de/politik/artikel-123");
    expect(row?.recipientEmail).toBe("leserbriefe@beispiel-zeitung.de");
    expect(row?.messageId).toMatch(/^<.+>$/);
    expect(row?.sentAt).toBe(NOW);
    expect(row?.quotePrefix).toContain("Im vergangenen Jahr nutzten");
  });

  it("erzeugt bei gleichem Idempotency-Key keinen zweiten Datensatz", async () => {
    const first = await createCorrection(deps(), INPUT);
    const second = await createCorrection(deps(), INPUT);

    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.created).toBe(false);
    expect(second.ref).toBe(first.ref);
    expect(db.select().from(corrections).all()).toHaveLength(1);
  });

  it("speichert trotz fehlgeschlagenem Artikelabruf und markiert zur Prüfung", async () => {
    const result = await createCorrection(
      deps({ fetchArticle: async () => ({ ok: false, status: 403, reason: "http" }) }),
      INPUT,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.anchorQuality).toBe("none");

    const row = getCorrectionByRef(db, result.ref);
    expect(row?.needsReview).toBe(true);
    expect(row?.dispatchStatus).toBe("sent");
  });

  it("markiert einen mehrdeutigen Fundort zur Prüfung", async () => {
    const html = "<html><body><article><h1>T</h1><p>Beta hier. Und Beta dort.</p></article></body></html>";
    const result = await createCorrection(
      deps({ fetchArticle: async () => ({ ok: true, status: 200, html }) }),
      { ...INPUT, quoteBefore: "Beta" },
    );
    expect(result.ok && result.anchorQuality).toBe("context");
    if (!result.ok) return;
    expect(getCorrectionByRef(db, result.ref)?.needsReview).toBe(true);
  });

  it("legt ein unbekanntes Outlet an, verweigert aber den Versand ohne Kontaktadresse", async () => {
    const result = await createCorrection(deps(), {
      ...INPUT,
      articleUrl: "https://neue-zeitung.de/a",
      idempotencyKey: "0123456789abcdef",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("no_recipient");
    expect(db.select().from(corrections).all()).toHaveLength(0);
  });

  it("meldet eine unbekannte Fehlerart", async () => {
    const result = await createCorrection(deps(), { ...INPUT, errorTypeKey: "gibt-es-nicht" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("unknown_error_type");
  });

  it("setzt bei Versandfehler failed, ohne den Datensatz zu verlieren", async () => {
    const failing: Mailer = { send: async () => ({ ok: false, error: "Relay verweigert" }) };
    const result = await createCorrection(deps({ mailer: failing }), INPUT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.dispatchStatus).toBe("failed");

    const row = getCorrectionByRef(db, result.ref);
    expect(row?.sentAt).toBeNull();
    expect(row?.needsReview).toBe(true);
  });

  it("würfelt einen neuen ref, wenn der erste kollidiert", async () => {
    const folge = ["K7QW3M", "K7QW3M", "KAB2CD"];
    let index = 0;
    const makeRef = () => folge[index++] ?? "KZZZZZ";

    const first = await createCorrection(deps({ generateRef: makeRef }), INPUT);
    const second = await createCorrection(deps({ generateRef: makeRef }), {
      ...INPUT,
      idempotencyKey: "fedcba9876543210",
    });

    expect(first.ok && first.ref).toBe("K7QW3M");
    // Der zweite Versuch kollidiert, der dritte greift.
    expect(second.ok && second.ref).toBe("KAB2CD");
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
pnpm vitest run packages/api/src/repo/corrections.test.ts
```

Erwartet: FAIL — `./corrections.js` nicht auflösbar.

- [ ] **Step 3: Implementieren**

`packages/api/src/repo/corrections.ts`:

```ts
import { canonicalizeUrl, generateRef, type NewCorrectionInput } from "@korrektur/shared";
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

function reserveRef(makeRef: () => string, insert: (ref: string) => void): string {
  for (let attempt = 0; attempt < REF_ATTEMPTS; attempt++) {
    const ref = makeRef();
    try {
      insert(ref);
      return ref;
    } catch (error) {
      const unique = error instanceof Error && /UNIQUE/i.test(error.message);
      if (!unique || attempt === REF_ATTEMPTS - 1) throw error;
    }
  }
  throw new Error("Kein freier Referenz-Token gefunden");
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
  if (existing) {
    return {
      ok: true,
      created: false,
      id: existing.id,
      ref: existing.ref,
      anchorQuality: existing.anchorQuality,
      dispatchStatus: existing.dispatchStatus === "sent" ? "sent" : "failed",
    };
  }

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
  const fetched = await deps.fetchArticle(canon.canonical);
  if (fetched.ok) {
    const article = extractArticle(fetched.html, canon.canonical);
    if (article) {
      anchors = deriveAnchors(article.text, input.quoteBefore);
      headline = headline ?? article.title;
    }
  }

  const id = createId();
  const ref = reserveRef(deps.generateRef ?? generateRef, (candidate) => {
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

  const mail = composeMail({
    ref,
    articleUrl: input.articleUrl,
    articleUrlCanon: canon.canonical,
    headline,
    errorTypeKey: errorType.key,
    errorTypeLabel: errorType.label,
    severity: input.severity as 1 | 2 | 3,
    quoteBefore: input.quoteBefore,
    suggestionAfter: input.suggestionAfter,
    comment: input.comment,
    baseUrl: deps.baseUrl,
  });

  const sent = await deps.mailer.send({ to: recipient, subject: mail.subject, text: mail.text });

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
    dispatchStatus: sent.ok ? "sent" : "failed",
  };
}
```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

```bash
pnpm vitest run packages/api/src/repo/corrections.test.ts
```

Erwartet: 8 Tests grün.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/repo/corrections.ts packages/api/src/repo/corrections.test.ts
git commit -m "Orchestrierung: Meldung anlegen, Anker ableiten, versenden"
```

---

### Task 19: Basic-Auth und Seitengerüst

**Files:**
- Create: `packages/api/src/auth.ts`, `packages/api/src/views/layout.tsx`
- Test: `packages/api/src/auth.test.ts`

**Interfaces:**
- Consumes: `Env` aus Task 2
- Produces: `adminAuth(env: Env): MiddlewareHandler` aus `packages/api/src/auth.ts`; `Layout(props: { title: string; children?: unknown }): JSX.Element` aus `packages/api/src/views/layout.tsx`

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`packages/api/src/auth.test.ts`:

```ts
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { adminAuth } from "./auth.js";
import type { Env } from "./env.js";

const ENV = {
  PORT: 3000,
  DATABASE_PATH: ":memory:",
  ADMIN_USER: "admin",
  ADMIN_PASSWORD: "geheimes-passwort",
  PUBLIC_BASE_URL: "https://korrekturen.msmr.co",
  SMTP_HOST: "mail.example.tld",
  SMTP_PORT: 587,
  SMTP_USER: "korrektur@example.tld",
  SMTP_PASSWORD: "x",
  MAIL_FROM: "korrektur@example.tld",
} satisfies Env;

function app() {
  const instance = new Hono();
  instance.use("/geschuetzt/*", adminAuth(ENV));
  instance.get("/geschuetzt/x", (c) => c.text("ok"));
  return instance;
}

function header(user: string, password: string): string {
  return `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;
}

describe("adminAuth", () => {
  it("verlangt ohne Anmeldung eine Authentifizierung", async () => {
    const res = await app().request("/geschuetzt/x");
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain("Basic");
  });

  it("weist falsche Zugangsdaten ab", async () => {
    const res = await app().request("/geschuetzt/x", {
      headers: { authorization: header("admin", "falsch") },
    });
    expect(res.status).toBe(401);
  });

  it("lässt korrekte Zugangsdaten durch", async () => {
    const res = await app().request("/geschuetzt/x", {
      headers: { authorization: header("admin", "geheimes-passwort") },
    });
    expect(res.status).toBe(200);
    await expect(res.text()).resolves.toBe("ok");
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
pnpm vitest run packages/api/src/auth.test.ts
```

Erwartet: FAIL — `./auth.js` nicht auflösbar.

- [ ] **Step 3: Implementieren**

`packages/api/src/auth.ts`:

```ts
import { basicAuth } from "hono/basic-auth";
import type { MiddlewareHandler } from "hono";
import type { Env } from "./env.js";

/**
 * Schutz auf Anwendungsebene (§13). Auf gemanagtem Hosting gibt es keinen
 * eigenen Reverse Proxy zum Konfigurieren; TLS liefert Plesk.
 */
export function adminAuth(env: Env): MiddlewareHandler {
  return basicAuth({ username: env.ADMIN_USER, password: env.ADMIN_PASSWORD });
}
```

`packages/api/src/views/layout.tsx`:

```tsx
import type { FC, PropsWithChildren } from "hono/jsx";

const STYLES = `
  :root { color-scheme: light dark; --line: color-mix(in oklab, currentColor 20%, transparent); }
  body { font: 16px/1.55 system-ui, sans-serif; margin: 0; padding: 1.5rem; max-width: 46rem; }
  h1 { font-size: 1.4rem; margin: 0 0 1.25rem; }
  h2 { font-size: 1.1rem; margin: 2rem 0 .75rem; }
  nav { margin-bottom: 1.5rem; display: flex; gap: 1rem; flex-wrap: wrap; }
  label { display: block; margin: 1rem 0 .25rem; font-weight: 600; }
  input, textarea, select { width: 100%; padding: .5rem; font: inherit; box-sizing: border-box;
    border: 1px solid var(--line); border-radius: .25rem; background: transparent; color: inherit; }
  textarea { min-height: 5rem; }
  button { margin-top: 1.25rem; padding: .6rem 1.2rem; font: inherit; cursor: pointer;
    border: 1px solid var(--line); border-radius: .25rem; background: transparent; color: inherit; }
  .hinweis { padding: .75rem; border: 1px solid var(--line); border-radius: .25rem; margin: 1rem 0; }
  .zaehler { font-weight: 400; font-size: .85rem; opacity: .75; }
  table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
  th, td { text-align: left; padding: .4rem .5rem; border-bottom: 1px solid var(--line); }
  form.inline { display: inline; }
`;

export const Layout: FC<PropsWithChildren<{ title: string }>> = ({ title, children }) => (
  <html lang="de">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="robots" content="noindex" />
      <title>{title}</title>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
    </head>
    <body>
      <nav>
        <a href="/neu">Neue Meldung</a>
        <a href="/admin/redaktionen">Redaktionen</a>
        <a href="/admin/fehlerarten">Fehlerarten</a>
      </nav>
      <h1>{title}</h1>
      {children}
    </body>
  </html>
);
```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

```bash
pnpm vitest run packages/api/src/auth.test.ts
```

Erwartet: 3 Tests grün.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/auth.ts packages/api/src/auth.test.ts packages/api/src/views/layout.tsx
git commit -m "Basic-Auth auf Anwendungsebene und Seitengeruest"
```

---

### Task 20: Erfassungsformular

**Files:**
- Create: `packages/api/src/views/capture.tsx`, `packages/api/src/routes/capture.tsx`
- Test: `packages/api/src/routes/capture.test.ts`

Beide Routendateien enthalten JSX und heißen deshalb `.tsx`. Importiert werden sie
trotzdem als `./capture.js` — TypeScript löst die `.js`-Endung auf die `.tsx`-Quelle auf.

**Interfaces:**
- Consumes: `Layout` aus Task 19, `listErrorTypes` aus Task 16, `createCorrection`/`CreateDeps` aus Task 18, `newCorrectionSchema` aus Task 17
- Produces: `captureRoutes(deps: CreateDeps): Hono` aus `packages/api/src/routes/capture.ts`

`GET /neu` nimmt `?url=` und `?text=` entgegen — beides liefert das Share-Sheet, wenn beim Teilen Text markiert war. Der Idempotency-Key wird als verstecktes Feld beim Rendern erzeugt; Doppelklick auf „Absenden" erzeugt dadurch keinen zweiten Datensatz.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`packages/api/src/routes/capture.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, runMigrations, type Db } from "../db/client.js";
import { corrections } from "../db/schema.js";
import { seed } from "../db/seed.js";
import { createJsonMailer } from "../dispatch/send.js";
import { createOutlet } from "../repo/outlets.js";
import type { CreateDeps } from "../repo/corrections.js";
import { captureRoutes } from "./capture.js";

const NOW = 1_800_000_000;
const HTML = readFileSync(resolve(process.cwd(), "tests/fixtures/artikel-standard.html"), "utf8");

let db: Db;
let deps: CreateDeps;

beforeEach(() => {
  db = createDb(":memory:");
  runMigrations(db);
  seed(db);
  createOutlet(
    db,
    {
      name: "Beispiel-Zeitung",
      primaryDomain: "beispiel-zeitung.de",
      publisher: null,
      country: "DE",
      notes: null,
      contactEmails: ["leserbriefe@beispiel-zeitung.de"],
    },
    NOW,
  );
  deps = {
    db,
    mailer: createJsonMailer("korrektur@example.tld"),
    fetchArticle: async () => ({ ok: true, status: 200, html: HTML }),
    now: () => NOW,
    baseUrl: "https://korrektur.example.tld",
  };
});

function form(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  const fields: Record<string, string> = {
    idempotencyKey: "abcdef0123456789",
    articleUrl: "https://beispiel-zeitung.de/politik/artikel-123",
    headline: "",
    errorTypeKey: "zahl",
    severity: "2",
    quoteBefore: "rund 4,2 Millionen Menschen",
    suggestionAfter: "rund 2,4 Millionen Menschen",
    comment: "",
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

describe("GET /neu", () => {
  it("rendert das Formular mit allen Fehlerarten", async () => {
    const res = await captureRoutes(deps).request("/neu");
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('name="quoteBefore"');
    expect(html).toContain("Überschrift deckt nicht");
    expect(html).toMatch(/name="idempotencyKey" value="[a-z0-9]{16,}"/);
  });

  it("füllt URL und markierten Text aus der Abfrage vor", async () => {
    const res = await captureRoutes(deps).request(
      "/neu?url=https%3A%2F%2Fbeispiel-zeitung.de%2Fa&text=rund%204%2C2%20Millionen",
    );
    const html = await res.text();
    expect(html).toContain('value="https://beispiel-zeitung.de/a"');
    expect(html).toContain("rund 4,2 Millionen");
  });
});

describe("POST /neu", () => {
  it("legt die Meldung an und bestätigt mit dem Referenz-Token", async () => {
    const res = await captureRoutes(deps).request("/neu", { method: "POST", body: form() });
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toMatch(/K[0-9A-HJKMNP-TV-Z]{5}/);
    expect(db.select().from(corrections).all()).toHaveLength(1);
  });

  it("zeigt Eingabefehler an, ohne zu speichern", async () => {
    const res = await captureRoutes(deps).request("/neu", {
      method: "POST",
      body: form({ quoteBefore: "" }),
    });
    expect(res.status).toBe(400);
    await expect(res.text()).resolves.toContain("quoteBefore");
    expect(db.select().from(corrections).all()).toHaveLength(0);
  });

  it("nennt die fehlende Kontaktadresse beim Namen", async () => {
    const res = await captureRoutes(deps).request("/neu", {
      method: "POST",
      body: form({ articleUrl: "https://neue-zeitung.de/a" }),
    });
    expect(res.status).toBe(400);
    await expect(res.text()).resolves.toContain("/admin/redaktionen");
  });

  it("warnt, wenn die Fundstelle nicht verankert werden konnte", async () => {
    const res = await captureRoutes({
      ...deps,
      fetchArticle: async () => ({ ok: false, status: 403, reason: "http" }),
    }).request("/neu", { method: "POST", body: form() });
    await expect(res.text()).resolves.toContain("konnte nicht im Artikel verankert werden");
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
pnpm vitest run packages/api/src/routes/capture.test.ts
```

Erwartet: FAIL — `./capture.js` nicht auflösbar.

- [ ] **Step 3: Ansicht implementieren**

`packages/api/src/views/capture.tsx`:

```tsx
import { QUOTE_MAX_LENGTH } from "@korrektur/shared";
import type { FC } from "hono/jsx";
import type { ErrorTypeRecord } from "../repo/errorTypes.js";
import { Layout } from "./layout.js";

export const CaptureForm: FC<{
  errorTypes: ErrorTypeRecord[];
  idempotencyKey: string;
  url: string;
  quote: string;
  fehler?: string;
}> = ({ errorTypes, idempotencyKey, url, quote, fehler }) => (
  <Layout title="Neue Korrekturmeldung">
    {fehler ? <p class="hinweis">{fehler}</p> : null}
    <form method="post" action="/neu">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      <label for="articleUrl">Artikel-URL</label>
      <input id="articleUrl" name="articleUrl" type="url" required value={url} />

      <label for="headline">Überschrift (optional, wird sonst aus dem Artikel gelesen)</label>
      <input id="headline" name="headline" type="text" />

      <label for="errorTypeKey">Art des Fehlers</label>
      <select id="errorTypeKey" name="errorTypeKey" required>
        {errorTypes.map((type) => (
          <option value={type.key}>{type.label}</option>
        ))}
      </select>

      <label for="severity">Schwere</label>
      <select id="severity" name="severity">
        <option value="1">1 – Kleinigkeit</option>
        <option value="2" selected>
          2 – deutlich
        </option>
        <option value="3">3 – gravierend</option>
      </select>

      <label for="quoteBefore">
        Fundstelle im Wortlaut <span class="zaehler">einfügen, nicht abtippen — max. {QUOTE_MAX_LENGTH} Zeichen</span>
      </label>
      <textarea id="quoteBefore" name="quoteBefore" required maxlength={QUOTE_MAX_LENGTH}>
        {quote}
      </textarea>

      <label for="suggestionAfter">So wäre es richtig</label>
      <textarea id="suggestionAfter" name="suggestionAfter" required></textarea>

      <label for="comment">Anmerkung (optional)</label>
      <textarea id="comment" name="comment"></textarea>

      <button type="submit">Meldung senden</button>
    </form>
  </Layout>
);

export const CaptureResult: FC<{ ref: string; anchored: boolean; sent: boolean }> = ({
  ref,
  anchored,
  sent,
}) => (
  <Layout title="Meldung erfasst">
    <p class="hinweis">
      Kennzeichen <strong>{ref}</strong>.{" "}
      {sent ? "Die Mail ist versendet." : "Der Versand ist fehlgeschlagen — der Datensatz liegt zur Prüfung bereit."}
    </p>
    {anchored ? null : (
      <p class="hinweis">
        Die Fundstelle konnte nicht im Artikel verankert werden. Eine spätere automatische
        Korrekturerkennung ist für diesen Datensatz nur eingeschränkt möglich.
      </p>
    )}
    <p>
      <a href="/neu">Nächste Meldung erfassen</a>
    </p>
  </Layout>
);
```

- [ ] **Step 4: Route implementieren**

`packages/api/src/routes/capture.ts`:

```ts
import { newCorrectionSchema } from "@korrektur/shared";
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
      return c.html(
        <CaptureForm
          errorTypes={listErrorTypes(deps.db)}
          idempotencyKey={createId()}
          url={parsed.data.articleUrl}
          quote={parsed.data.quoteBefore}
          fehler={result.message}
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
```

- [ ] **Step 5: Test laufen lassen, Erfolg bestätigen**

```bash
pnpm vitest run packages/api/src/routes/capture.test.ts
```

Erwartet: 6 Tests grün.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/routes/capture.tsx packages/api/src/routes/capture.test.ts packages/api/src/views/capture.tsx
git commit -m "Erfassungsformular mit Vorbefuellung aus dem Share-Sheet"
```

---

### Task 21: Adminoberfläche Redaktionen

**Files:**
- Create: `packages/api/src/views/outlets.tsx`, `packages/api/src/routes/admin/outlets.tsx`
- Test: `packages/api/src/routes/admin/outlets.test.ts`

**Interfaces:**
- Consumes: `Layout` aus Task 19, Repo-Funktionen aus Task 15, `outletInputSchema` aus Task 17
- Produces: `outletAdminRoutes(db: Db, now: () => number): Hono` aus `packages/api/src/routes/admin/outlets.tsx`

Routen: `GET /admin/redaktionen` (Liste + Anlageformular), `GET /admin/redaktionen/:id` (Bearbeiten), `POST /admin/redaktionen`, `POST /admin/redaktionen/:id`, `POST /admin/redaktionen/:id/loeschen`, `POST /admin/redaktionen/:id/domains`. Reine Formular-Posts, kein JavaScript.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`packages/api/src/routes/admin/outlets.test.ts`:

```ts
import { createId } from "@paralleldrive/cuid2";
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, runMigrations, type Db } from "../../db/client.js";
import { corrections, errorTypes } from "../../db/schema.js";
import { createOutlet, listOutlets } from "../../repo/outlets.js";
import { outletAdminRoutes } from "./outlets.js";

const NOW = 1_800_000_000;
let db: Db;

function app() {
  return outletAdminRoutes(db, () => NOW);
}

function body(fields: Record<string, string>): URLSearchParams {
  return new URLSearchParams(fields);
}

function post(path: string, fields: Record<string, string>) {
  return app().request(path, {
    method: "POST",
    body: body(fields),
    headers: { "content-type": "application/x-www-form-urlencoded" },
  });
}

beforeEach(() => {
  db = createDb(":memory:");
  runMigrations(db);
});

describe("Adminoberfläche Redaktionen", () => {
  it("listet Redaktionen alphabetisch", async () => {
    createOutlet(db, { name: "Zeta", primaryDomain: "zeta.de", publisher: null, country: null, notes: null, contactEmails: [] }, NOW);
    createOutlet(db, { name: "Alpha", primaryDomain: "alpha.de", publisher: null, country: null, notes: null, contactEmails: [] }, NOW);

    const html = await (await app().request("/admin/redaktionen")).text();
    expect(html.indexOf("Alpha")).toBeLessThan(html.indexOf("Zeta"));
  });

  it("legt eine Redaktion mit Kontaktadressen an", async () => {
    const res = await post("/admin/redaktionen", {
      name: "Beispiel-Zeitung",
      primaryDomain: "Beispiel-Zeitung.DE",
      contactEmails: "leserbriefe@beispiel-zeitung.de, redaktion@beispiel-zeitung.de",
    });
    expect(res.status).toBe(302);

    const [outlet] = listOutlets(db);
    expect(outlet?.primaryDomain).toBe("beispiel-zeitung.de");
    expect(outlet?.contactEmails).toHaveLength(2);
    expect(outlet?.domains).toEqual(["beispiel-zeitung.de"]);
  });

  it("weist eine ungültige Kontaktadresse ab", async () => {
    const res = await post("/admin/redaktionen", {
      name: "X",
      primaryDomain: "x.de",
      contactEmails: "keine-adresse",
    });
    expect(res.status).toBe(400);
    expect(listOutlets(db)).toHaveLength(0);
  });

  it("ergänzt eine weitere Domain", async () => {
    const outlet = createOutlet(db, { name: "X", primaryDomain: "x.de", publisher: null, country: null, notes: null, contactEmails: [] }, NOW);
    await post(`/admin/redaktionen/${outlet.id}/domains`, { domain: "magazin.x.de" });
    expect(listOutlets(db)[0]?.domains).toContain("magazin.x.de");
  });

  it("löscht eine unbenutzte Redaktion", async () => {
    const outlet = createOutlet(db, { name: "X", primaryDomain: "x.de", publisher: null, country: null, notes: null, contactEmails: [] }, NOW);
    await post(`/admin/redaktionen/${outlet.id}/loeschen`, {});
    expect(listOutlets(db, { includeArchived: true })).toHaveLength(0);
  });

  it("archiviert eine benutzte Redaktion und sagt das auch", async () => {
    const outlet = createOutlet(db, { name: "X", primaryDomain: "x.de", publisher: null, country: null, notes: null, contactEmails: [] }, NOW);
    const errorTypeId = createId();
    db.insert(errorTypes).values({ id: errorTypeId, key: "zahl", label: "Zahl", sortOrder: 10, createdAt: NOW }).run();
    db.insert(corrections)
      .values({
        id: createId(), ref: "K7QW3M", idempotencyKey: "idem-1", createdAt: NOW, dispatchMode: "smtp",
        articleUrl: "https://x.de/a", articleUrlCanon: "https://x.de/a", outletId: outlet.id,
        errorTypeId, severity: 2, quoteBefore: "Z", suggestionAfter: "V",
        recipientEmail: "leserbriefe@x.de", source: "web",
      })
      .run();

    const res = await post(`/admin/redaktionen/${outlet.id}/loeschen`, {});
    expect(res.headers.get("location")).toContain("archiviert");
    expect(listOutlets(db)).toHaveLength(0);
    expect(listOutlets(db, { includeArchived: true })).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
pnpm vitest run packages/api/src/routes/admin/outlets.test.ts
```

Erwartet: FAIL — `./outlets.js` nicht auflösbar.

- [ ] **Step 3: Ansicht implementieren**

`packages/api/src/views/outlets.tsx`:

```tsx
import type { FC } from "hono/jsx";
import type { OutletRecord } from "../repo/outlets.js";
import { Layout } from "./layout.js";

const Felder: FC<{ outlet?: OutletRecord }> = ({ outlet }) => (
  <>
    <label for="name">Name</label>
    <input id="name" name="name" required value={outlet?.name ?? ""} />

    <label for="primaryDomain">Hauptdomain</label>
    <input id="primaryDomain" name="primaryDomain" required value={outlet?.primaryDomain ?? ""} />

    <label for="publisher">Verlag</label>
    <input id="publisher" name="publisher" value={outlet?.publisher ?? ""} />

    <label for="country">Land (zwei Buchstaben)</label>
    <input id="country" name="country" maxlength={2} value={outlet?.country ?? ""} />

    <label for="contactEmails">
      Kontaktadressen <span class="zaehler">kommagetrennt, erste ist Standardempfänger</span>
    </label>
    <input id="contactEmails" name="contactEmails" value={(outlet?.contactEmails ?? []).join(", ")} />

    <label for="notes">Notizen</label>
    <textarea id="notes" name="notes">{outlet?.notes ?? ""}</textarea>
  </>
);

export const OutletList: FC<{ outlets: OutletRecord[]; hinweis?: string; fehler?: string }> = ({
  outlets,
  hinweis,
  fehler,
}) => (
  <Layout title="Redaktionen">
    {hinweis ? <p class="hinweis">{hinweis}</p> : null}
    {fehler ? <p class="hinweis">{fehler}</p> : null}

    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Domains</th>
          <th>Kontakt</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {outlets.map((outlet) => (
          <tr>
            <td>
              <a href={`/admin/redaktionen/${outlet.id}`}>{outlet.name}</a>
            </td>
            <td>{outlet.domains.join(", ")}</td>
            <td>{outlet.contactEmails.length}</td>
            <td>
              <form class="inline" method="post" action={`/admin/redaktionen/${outlet.id}/loeschen`}>
                <button type="submit">Entfernen</button>
              </form>
            </td>
          </tr>
        ))}
      </tbody>
    </table>

    <h2>Neue Redaktion</h2>
    <form method="post" action="/admin/redaktionen">
      <Felder />
      <button type="submit">Anlegen</button>
    </form>
  </Layout>
);

export const OutletEdit: FC<{ outlet: OutletRecord }> = ({ outlet }) => (
  <Layout title={`Redaktion: ${outlet.name}`}>
    <form method="post" action={`/admin/redaktionen/${outlet.id}`}>
      <Felder outlet={outlet} />
      <button type="submit">Speichern</button>
    </form>

    <h2>Domains</h2>
    <p>{outlet.domains.join(", ")}</p>
    <form method="post" action={`/admin/redaktionen/${outlet.id}/domains`}>
      <label for="domain">Weitere Domain</label>
      <input id="domain" name="domain" required />
      <button type="submit">Hinzufügen</button>
    </form>
  </Layout>
);
```

- [ ] **Step 4: Route implementieren**

`packages/api/src/routes/admin/outlets.tsx`:

```tsx
import { outletInputSchema } from "@korrektur/shared";
import { Hono } from "hono";
import type { Db } from "../../db/client.js";
import {
  addDomain,
  createOutlet,
  listOutlets,
  removeOutlet,
  updateOutlet,
} from "../../repo/outlets.js";
import { OutletEdit, OutletList } from "../../views/outlets.js";

const BASE = "/admin/redaktionen";

function parseEmails(raw: unknown): string[] {
  if (typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

export function outletAdminRoutes(db: Db, now: () => number): Hono {
  const app = new Hono();

  app.get(BASE, (c) =>
    c.html(
      <OutletList
        outlets={listOutlets(db, { includeArchived: false })}
        hinweis={c.req.query("hinweis") ?? undefined}
      />,
    ),
  );

  app.get(`${BASE}/:id`, (c) => {
    const outlet = listOutlets(db, { includeArchived: true }).find((o) => o.id === c.req.param("id"));
    if (!outlet) return c.notFound();
    return c.html(<OutletEdit outlet={outlet} />);
  });

  app.post(BASE, async (c) => {
    const raw = await c.req.parseBody();
    const parsed = outletInputSchema.safeParse({ ...raw, contactEmails: parseEmails(raw["contactEmails"]) });
    if (!parsed.success) {
      return c.html(
        <OutletList outlets={listOutlets(db)} fehler={parsed.error.issues[0]?.message ?? "Eingabe ungültig"} />,
        400,
      );
    }
    createOutlet(db, parsed.data, now());
    return c.redirect(`${BASE}?hinweis=Angelegt`, 302);
  });

  app.post(`${BASE}/:id`, async (c) => {
    const raw = await c.req.parseBody();
    const parsed = outletInputSchema.safeParse({ ...raw, contactEmails: parseEmails(raw["contactEmails"]) });
    if (!parsed.success) {
      return c.html(
        <OutletList outlets={listOutlets(db)} fehler={parsed.error.issues[0]?.message ?? "Eingabe ungültig"} />,
        400,
      );
    }
    updateOutlet(db, c.req.param("id"), parsed.data);
    return c.redirect(`${BASE}?hinweis=Gespeichert`, 302);
  });

  app.post(`${BASE}/:id/domains`, async (c) => {
    const raw = await c.req.parseBody();
    const domain = typeof raw["domain"] === "string" ? raw["domain"] : "";
    const ok = addDomain(db, c.req.param("id"), domain);
    const hinweis = ok ? "Domain ergaenzt" : "Domain gehoert bereits zu einer anderen Redaktion";
    return c.redirect(`${BASE}?hinweis=${encodeURIComponent(hinweis)}`, 302);
  });

  app.post(`${BASE}/:id/loeschen`, (c) => {
    const outcome = removeOutlet(db, c.req.param("id"));
    const hinweis =
      outcome === "archived"
        ? "Redaktion archiviert, weil Meldungen darauf verweisen"
        : outcome === "deleted"
          ? "Redaktion geloescht"
          : "Redaktion nicht gefunden";
    return c.redirect(`${BASE}?hinweis=${encodeURIComponent(hinweis)}`, 302);
  });

  return app;
}
```

- [ ] **Step 5: Test laufen lassen, Erfolg bestätigen**

```bash
pnpm vitest run packages/api/src/routes/admin/outlets.test.ts
```

Erwartet: 6 Tests grün.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/routes/admin/outlets.tsx packages/api/src/routes/admin/outlets.test.ts packages/api/src/views/outlets.tsx
git commit -m "Adminoberflaeche fuer Redaktionen mit Domains und Kontaktadressen"
```

---

### Task 22: Adminoberfläche Fehlerarten

**Files:**
- Create: `packages/api/src/views/errorTypes.tsx`, `packages/api/src/routes/admin/errorTypes.tsx`
- Test: `packages/api/src/routes/admin/errorTypes.test.ts`

**Interfaces:**
- Consumes: `Layout` aus Task 19, Repo-Funktionen aus Task 16, `errorTypeInputSchema` und `errorTypeUpdateSchema` aus Task 17
- Produces: `errorTypeAdminRoutes(db: Db, now: () => number): Hono` aus `packages/api/src/routes/admin/errorTypes.tsx`

Der Schlüssel wird beim Bearbeiten als reiner Text angezeigt, nicht als Eingabefeld — er steht in versendeten Mails und ist dort nicht mehr korrigierbar (§5.0).

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`packages/api/src/routes/admin/errorTypes.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createDb, runMigrations, type Db } from "../../db/client.js";
import { seed } from "../../db/seed.js";
import { getErrorTypeByKey, listErrorTypes } from "../../repo/errorTypes.js";
import { errorTypeAdminRoutes } from "./errorTypes.js";

const NOW = 1_800_000_000;
let db: Db;

function post(path: string, fields: Record<string, string>) {
  return errorTypeAdminRoutes(db, () => NOW).request(path, {
    method: "POST",
    body: new URLSearchParams(fields),
    headers: { "content-type": "application/x-www-form-urlencoded" },
  });
}

beforeEach(() => {
  db = createDb(":memory:");
  runMigrations(db);
  seed(db);
});

describe("Adminoberfläche Fehlerarten", () => {
  it("listet die geseedeten Fehlerarten", async () => {
    const html = await (await errorTypeAdminRoutes(db, () => NOW).request("/admin/fehlerarten")).text();
    expect(html).toContain("Überschrift deckt nicht");
    expect(html).toContain("Falschzitat");
  });

  it("legt eine neue Fehlerart an", async () => {
    const res = await post("/admin/fehlerarten", {
      key: "toter_link",
      label: "Toter Link",
      description: "Verlinktes Ziel nicht erreichbar.",
      sortOrder: "130",
    });
    expect(res.status).toBe(302);
    expect(getErrorTypeByKey(db, "toter_link")?.label).toBe("Toter Link");
  });

  it("weist einen Schlüssel mit Leerzeichen ab", async () => {
    const res = await post("/admin/fehlerarten", {
      key: "Toter Link",
      label: "Toter Link",
      description: "",
      sortOrder: "130",
    });
    expect(res.status).toBe(400);
    expect(listErrorTypes(db)).toHaveLength(12);
  });

  it("meldet einen bereits vergebenen Schlüssel", async () => {
    const res = await post("/admin/fehlerarten", {
      key: "zahl",
      label: "Noch eine Zahl",
      description: "",
      sortOrder: "200",
    });
    expect(res.status).toBe(400);
    expect(listErrorTypes(db)).toHaveLength(12);
  });

  it("bietet den Schlüssel beim Bearbeiten nicht als Eingabefeld an", async () => {
    const id = getErrorTypeByKey(db, "zahl")?.id ?? "";
    const html = await (await errorTypeAdminRoutes(db, () => NOW).request(`/admin/fehlerarten/${id}`)).text();
    expect(html).not.toContain('name="key"');
    expect(html).toContain("zahl");
  });

  it("ändert Bezeichnung und Reihenfolge", async () => {
    const id = getErrorTypeByKey(db, "zahl")?.id ?? "";
    await post(`/admin/fehlerarten/${id}`, {
      label: "Zahlendreher",
      description: "Zahl falsch wiedergegeben.",
      sortOrder: "5",
    });
    const updated = getErrorTypeByKey(db, "zahl");
    expect(updated?.label).toBe("Zahlendreher");
    expect(updated?.sortOrder).toBe(5);
  });

  it("löscht eine unbenutzte Fehlerart und meldet das zurück", async () => {
    const id = getErrorTypeByKey(db, "zahl")?.id ?? "";
    const res = await post(`/admin/fehlerarten/${id}/loeschen`, {});
    expect(res.status).toBe(302);
    expect(decodeURIComponent(res.headers.get("location") ?? "")).toContain("geloescht");
    expect(listErrorTypes(db)).toHaveLength(11);
    expect(listErrorTypes(db, { includeArchived: true })).toHaveLength(11);
  });
});
```

Der Archivierungspfad selbst ist bereits in Task 16 abgedeckt; hier wird nur geprüft,
dass die Route den Rückgabewert korrekt in eine Weiterleitung mit Hinweis übersetzt.

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
pnpm vitest run packages/api/src/routes/admin/errorTypes.test.ts
```

Erwartet: FAIL — `./errorTypes.js` nicht auflösbar.

- [ ] **Step 3: Ansicht implementieren**

`packages/api/src/views/errorTypes.tsx`:

```tsx
import type { FC } from "hono/jsx";
import type { ErrorTypeRecord } from "../repo/errorTypes.js";
import { Layout } from "./layout.js";

export const ErrorTypeList: FC<{ types: ErrorTypeRecord[]; hinweis?: string; fehler?: string }> = ({
  types,
  hinweis,
  fehler,
}) => (
  <Layout title="Fehlerarten">
    {hinweis ? <p class="hinweis">{hinweis}</p> : null}
    {fehler ? <p class="hinweis">{fehler}</p> : null}

    <table>
      <thead>
        <tr>
          <th>Reihenfolge</th>
          <th>Bezeichnung</th>
          <th>Schlüssel</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {types.map((type) => (
          <tr>
            <td>{type.sortOrder}</td>
            <td>
              <a href={`/admin/fehlerarten/${type.id}`}>{type.label}</a>
            </td>
            <td>
              <code>{type.key}</code>
            </td>
            <td>
              <form class="inline" method="post" action={`/admin/fehlerarten/${type.id}/loeschen`}>
                <button type="submit">Entfernen</button>
              </form>
            </td>
          </tr>
        ))}
      </tbody>
    </table>

    <h2>Neue Fehlerart</h2>
    <form method="post" action="/admin/fehlerarten">
      <label for="key">
        Schlüssel <span class="zaehler">nur a–z, 0–9 und _, danach unveränderlich</span>
      </label>
      <input id="key" name="key" required pattern="[a-z0-9_]+" />

      <label for="label">Bezeichnung</label>
      <input id="label" name="label" required />

      <label for="description">Beschreibung</label>
      <textarea id="description" name="description"></textarea>

      <label for="sortOrder">Reihenfolge</label>
      <input id="sortOrder" name="sortOrder" type="number" value="130" required />

      <button type="submit">Anlegen</button>
    </form>
  </Layout>
);

export const ErrorTypeEdit: FC<{ type: ErrorTypeRecord }> = ({ type }) => (
  <Layout title={`Fehlerart: ${type.label}`}>
    <p class="hinweis">
      Schlüssel <code>{type.key}</code> — nicht änderbar, weil er im Meta-Block bereits
      versendeter Mails steht.
    </p>
    <form method="post" action={`/admin/fehlerarten/${type.id}`}>
      <label for="label">Bezeichnung</label>
      <input id="label" name="label" required value={type.label} />

      <label for="description">Beschreibung</label>
      <textarea id="description" name="description">{type.description ?? ""}</textarea>

      <label for="sortOrder">Reihenfolge</label>
      <input id="sortOrder" name="sortOrder" type="number" required value={String(type.sortOrder)} />

      <button type="submit">Speichern</button>
    </form>
  </Layout>
);
```

- [ ] **Step 4: Route implementieren**

`packages/api/src/routes/admin/errorTypes.tsx`:

```tsx
import { errorTypeInputSchema, errorTypeUpdateSchema } from "@korrektur/shared";
import { Hono } from "hono";
import type { Db } from "../../db/client.js";
import {
  createErrorType,
  listErrorTypes,
  removeErrorType,
  updateErrorType,
} from "../../repo/errorTypes.js";
import { ErrorTypeEdit, ErrorTypeList } from "../../views/errorTypes.js";

const BASE = "/admin/fehlerarten";

export function errorTypeAdminRoutes(db: Db, now: () => number): Hono {
  const app = new Hono();

  app.get(BASE, (c) =>
    c.html(<ErrorTypeList types={listErrorTypes(db)} hinweis={c.req.query("hinweis") ?? undefined} />),
  );

  app.get(`${BASE}/:id`, (c) => {
    const type = listErrorTypes(db, { includeArchived: true }).find((t) => t.id === c.req.param("id"));
    if (!type) return c.notFound();
    return c.html(<ErrorTypeEdit type={type} />);
  });

  app.post(BASE, async (c) => {
    const parsed = errorTypeInputSchema.safeParse(await c.req.parseBody());
    if (!parsed.success) {
      return c.html(
        <ErrorTypeList types={listErrorTypes(db)} fehler={parsed.error.issues[0]?.message ?? "Eingabe ungültig"} />,
        400,
      );
    }

    const created = createErrorType(db, parsed.data, now());
    if (!created) {
      return c.html(
        <ErrorTypeList types={listErrorTypes(db)} fehler={`Der Schlüssel ${parsed.data.key} ist bereits vergeben.`} />,
        400,
      );
    }
    return c.redirect(`${BASE}?hinweis=Angelegt`, 302);
  });

  app.post(`${BASE}/:id`, async (c) => {
    const parsed = errorTypeUpdateSchema.safeParse(await c.req.parseBody());
    if (!parsed.success) {
      return c.html(
        <ErrorTypeList types={listErrorTypes(db)} fehler={parsed.error.issues[0]?.message ?? "Eingabe ungültig"} />,
        400,
      );
    }
    updateErrorType(db, c.req.param("id"), parsed.data);
    return c.redirect(`${BASE}?hinweis=Gespeichert`, 302);
  });

  app.post(`${BASE}/:id/loeschen`, (c) => {
    const outcome = removeErrorType(db, c.req.param("id"));
    const hinweis =
      outcome === "archived"
        ? "Fehlerart archiviert, weil Meldungen darauf verweisen"
        : outcome === "deleted"
          ? "Fehlerart geloescht"
          : "Fehlerart nicht gefunden";
    return c.redirect(`${BASE}?hinweis=${encodeURIComponent(hinweis)}`, 302);
  });

  return app;
}
```

- [ ] **Step 5: Test laufen lassen, Erfolg bestätigen**

```bash
pnpm vitest run packages/api/src/routes/admin/errorTypes.test.ts
```

Erwartet: 7 Tests grün.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/routes/admin/errorTypes.tsx packages/api/src/routes/admin/errorTypes.test.ts packages/api/src/views/errorTypes.tsx
git commit -m "Adminoberflaeche fuer Fehlerarten mit gesperrtem Schluessel"
```

---

### Task 23: Öffentlicher Serializer und Feld-Sperrliste

**Files:**
- Create: `packages/api/src/serialize/public.ts`
- Test: `packages/api/src/serialize/public.test.ts`

**Interfaces:**
- Consumes: Tabellen aus Task 7, `OutletRecord` aus Task 15
- Produces: aus `packages/api/src/serialize/public.ts`: `type PublicCorrection`, `type PublicOutlet`, `toPublicCorrection(row, outletName, errorTypeLabel): PublicCorrection`, `toPublicOutlet(outlet: OutletRecord): PublicOutlet`, `FORBIDDEN_PUBLIC_FIELDS: readonly string[]`, `assertNoForbiddenFields(value: unknown): void`

Das ist die strukturelle Umsetzung von §2.1: Der öffentliche Typ **besitzt** die kritischen Felder nicht. `assertNoForbiddenFields` ist der Wächter, der jede öffentliche Antwort rekursiv prüft — ein Feld, das versehentlich in den Public-Typ gerät, lässt die Suite rot werden.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`packages/api/src/serialize/public.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  assertNoForbiddenFields,
  FORBIDDEN_PUBLIC_FIELDS,
  toPublicCorrection,
  toPublicOutlet,
} from "./public.js";

const ROW = {
  id: "c1",
  ref: "K7QW3M",
  idempotencyKey: "abcdef0123456789",
  createdAt: 1_800_000_000,
  dispatchMode: "smtp" as const,
  articleUrl: "https://beispiel-zeitung.de/a",
  articleUrlCanon: "https://beispiel-zeitung.de/a",
  outletId: "o1",
  headline: "Fahrgastzahlen steigen deutlich",
  publishedAt: null,
  errorTypeId: "e1",
  severity: 2,
  quoteBefore: "rund 4,2 Millionen",
  quotePrefix: "Im vergangenen Jahr nutzten ",
  quoteSuffix: " Menschen die Linie",
  quotePositionHint: 0,
  anchorQuality: "exact" as const,
  suggestionAfter: "rund 2,4 Millionen",
  comment: null,
  recipientEmail: "leserbriefe@beispiel-zeitung.de",
  messageId: "<abc@example.tld>",
  dispatchStatus: "sent" as const,
  sentAt: 1_800_000_000,
  sendConfirmedBy: "smtp" as const,
  outcome: "corrected" as const,
  respondedAt: null,
  correctedAt: 1_800_100_000,
  verification: "manual" as const,
  source: "web" as const,
  needsReview: false,
};

const OUTLET = {
  id: "o1",
  name: "Beispiel-Zeitung",
  primaryDomain: "beispiel-zeitung.de",
  publisher: "Beispiel Verlag",
  country: "DE",
  notes: "interne Notiz",
  contactEmails: ["leserbriefe@beispiel-zeitung.de"],
  archived: false,
  createdAt: 1_800_000_000,
  domains: ["beispiel-zeitung.de"],
};

describe("toPublicCorrection", () => {
  it("übernimmt die zulässigen Felder", () => {
    const result = toPublicCorrection(ROW, "Beispiel-Zeitung", "Zahl");
    expect(result.ref).toBe("K7QW3M");
    expect(result.outletName).toBe("Beispiel-Zeitung");
    expect(result.errorTypeLabel).toBe("Zahl");
    expect(result.quoteBefore).toBe("rund 4,2 Millionen");
    expect(result.outcome).toBe("corrected");
  });

  it("enthält weder Empfänger noch Message-ID noch Ankertexte", () => {
    const result = toPublicCorrection(ROW, "Beispiel-Zeitung", "Zahl");
    const keys = Object.keys(result);
    expect(keys).not.toContain("recipientEmail");
    expect(keys).not.toContain("messageId");
    expect(keys).not.toContain("quotePrefix");
    expect(keys).not.toContain("quoteSuffix");
    expect(keys).not.toContain("idempotencyKey");
  });

  it("übersteht den Wächter", () => {
    expect(() => assertNoForbiddenFields(toPublicCorrection(ROW, "X", "Y"))).not.toThrow();
  });
});

describe("toPublicOutlet", () => {
  it("liefert Name und Verlag, aber keine Adressen und keine Notizen", () => {
    const result = toPublicOutlet(OUTLET);
    expect(result.name).toBe("Beispiel-Zeitung");
    expect(Object.keys(result)).not.toContain("contactEmails");
    expect(Object.keys(result)).not.toContain("notes");
    expect(() => assertNoForbiddenFields(result)).not.toThrow();
  });
});

describe("assertNoForbiddenFields", () => {
  it("kennt alle in der Spec genannten Felder", () => {
    for (const field of ["recipientEmail", "fromAddr", "excerpt", "contactEmails", "observedText", "author"]) {
      expect(FORBIDDEN_PUBLIC_FIELDS).toContain(field);
    }
  });

  it("wirft bei einem verbotenen Feld auf oberster Ebene", () => {
    expect(() => assertNoForbiddenFields({ ref: "K7QW3M", recipientEmail: "x@y.de" })).toThrow(
      /recipientEmail/,
    );
  });

  it("wirft auch bei verschachtelten und in Listen versteckten Feldern", () => {
    expect(() => assertNoForbiddenFields({ a: { b: { excerpt: "Danke für den Hinweis" } } })).toThrow(
      /excerpt/,
    );
    expect(() => assertNoForbiddenFields([{ ok: 1 }, { author: "Jemand" }])).toThrow(/author/);
  });

  it("lässt harmlose Strukturen durch", () => {
    expect(() => assertNoForbiddenFields({ liste: [{ ref: "K7QW3M", n: 3 }], summe: 3 })).not.toThrow();
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
pnpm vitest run packages/api/src/serialize/public.test.ts
```

Erwartet: FAIL — `./public.js` nicht auflösbar.

- [ ] **Step 3: Implementieren**

`packages/api/src/serialize/public.ts`:

```ts
import type { corrections } from "../db/schema.js";
import type { OutletRecord } from "../repo/outlets.js";

type CorrectionRow = typeof corrections.$inferSelect;

/**
 * Öffentliche Sicht auf eine Meldung. Besitzt die kritischen Felder nicht —
 * es wird nichts zur Laufzeit herausgefiltert (§2.1).
 */
export interface PublicCorrection {
  ref: string;
  createdAt: number;
  sentAt: number | null;
  outletName: string;
  errorTypeLabel: string;
  severity: number;
  articleUrl: string;
  headline: string | null;
  quoteBefore: string;
  suggestionAfter: string;
  outcome: CorrectionRow["outcome"];
  correctedAt: number | null;
}

export interface PublicOutlet {
  name: string;
  publisher: string | null;
  country: string | null;
}

export function toPublicCorrection(
  row: CorrectionRow,
  outletName: string,
  errorTypeLabel: string,
): PublicCorrection {
  return {
    ref: row.ref,
    createdAt: row.createdAt,
    sentAt: row.sentAt,
    outletName,
    errorTypeLabel,
    severity: row.severity,
    articleUrl: row.articleUrl,
    headline: row.headline,
    quoteBefore: row.quoteBefore,
    suggestionAfter: row.suggestionAfter,
    outcome: row.outcome,
    correctedAt: row.correctedAt,
  };
}

export function toPublicOutlet(outlet: OutletRecord): PublicOutlet {
  return { name: outlet.name, publisher: outlet.publisher, country: outlet.country };
}

/** Feldnamen, die in keiner öffentlichen Antwort auftauchen dürfen (§2.1, §12, §13). */
export const FORBIDDEN_PUBLIC_FIELDS = [
  "author",
  "authorName",
  "contactEmails",
  "contact_emails",
  "excerpt",
  "fromAddr",
  "from_addr",
  "idempotencyKey",
  "idempotency_key",
  "messageId",
  "message_id",
  "notes",
  "observedText",
  "observed_text",
  "quotePrefix",
  "quoteSuffix",
  "quote_prefix",
  "quote_suffix",
  "recipientEmail",
  "recipient_email",
] as const;

const FORBIDDEN = new Set<string>(FORBIDDEN_PUBLIC_FIELDS);

/** Wächter: prüft rekursiv, auch in Listen und verschachtelten Objekten. */
export function assertNoForbiddenFields(value: unknown, path = "$"): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoForbiddenFields(entry, `${path}[${index}]`));
    return;
  }
  if (value === null || typeof value !== "object") return;

  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN.has(key)) {
      throw new Error(`Verbotenes Feld in oeffentlicher Antwort: ${path}.${key}`);
    }
    assertNoForbiddenFields(nested, `${path}.${key}`);
  }
}
```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

```bash
pnpm vitest run packages/api/src/serialize/public.test.ts
```

Erwartet: 8 Tests grün.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/serialize/public.ts packages/api/src/serialize/public.test.ts
git commit -m "Oeffentlicher Serializer mit rekursivem Feld-Waechter"
```

---

### Task 24: Verdrahtung, Bootstrap und Dokumentation

**Files:**
- Modify: `packages/api/src/app.ts`, `packages/api/src/web.ts`
- Create: `CLAUDE.md`, `docs/kurzbefehl.md`
- Test: `packages/api/src/app.test.ts`

**Interfaces:**
- Consumes: alles Bisherige
- Produces: `createApp(options: AppOptions): Hono` aus `packages/api/src/app.ts` mit `AppOptions = { env: Env; db: Db; mailer: Mailer; fetchArticle: (url: string) => Promise<FetchResult>; now?: () => number }`

Damit wird die Signatur aus Task 2 erweitert — der dortige Test ruft `createApp()` ohne Argumente auf und muss angepasst werden.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`packages/api/src/app.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { createDb, runMigrations } from "./db/client.js";
import { applyViews } from "./db/views.js";
import { seed } from "./db/seed.js";
import { createJsonMailer } from "./dispatch/send.js";
import type { Env } from "./env.js";

const ENV = {
  PORT: 3000,
  DATABASE_PATH: ":memory:",
  ADMIN_USER: "admin",
  ADMIN_PASSWORD: "geheimes-passwort",
  PUBLIC_BASE_URL: "https://korrekturen.msmr.co",
  SMTP_HOST: "mail.example.tld",
  SMTP_PORT: 587,
  SMTP_USER: "korrektur@example.tld",
  SMTP_PASSWORD: "x",
  MAIL_FROM: "korrektur@example.tld",
} satisfies Env;

function app() {
  const db = createDb(":memory:");
  runMigrations(db);
  applyViews(db);
  seed(db);
  return createApp({
    env: ENV,
    db,
    mailer: createJsonMailer(ENV.MAIL_FROM),
    fetchArticle: async () => ({ ok: false, status: null, reason: "network" }),
    now: () => 1_800_000_000,
  });
}

const AUTH = `Basic ${Buffer.from("admin:geheimes-passwort").toString("base64")}`;

describe("App-Verdrahtung", () => {
  it("lässt den Healthcheck ohne Anmeldung durch", async () => {
    const res = await app().request("/healthz");
    expect(res.status).toBe(200);
  });

  it("schützt das Erfassungsformular", async () => {
    expect((await app().request("/neu")).status).toBe(401);
    expect((await app().request("/neu", { headers: { authorization: AUTH } })).status).toBe(200);
  });

  it("schützt beide Adminbereiche", async () => {
    expect((await app().request("/admin/redaktionen")).status).toBe(401);
    expect((await app().request("/admin/fehlerarten")).status).toBe(401);
    expect(
      (await app().request("/admin/fehlerarten", { headers: { authorization: AUTH } })).status,
    ).toBe(200);
  });

  it("leitet die Wurzel auf das Erfassungsformular", async () => {
    const res = await app().request("/");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/neu");
  });
});
```

`packages/api/src/routes/health.test.ts` anpassen — `createApp` braucht jetzt Argumente. Ersetze dort den Aufbau durch dieselbe `app()`-Hilfsfunktion wie oben und behalte die Erwartung `{ status: "ok" }`.

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
pnpm vitest run packages/api/src/app.test.ts
```

Erwartet: FAIL — `createApp` nimmt keine Argumente entgegen.

- [ ] **Step 3: Implementieren**

`packages/api/src/app.ts`:

```ts
import { Hono } from "hono";
import type { FetchResult } from "./article/fetch.js";
import { adminAuth } from "./auth.js";
import type { Db } from "./db/client.js";
import type { Mailer } from "./dispatch/send.js";
import type { Env } from "./env.js";
import { errorTypeAdminRoutes } from "./routes/admin/errorTypes.js";
import { outletAdminRoutes } from "./routes/admin/outlets.js";
import { captureRoutes } from "./routes/capture.js";
import { health } from "./routes/health.js";

export interface AppOptions {
  env: Env;
  db: Db;
  mailer: Mailer;
  fetchArticle: (url: string) => Promise<FetchResult>;
  now?: () => number;
}

export function createApp(options: AppOptions): Hono {
  const now = options.now ?? (() => Math.floor(Date.now() / 1000));
  const app = new Hono();

  app.route("/", health);

  app.use("/neu", adminAuth(options.env));
  app.use("/admin/*", adminAuth(options.env));

  app.route(
    "/",
    captureRoutes({
      db: options.db,
      mailer: options.mailer,
      fetchArticle: options.fetchArticle,
      now,
      baseUrl: options.env.PUBLIC_BASE_URL,
    }),
  );
  app.route("/", outletAdminRoutes(options.db, now));
  app.route("/", errorTypeAdminRoutes(options.db, now));

  app.get("/", (c) => c.redirect("/neu", 302));
  return app;
}
```

`packages/api/src/web.ts`:

```ts
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { fetchArticle } from "./article/fetch.js";
import { createDb, runMigrations } from "./db/client.js";
import { seed } from "./db/seed.js";
import { applyViews } from "./db/views.js";
import { createSmtpMailer } from "./dispatch/send.js";
import { loadEnv } from "./env.js";

const env = loadEnv();

if (env.DATABASE_PATH !== ":memory:") {
  mkdirSync(dirname(env.DATABASE_PATH), { recursive: true });
}

const db = createDb(env.DATABASE_PATH);
runMigrations(db);
applyViews(db); // aus den Konstanten neu erzeugt, siehe Task 9
seed(db);

const app = createApp({
  env,
  db,
  mailer: createSmtpMailer(env),
  fetchArticle: (url) => fetchArticle(url),
});

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(JSON.stringify({ level: "info", msg: "server gestartet", port: info.port }));
});
```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

```bash
pnpm vitest run
pnpm typecheck
pnpm lint
```

Erwartet: alle Suiten grün, Typecheck und Lint ohne Befund.

- [ ] **Step 5: `CLAUDE.md` anlegen**

```md
# Korrektur-Tracker

## Kontext
Erfasst gemeldete Fehler in Online-Artikeln, verfolgt die Reaktionen der Redaktionen
und stellt beides auswertbar dar. Spec: `docs/superpowers/specs/2026-08-01-korrektur-tracker-design.md`.

## Befehle
- `pnpm dev` / `pnpm build` / `pnpm test` / `pnpm test:watch`
- `pnpm db:generate` (Migration erzeugen), `pnpm db:seed`
- `pnpm typecheck` / `pnpm lint`

## Regeln
- TypeScript strict. Kein `any`, kein `as` außer in Typ-Guards.
- Zod-Schemas leben in `packages/shared` und sind die einzige Typquelle.
- Parser und Normalisierer sind reine Funktionen ohne IO. IO nur in `db/client.ts`,
  `article/fetch.ts`, `dispatch/send.ts`, `repo/*.ts`.
- Zeitstempel als UTC-Epoch-Sekunden (int) in der Datenbank, Formatierung nur in der Ansicht.
- Datenbankänderungen nur über Drizzle-Migrationen. Ausnahme: die Kennzahlen-Views,
  die beim Start aus den Konstanten in `shared` neu erzeugt werden.
- **`author` wird nicht erhoben, nicht gespeichert, nicht extrahiert.**
- Neue Felder in öffentlichen Antworten nur über `PublicCorrection` / `PublicOutlet`.
  Bei Zweifel `FORBIDDEN_PUBLIC_FIELDS` erweitern.
- Kein Ranking, keine Bestenliste, keine Ampelfarben auf Werten. Quoten nie ohne ihr n.
- Nie echte Mailinhalte, Adressen oder Tokens committen.

## Nicht anfassen
- `tests/fixtures/**` (nur ergänzen)
- `fixtures.local/**`, `.env`
```

- [ ] **Step 6: Kurzbefehl dokumentieren**

`docs/kurzbefehl.md`:

```md
# Kurzbefehl „Korrektur melden"

Zwei Aktionen, danach nie wieder anzufassen — die gesamte Logik liegt im Server.

1. **Details der Safari-Webseite abrufen** → liefert die URL der aktuellen Seite.
2. **URL öffnen** mit:

   `https://korrektur.example.tld/neu?url=[URL]&text=[Kurzbefehl-Eingabe]`

Beide Werte URL-kodieren (Aktion *Text kodieren*).

## Zitat mitgeben

Beim Teilen aus Safari mit **markiertem Text** liefert das Share-Sheet die Auswahl als
Kurzbefehl-Eingabe. Diese in den Parameter `text` legen — dann steht die Fundstelle
wortgleich im Formular. Das ist wichtig: Abgetipptes lässt sich später nicht im Artikel
verankern, und die automatische Korrekturerkennung findet dann nichts.

## Einrichtung

- Kurzbefehle → Details → *Im Teilen-Menü anzeigen* aktivieren
- Als Eingabetypen *URLs* und *Text* zulassen

## Desktop

Kein Kurzbefehl nötig: `/neu` im Browser öffnen, URL und Zitat einfügen. Optional ein
Bookmarklet, das beides vorbefüllt — bewusst optional, weil manche Nachrichtenseiten
`javascript:`-URLs per CSP blockieren.

## Externer Zugang

Ein verteilbarer Kurzbefehl für fremde Nutzer ist vorgesehen, aber nicht Teil von v1 —
Ablauf in Abschnitt 15 der Spec.
```

- [ ] **Step 7: Vollständigen Durchlauf prüfen**

Lokal:

```bash
pnpm build && pnpm bundle
DATABASE_PATH=./data/test.db PUBLIC_BASE_URL=http://localhost:3000 \
  ADMIN_USER=admin ADMIN_PASSWORD=testtesttest \
  SMTP_HOST=localhost SMTP_USER=x SMTP_PASSWORD=x MAIL_FROM=korrektur@example.tld \
  node build/web.js &
curl -fsS http://localhost:3000/healthz
curl -fsS -u admin:testtesttest http://localhost:3000/neu | head -5
kill %1
```

Erwartet: Healthcheck 200, Formular-HTML mit `name="quoteBefore"`. Dass der Lauf gegen
das **Buendel** geht und nicht gegen `dist/`, ist Absicht: genau das laeuft spaeter auf
dem Server, und Buendelfehler faende man sonst erst dort.

Danach der Durchlauf ueber den Workflow:

```bash
git push
curl -fsS https://korrekturen.msmr.co/healthz
```

- [ ] **Step 8: Commit**

```bash
git add packages/api/src/app.ts packages/api/src/app.test.ts packages/api/src/web.ts packages/api/src/routes/health.test.ts CLAUDE.md docs/kurzbefehl.md
git commit -m "App verdrahten, Bootstrap und Kurzbefehl-Dokumentation"
```

---

## Abnahme P0–P2

Nach Task 24 sind erfüllt:

- **P0:** `pnpm build && pnpm test` gruen; Push auf `main` deployt, `/healthz` unter der Subdomain liefert 200.
- **P1:** Migration idempotent, Seed läuft, Kennzahlen-Views liefern gegen Bounce,
  Autoreply, frische Meldung, nicht abrufbare Seite, `mailto:`-Datensatz und n = 1 die
  erwarteten Zahlen.
- **P2:** Eine vom iPhone erfasste Meldung erzeugt einen Datensatz mit Ankern, versendet
  eine Mail mit `[K…]` im Betreff und Meta-Block im Text; zweimal derselbe
  Idempotency-Key ergibt einen Datensatz. Redaktionen und Fehlerarten sind über
  Formulare anlegbar, änderbar und archivierbar; ein Löschversuch bei vorhandenen
  Referenzen archiviert statt zu löschen.

**Erster echter Lauf:** `.env` mit den tatsächlichen SMTP-Zugangsdaten füllen, unter
`/admin/redaktionen` eine reale Redaktion mit Kontaktadresse anlegen und die erste
Meldung an eine **eigene Testadresse** schicken, bevor die erste echte Redaktion
angeschrieben wird. Vorher SPF, DKIM und DMARC für die Absenderdomain prüfen — ohne die
landen genau die Mails im Spam, die ankommen sollen.

## Folgepläne

Diese Phasen bekommen eigene Pläne, jeweils nach Abschluss der vorigen:

| Phase | Inhalt |
|---|---|
| **P3** | IMAP-Antworten: `imapflow`, Cursor-Persistenz, Zuordnungskaskade, Autoreply- und Bounce-Klassifikation |
| **P4** | Altbestand: Korpus-Export, Vorlagen-Parser, Konfidenz-Scoring, Review-Queue, `References`-Matching der Altantworten |
| **P5** | Artikel-Checks per Cron mit Anker-Kaskade, `robots.txt`, Domain-Rate-Limit |
| **P6** | Öffentliches Frontend: `packages/web` mit TanStack Table und Recharts, Review-Queues |
| **P7** | `/anleitung`, „Was diese Zahlen nicht sagen", Impressum, Datenschutzerklärung |
| **später** | Externer Zugang für fremde Nutzer nach Abschnitt 15 der Spec |
