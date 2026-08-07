# Medien-Segmente im Diagramm „Was auffällt“ — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die Fehlerarten-Balken der Bilanz zeigen als anteilige, ansteigend hellere Segmente, welche Medien den Balken ausmachen; Balken werden geringfügig höher.

**Architecture:** Reine Segmentlogik (Schwelle, Alphabet, „übrige“) in `repo/bilanz.ts` als exportierte Funktion ohne IO; Schwellwerte als Konstanten in `packages/shared`; Darstellung in `views/bilanz.tsx` + CSS in `views/layout.tsx`. Spec: `docs/superpowers/specs/2026-08-07-medien-segmente-was-auffaellt-design.md`.

**Tech Stack:** TypeScript strict, Drizzle/`node:sqlite`, Hono-JSX (serverseitig), Vitest.

## Global Constraints

- TypeScript strict. Kein `any`, kein `as` außer in Typ-Guards. (CLAUDE.md)
- Kein Ranking: Segmente alphabetisch, nur die Breite trägt die Menge. (CLAUDE.md + Spec)
- **Keine Farbliterale außerhalb `constants.ts`** — nur `var(…)`/`color-mix` mit Palette-Variablen; ESLint erzwingt das. (Memory `design-und-wortwelt`)
- Sichtbare Texte mit ä/ö/ü/ß; Bezeichner, CSS-Klassen, Kommentare ASCII.
- Testaufrufe vom Repo-Stamm (`runMigrations` löst relativ zum cwd auf): `pnpm exec vitest run <pfad>`.

---

### Task 1: Segmentlogik + Daten (shared, repo)

**Files:**
- Modify: `packages/shared/src/constants.ts` (nach `MIN_N_FOR_RATE`, Zeile ~6)
- Modify: `packages/api/src/repo/bilanz.ts` (`Verteilungswert` Zeile 13, `ladeBilanz` Zeilen 91–96 und 131)
- Test: `packages/api/src/repo/bilanz.test.ts`

**Interfaces:**
- Produces (shared): `SEGMENT_MINDEST_ANTEIL = 0.15`, `SEGMENT_MINDEST_ANZAHL = 3`.
- Produces (repo): `interface Beteiligter { name: string; anzahl: number }`; `Verteilungswert` erhält optionales Feld `beteiligte?: Beteiligter[]`; `export const UEBRIGE_NAME = "übrige"`; `export function segmentiere(gesamt: number, medien: Beteiligter[]): Beteiligter[]` (rein, ohne IO). `ladeBilanz` befüllt `beteiligte` nur bei `fehlerarten` (ggf. leeres Array), nie bei `schwere`/`medienListe`.

- [ ] **Step 1: Failing Tests — Segmentlogik**

In `packages/api/src/repo/bilanz.test.ts` (Imports ergänzen: `segmentiere`, `UEBRIGE_NAME` aus `./bilanz.js`) einen neuen describe-Block anfügen:

```ts
describe("segmentiere", () => {
  const medien = (paare: [string, number][]) => paare.map(([name, anzahl]) => ({ name, anzahl }));

  it("bildet Segmente ab 15 % und 3 Stueck, alphabetisch, Rest als uebrige", () => {
    // n=20: Schwelle ist max(3, 3) = 3
    const teile = segmentiere(20, medien([["taz", 8], ["FAZ", 5], ["Zeit", 2], ["Welt", 5]]));
    // de-Collation ordnet nach Basisbuchstaben: FAZ < taz < Welt (Groß/Klein egal).
    expect(teile.map((t) => t.name)).toEqual(["FAZ", "taz", "Welt", UEBRIGE_NAME]);
    expect(teile.map((t) => t.anzahl)).toEqual([5, 8, 5, 2]);
  });

  it("verlangt beide Schwellen: 2 von 4 sind 50 %, aber unter 3 Stueck", () => {
    expect(segmentiere(4, medien([["taz", 2], ["FAZ", 2]]))).toEqual([]);
  });

  it("laesst uebrige weg, wenn alle Medien qualifiziert sind", () => {
    const teile = segmentiere(10, medien([["taz", 7], ["FAZ", 3]]));
    expect(teile.map((t) => t.name)).toEqual(["FAZ", "taz"]);
  });

  it("bleibt bei kleinem n leer statt scheingenau", () => {
    expect(segmentiere(1, medien([["taz", 1]]))).toEqual([]);
  });
});

describe("beteiligte in ladeBilanz", () => {
  it("haengt Segmente an die Fehlerarten, nicht an die Schwere", () => {
    const [erstes] = ersteMedien(1);
    if (!erstes) throw new Error("Testmedien fehlen");
    for (let i = 0; i < 3; i++) meldung({ outletId: erstes });
    const bilanz = ladeBilanz(db, JETZT);
    const fehlerart = bilanz.fehlerarten[0];
    // Beispiel-Zeitung traegt alle 3 — ein Segment, kein "uebrige".
    expect(fehlerart?.beteiligte).toEqual([{ name: "Beispiel-Zeitung", anzahl: 3 }]);
    expect(bilanz.schwere[0]?.beteiligte).toBeUndefined();
  });
});
```

