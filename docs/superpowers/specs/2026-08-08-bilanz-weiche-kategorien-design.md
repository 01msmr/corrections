# Bilanz-Umschalter: weiche Kategorien ausblenden

Datum: 2026-08-08 · Status: entworfen, vom Betreiber freigegeben

## Entscheidungen

- **Wirkung: die ganze Bilanz-Seite.** Eckdaten, „Was auffällt“, „Wie schwer“,
  Verlauf und Medienliste rechnen konsequent ohne die weichen Kategorien —
  keine sich widersprechenden Zahlen auf einer Seite.
- **Voreinstellung: ohne weiche Kategorien.** Serverseitig über `?alle=1`
  umschaltbar (kein JavaScript); unter dem Umschalter steht, was gerade
  ausgeblendet ist.
- **Weich ist vorerst nur `schlechter_satzbau`** — als erweiterbare Konstante
  `WEICHE_FEHLERARTEN` in `packages/shared/src/constants.ts` (einzige
  Werte-Quelle; die Bilanz nennt die ausgeblendeten Kategorien beim Label).

## Umsetzung

1. shared: `export const WEICHE_FEHLERARTEN = ["schlechter_satzbau"] as const;`
2. `repo/bilanz.ts`: `ladeBilanz(db, jetzt, optionen?: { mitWeichen?: boolean })`
   (Vorgabe false). Alle Abfragen schließen Meldungen aus, deren Fehlerart in
   der Liste steht (`error_type_id NOT IN (SELECT id FROM error_types WHERE
   key IN …)`), sofern `mitWeichen` nicht gesetzt ist.
3. `routes/bilanz.tsx`: `?alle=1` → `mitWeichen: true`; Wert an die View.
4. View: Umschalt-Zeile über den Eckdaten im `zaehler`-Stil mit Link auf die
   jeweils andere Ansicht und der Nennung der ausgeblendeten Kategorie(n).
   Kein Ranking-/Ampel-Bezug; die Voreinstellung bleibt die strengere Zählung.
5. Tests: Filter wirkt auf Eckdaten/Fehlerarten/Medienliste (repo);
   Voreinstellung ohne, `?alle=1` mit, Hinweiszeile vorhanden (route).
