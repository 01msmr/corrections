# Korrektur-Tracker

## Kontext
Erfasst gemeldete Fehler in Online-Artikeln, verfolgt die Reaktionen der Redaktionen
und stellt beides auswertbar dar. Spec: `docs/superpowers/specs/2026-08-01-korrektur-tracker-design.md`.

## Befehle
- `pnpm dev` / `pnpm build` / `pnpm test` / `pnpm test:watch`
- `pnpm db:generate` (Migration erzeugen), `pnpm db:seed`
- `pnpm typecheck` / `pnpm lint`

### Altbestand (Backfill, Einmalwerkzeuge)
- `pnpm backfill:korpus` — Gesendet-Ordner einmalig als `.eml` nach `fixtures.local/korpus`
- `pnpm backfill:review` — Review-Queue auf **http://localhost:3223**
- `pnpm backfill:import` — übernommene Entscheidungen in die Datenbank

**Die Review lässt sich jederzeit unterbrechen und fortsetzen.** Jede Entscheidung wird
sofort an `fixtures.local/review-entscheidungen.jsonl` angehängt; beim Neustart
überspringt die Queue alles bereits Entschiedene. Läuft der Server nicht mehr (er hängt
an der Sitzung, in der er gestartet wurde), einfach `pnpm backfill:review` neu aufrufen
und http://localhost:3223 öffnen. Auch der Import ist idempotent (Message-ID).

Alle drei Befehle laufen von überall im Repo; Pfadangaben beziehen sich auf den
Repo-Stamm. `DATABASE_PATH` steuert das Importziel (Vorgabe `data/korrektur.db`).

**Import in die Produktion:** Das Werkzeug läuft nur lokal — auf dem Server liegt nur
das Bündel. Also lokal importieren und die fertige Datei hochladen (der Import macht
zum Schluss einen WAL-Checkpoint, die `.db` ist danach vollständig):

```bash
pnpm backfill:import
scp -i ~/.ssh/netcup_deploy data/korrektur.db \
  hosting189417@hosting189417.ae8d9.netcup.net:korrekturen.msmr.co/data/korrektur.db
ssh -i ~/.ssh/netcup_deploy hosting189417@hosting189417.ae8d9.netcup.net \
  'cd korrekturen.msmr.co && rm -f data/korrektur.db-wal data/korrektur.db-shm && touch tmp/restart.txt'
```

Die alten `-wal`/`-shm`-Dateien müssen weg, sonst mischt SQLite sie in die neue Datei.

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