(`ersteMedien`/`meldung` existieren in der Datei; `meldung` nutzt dieselbe Fehlerart für alle Einträge.)

- [ ] **Step 2: Tests laufen lassen — müssen fehlschlagen**

Run: `pnpm exec vitest run packages/api/src/repo/bilanz.test.ts`
Expected: FAIL — `segmentiere`/`UEBRIGE_NAME` nicht exportiert.

- [ ] **Step 3: Konstanten in shared**

In `packages/shared/src/constants.ts` nach dem `MIN_N_FOR_RATE`-Block:

```ts
/** Medien-Segmente in "Was auffaellt": eigenes Segment nur ab diesem Anteil am Balken … */
export const SEGMENT_MINDEST_ANTEIL = 0.15;
/** … und nur ab dieser absoluten Anzahl — kleine Balken bleiben einfarbig. */
export const SEGMENT_MINDEST_ANZAHL = 3;
```

- [ ] **Step 4: Segmentlogik und Abfrage in `repo/bilanz.ts`**

Import ergänzen: `SEGMENT_MINDEST_ANTEIL, SEGMENT_MINDEST_ANZAHL` aus `@korrektur/shared`. Typen erweitern:

```ts
export interface Beteiligter {
  name: string;
  anzahl: number;
}

export interface Verteilungswert {
  name: string;
  anzahl: number;
  /** Nur bei den Fehlerarten: Medien-Anteile fuer die Segment-Darstellung. */
  beteiligte?: Beteiligter[];
}

/** Sichtbarer Name des Sammelpostens — auch die Ansicht erkennt ihn daran. */
export const UEBRIGE_NAME = "übrige";

/**
 * Medien-Segmente eines Balkens: eigenes Segment nur ab SEGMENT_MINDEST_ANTEIL
 * am Balken UND SEGMENT_MINDEST_ANZAHL Stueck; der Rest sammelt sich in
 * "uebrige". Alphabetisch, nicht nach Groesse — die Breite traegt die Menge,
 * eine Reihenfolge nach Groesse waere ein kleines Ranking je Balken (§2.2).
 * Qualifiziert sich kein Medium, bleibt der Balken einfarbig (leeres Array).
 */
export function segmentiere(gesamt: number, medien: Beteiligter[]): Beteiligter[] {
  const schwelle = Math.max(gesamt * SEGMENT_MINDEST_ANTEIL, SEGMENT_MINDEST_ANZAHL);
  const eigene = medien
    .filter((medium) => medium.anzahl >= schwelle)
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
  if (eigene.length === 0) return [];

  const rest = gesamt - eigene.reduce((summe, medium) => summe + medium.anzahl, 0);
  return rest > 0 ? [...eigene, { name: UEBRIGE_NAME, anzahl: rest }] : eigene;
}
```

In `ladeBilanz` nach der bestehenden `fehlerarten`-Abfrage (Zeilen 91–96) die Medien-Zählung ergänzen und beim Rückgabewert verheiraten:

