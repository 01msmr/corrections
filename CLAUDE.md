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
