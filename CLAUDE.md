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

**Import in die Produktion:** Nicht die Datenbank hochladen — das überschriebe alles,
was inzwischen über das Formular erfasst wurde. Stattdessen **https://korrekturen.msmr.co/admin/backfill**
öffnen (Admin-Zugang) und dort `fixtures.local/review-entscheidungen.jsonl` hochladen.
Der Import läuft im Serverprozess, legt nur fehlende Meldungen an und lässt vorhandene
unberührt; mehrfaches Einspielen ist gefahrlos.

Warum über die Oberfläche und nicht per SSH: In der Chroot des Hosters gibt es keine
Node-Laufzeit (`/.nodenv/shims/node` zeigt ins Leere, `/opt/plesk/node` fehlt). Das
CLI-Werkzeug `tools/backfillImportCli.js` wird trotzdem mitgeliefert — es läuft lokal
und in jeder Umgebung, die Node im Pfad hat.

Ist der Altbestand drin, kann die Route entfallen: eine Zeile in `app.ts` (§11.5).

## Regeln
- TypeScript strict. Kein `any`, kein `as` außer in Typ-Guards.
- Zod-Schemas leben in `packages/shared` und sind die einzige Typquelle.
- Parser und Normalisierer sind reine Funktionen ohne IO. IO nur in `db/client.ts`,
  `article/fetch.ts`, `dispatch/send.ts`, `inbox/postfach.ts`, `repo/*.ts`.
- Zeitstempel als UTC-Epoch-Sekunden (int) in der Datenbank, Formatierung nur in der Ansicht.
- Datenbankänderungen nur über Drizzle-Migrationen. Ausnahme: die Kennzahlen-Views,
  die beim Start aus den Konstanten in `shared` neu erzeugt werden.
- **`author` wird nicht erhoben, nicht gespeichert, nicht extrahiert.**
- Neue Felder in öffentlichen Antworten nur über `PublicCorrection` / `PublicOutlet`.
  Bei Zweifel `FORBIDDEN_PUBLIC_FIELDS` erweitern.
- Kein Ranking, keine Bestenliste, keine Ampelfarben auf Werten. Quoten nie ohne ihr n.
  Tabellen kommen alphabetisch vom Server. Umsortieren per Spaltenkopf ist erlaubt
  (bewusste Entscheidung vom 6.8.2026) — die Voreinstellung bleibt alphabetisch, und
  unter der Medien-Tabelle steht, was die Zahl misst und was nicht.
- Nie echte Mailinhalte, personenbezogene Adressen oder Tokens committen. **Ausnahme:**
  die Korrekturadressen der Redaktionen in `packages/api/src/db/medien.json` — sie stehen
  in den Impressen, sind an keine Person gebunden und werden beim Start übernommen
  (Entscheidung vom 6.8.2026). Postfächer von Personen gehören dort nicht hinein.

## Nicht anfassen
- `tests/fixtures/**` (nur ergänzen)
- `fixtures.local/**`, `.env`
