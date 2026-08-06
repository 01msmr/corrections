# Beispiel-Medien aus dem Seed entfernen

Datum: 2026-08-06 · Status: entworfen, vom Betreiber freigegeben

## Problem

`seed()` legt bei jedem Serverstart drei Platzhalter-Medien an, falls sie fehlen
(Beispiel-Zeitung, Muster-Magazin, Probe-Anzeiger — `packages/api/src/db/seed.ts`).
Sie stammen aus der Zeit, bevor `medien.json` beim Start echte Stammdaten lieferte
(Entscheidung vom 6.8.2026). Öffentlich erscheinen sie nie (die Bilanz zeigt nur
Medien mit Meldungen), aber sie stehen als Karteileichen in der Admin-Liste und
kehren nach dem Löschen beim nächsten Neustart zurück.

## Entscheidung

Die Beispiel-Medien entfallen ersatzlos. Kein Env-Flag für die Entwicklung —
lokal greift `medien.json` genauso, echter Bedarf für Platzhalter besteht nicht.

## Änderungen

1. **`seed()` verschlankt:** `DEFAULT_OUTLETS` und die zugehörige Schleife
   entfallen; `seed()` sät nur noch die Fehlerarten. Signatur und Aufrufer
   (`web.ts`, `backfillImportCli.ts`) bleiben unverändert.
2. **Aufräum-Migration (Drizzle):** löscht in Bestandsdatenbanken die Medien zu
   `beispiel-zeitung.de`, `muster-magazin.de`, `probe-anzeiger.de` samt
   `outlet_domains`-Zuordnung — aber nur, wenn keine `corrections` auf das
   Medium zeigen. Zeigt doch eine Meldung darauf, bleibt das Medium unangetastet.
3. **Tests:** Tests, die sich bisher auf die geseedeten Beispiel-Medien stützen,
   legen ihre Medien selbst an (eigene Fixtures). `seed.test.ts` prüft nur noch
   die Fehlerarten und dass keine Medien mehr entstehen.

## Nicht Teil dieser Änderung

- Kein Eingriff am Backfill-Upload (`/admin/backfill`) — er hat die Platzhalter
  nie angelegt; die erwogene Checkbox entfällt als gegenstandslos.
- Keine Änderung an `medien.json` oder `uebernimmStammdaten`.

## Risiken

Gering. Die Migration ist die einzige Stelle mit Datenwirkung; die
`corrections`-Prüfung schützt real genutzte Medien. Mehrfaches Ausführen ist
harmlos (Drizzle führt Migrationen ohnehin nur einmal aus).
