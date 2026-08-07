# Medien-Segmente im Diagramm „Was auffällt“

Datum: 2026-08-07 · Status: entworfen, vom Betreiber freigegeben (inkl. Abstufungs-Detail)

## Ziel

Die Balken der Fehlerarten-Verteilung auf der Bilanz zeigen, welche Medien den
jeweiligen Balken ausmachen — als anteilige Segmente der Balkenbreite. Zusätzlich
werden die Balken geringfügig höher (`.85rem` → `1.05rem`).

## Entscheidungen (Rückfrage vom 6./7.8.2026)

- **Beteiligte = Medien.** Keine Schwere-Anteile.
- **Schwelle:** Ein Medium bekommt ein eigenes Segment, wenn sein Anteil am Balken
  **≥ 15 %** beträgt **und** mindestens **3 Korrekturen** dahinterstehen. Alles
  darunter sammelt sich im Abschnitt **„übrige“**. Erreicht kein Medium die
  Schwelle, bleibt der Balken einfarbig wie bisher (kleine n werden nicht
  scheingenau zerteilt).
- **Nur „Was auffällt“.** Die Verteilung „Wie schwer“ bleibt unverändert.
- **Kein Ranking:** Segmente stehen **alphabetisch** (de-Collation), nur ihre
  Breite trägt die Menge; „übrige“ steht immer am Ende. Unter dem Diagramm
  erklärt eine Zeile im bestehenden `zaehler`-Stil, was die Breite bedeutet und
  dass die Reihenfolge alphabetisch ist.

## Darstellung

- Erstes Segment volles Karmin (`var(--korrektur)`), jedes folgende **ansteigend
  heller** über `color-mix(in srgb, var(--korrektur) X%, var(--papier))` mit
  positionsweise fallendem X (100 → 82 → 64 → 46); „übrige“ ist stets der
  hellste Ton (28 %). Keine neuen Farbliterale — nur `var(…)`-Mischungen
  (ESLint-Regel bleibt erfüllt).
- Zwischen Segmenten eine **dünne Trennlinie in Papierweiß** (1px,
  `var(--papier)`), auch im Dunkelmodus korrekt, da über die Palette gelöst.
- Je Segment `title` und `aria-label` „NAME — ANZAHL“. Im Segment steht
  „NAME NN %“ (Nachträge vom 7.8.2026): Sans fett klein, immer in Papierweiß;
  zu knappe Beschriftung läuft in eine Ellipse aus, unter 3.5rem
  (Container-Query) entfällt sie ganz — der Tooltip bleibt. Das
  Anteils-Prozent ist keine Quote: sein n steht als Gesamtzahl am Balkenende.
- „übrige“ trägt keinen Namen, sondern eine enge Diagonal-Schraffur
  (2px-Raster) aus vollem Karmin und 30-%-Karmin.
- Keine Erklärzeile unter dem Diagramm (gestrichen am 7.8.2026).

## Umsetzungsskizze

1. **shared:** Schwellwerte als Konstanten in `packages/shared/src/constants.ts`
   (`SEGMENT_MINDEST_ANTEIL = 0.15`, `SEGMENT_MINDEST_ANZAHL = 3`), einzige
   Werte-Quelle.
2. **repo/bilanz.ts:** Fehlerarten-Abfrage zählt zusätzlich je Fehlerart ×
   Medium; eine reine Funktion `segmentiere(...)` (ohne IO) wendet Schwelle,
   Alphabet und „übrige“-Sammelposten an. `Verteilungswert` erhält optional
   `beteiligte: { name: string; anzahl: number }[]` — nur für Fehlerarten
   befüllt.
3. **views/bilanz.tsx:** `Verteilung` rendert Segmente, wenn `beteiligte`
   vorhanden; sonst wie bisher. Balkenhöhe in `views/layout.tsx` auf `1.05rem`.
4. **Tests:** Segmentlogik (Schwelle, Alphabet, „übrige“, kleines n → keine
   Segmente) in `repo/bilanz.test.ts`; Tooltip/aria im HTML in
   `routes/bilanz.test.ts`.

## Nicht Teil dieser Änderung

- Keine Segmentierung von „Wie schwer“ und des Verlaufs.
- Keine öffentliche JSON-Antwort — die Bilanz ist serverseitig gerendertes HTML;
  `PublicCorrection`/`PublicOutlet` bleiben unberührt (Medienname + Anzahl stehen
  dort ohnehin schon in der Medien-Tabelle).