```ts
  const fehlerartenMedien = db.all<{ name: string; medium: string; anzahl: number }>(sql`
      SELECT e.label AS name, o.name AS medium, COUNT(*) AS anzahl
      FROM corrections c
        JOIN error_types e ON e.id = c.error_type_id
        JOIN outlets o ON o.id = c.outlet_id
      GROUP BY e.label, o.name
    `);
  const medienJeFehlerart = new Map<string, Beteiligter[]>();
  for (const zeile of fehlerartenMedien) {
    const liste = medienJeFehlerart.get(zeile.name) ?? [];
    liste.push({ name: zeile.medium, anzahl: zeile.anzahl });
    medienJeFehlerart.set(zeile.name, liste);
  }
```

Und im `return`-Objekt `fehlerarten` ersetzen durch:

```ts
    fehlerarten: fehlerarten.map((wert) => ({
      ...wert,
      beteiligte: segmentiere(wert.anzahl, medienJeFehlerart.get(wert.name) ?? []),
    })),
```

- [ ] **Step 5: Tests laufen lassen — müssen bestehen**

Run: `pnpm exec vitest run packages/api/src/repo/bilanz.test.ts`
Expected: PASS (bisherige + 5 neue Tests). Achtung Randfall im ersten Test: Schwelle bei n=20 ist `max(20·0,15; 3) = 3` — „Zeit“ (2) fällt raus, die übrigen drei qualifizieren sich.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/constants.ts packages/api/src/repo/bilanz.ts packages/api/src/repo/bilanz.test.ts
git commit -m "Bilanz: Medien-Anteile je Fehlerart mit Schwellenlogik

Segment ab 15 % und 3 Stueck, alphabetisch, Rest als 'uebrige' —
Grundlage fuer die Segment-Darstellung in 'Was auffaellt'.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Darstellung (Segmente, Abstufung, Trennlinie, Balkenhöhe)

**Files:**
- Modify: `packages/api/src/views/bilanz.tsx` (`Verteilung`, Zeilen 77–96; Import Zeile 3; Erklärzeile nach Zeile 153)
- Modify: `packages/api/src/views/layout.tsx` (CSS `balkenspur`/`balkenfuellung`, Zeilen 430–431)
- Test: `packages/api/src/routes/bilanz.test.ts`

**Interfaces:**
- Consumes: `Verteilungswert.beteiligte?: Beteiligter[]` und `UEBRIGE_NAME` aus Task 1.
- Produces: nur Markup/CSS — Klassen `balkenteil`, Modifikator `uebrige`.

- [ ] **Step 1: Failing Test — Segment-Markup**

In `packages/api/src/routes/bilanz.test.ts` anfügen (nutzt vorhandenes `meldung(anzahl)`, das alle Meldungen der ersten Fehlerart und dem ersten Medium — Beispiel-Zeitung — zuordnet):

```ts
  it("zeigt Medien-Segmente mit Tooltip und Erklaerzeile", async () => {
    meldung(3);
    const res = await bilanzRoutes(db, () => JETZT).request("/bilanz");
    const html = await res.text();
    expect(html).toContain('title="Beispiel-Zeitung — 3"');
    expect(html).toContain("Reihenfolge alphabetisch");
  });
```

- [ ] **Step 2: Test laufen lassen — muss fehlschlagen**

Run: `pnpm exec vitest run packages/api/src/routes/bilanz.test.ts`
Expected: FAIL — kein `title`-Attribut im Balken-Markup.

- [ ] **Step 3: `Verteilung` rendert Segmente**

In `packages/api/src/views/bilanz.tsx` den Import in Zeile 3 um `UEBRIGE_NAME` ergänzen (`import { UEBRIGE_NAME, type Bilanz, … } from "../repo/bilanz.js";`) und die Komponente ersetzen:

```tsx
/** Waagerechte Balken; der laengste Balken fuellt die Breite. Bringt ein Wert
 *  `beteiligte` mit, teilt sich die Fuellung in anteilige Segmente. */
const Verteilung: FC<{ werte: Verteilungswert[] }> = ({ werte }) => {
  const groesster = werte.reduce((max, wert) => Math.max(max, wert.anzahl), 0);
  return (
    <div class="verteilung">
      {werte.map((wert) => (
        <div class="balkenzeile">
          <span class="balkenname">{wert.name}</span>
          <span class="balkenspur">
            <span
              class="balkenfuellung"
              style={`width: ${groesster > 0 ? (wert.anzahl / groesster) * 100 : 0}%`}
            >
              {(wert.beteiligte ?? []).map((teil) => (
                <span
                  class={teil.name === UEBRIGE_NAME ? "balkenteil uebrige" : "balkenteil"}
                  style={`width: ${wert.anzahl > 0 ? (teil.anzahl / wert.anzahl) * 100 : 0}%`}
                  role="img"
                  title={`${teil.name} — ${teil.anzahl}`}
                  aria-label={`${teil.name} — ${teil.anzahl}`}
                />
              ))}
            </span>
          </span>
          <span class="balkenwert">{wert.anzahl}</span>
        </div>
      ))}
    </div>
  );
};
```

Direkt unter `<Verteilung werte={bilanz.fehlerarten} />` (Zeile ~153) die Erklärzeile:

```tsx
          <p class="zaehler">
            Die Abschnitte eines Balkens zeigen, welche Medien ihn ausmachen — die
            Breite ist ihr Anteil, die Reihenfolge alphabetisch, Kleinbeträge sammeln
            sich in „übrige“. Beim Zeigen nennt jeder Abschnitt Medium und Anzahl.
          </p>
```

- [ ] **Step 4: CSS — Abstufung, Trennlinie, Höhe**

In `packages/api/src/views/layout.tsx` die beiden Zeilen

```css
  .balkenspur { display: block; height: .85rem; background: var(--linie); }
  .balkenfuellung { display: block; height: 100%; background: var(--korrektur); }
```

ersetzen durch:

```css
  .balkenspur { display: block; height: 1.05rem; background: var(--linie); }
  .balkenfuellung { display: flex; height: 100%; background: var(--korrektur); }
  /* Medien-Segmente: von links nach rechts ansteigend heller (gemischt aus der
     Palette, keine eigenen Farbwerte), "uebrige" stets am hellsten. Dazwischen
     eine duenne Trennlinie in Papierweiss. */
  .balkenteil { display: block; height: 100%; background: var(--korrektur); }
  .balkenteil:nth-child(2) { background: color-mix(in srgb, var(--korrektur) 82%, var(--papier)); }
  .balkenteil:nth-child(3) { background: color-mix(in srgb, var(--korrektur) 64%, var(--papier)); }
  .balkenteil:nth-child(n + 4) { background: color-mix(in srgb, var(--korrektur) 46%, var(--papier)); }
  .balkenteil.uebrige { background: color-mix(in srgb, var(--korrektur) 28%, var(--papier)); }
  .balkenteil + .balkenteil { border-left: 1px solid var(--papier); }
```

(`--korrektur` und `--papier` existieren als Palette-Variablen; `box-sizing: border-box` gilt global, die 1px-Linie geht also von der Segmentbreite ab, nicht darüber hinaus.)

- [ ] **Step 5: Tests, Typecheck, Lint**

Run: `pnpm exec vitest run packages/api/src/routes/bilanz.test.ts` → PASS,
dann `pnpm test && pnpm typecheck && pnpm lint` → alles grün (285+ Tests).

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/views/bilanz.tsx packages/api/src/views/layout.tsx packages/api/src/routes/bilanz.test.ts
git commit -m "'Was auffaellt': Medien-Segmente, ansteigend heller, mit Trennlinie

Balken geringfuegig hoeher (1.05rem); Erklaerzeile unter dem Diagramm.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Sichtkontrolle über die lokale Anwendung

- [ ] **Step 1:** `pnpm dev` starten (lokale Datenbank `data/korrektur.db` mit Backfill-Bestand), `/bilanz` im Browser öffnen und einen Screenshot der Sektion „Was auffällt“ ziehen — hell und dunkel.
- [ ] **Step 2:** Screenshot dem Betreiber zur Abnahme zeigen (Abstufung, Trennlinien, Balkenhöhe). Erst nach Freigabe pushen/deployen.
