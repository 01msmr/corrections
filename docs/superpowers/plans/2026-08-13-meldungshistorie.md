# Meldungshistorie Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nummerierte, filterbare Liste aller Meldungen mit Kennung und Ausgang
(`/admin/meldungen`), Detailseite je Meldung mit Ereignisleiste und dem
Formular „Ausgang setzen" — der erste Schreiber des `outcome`-Felds.

**Architecture:** Repo-Modul mit ROW_NUMBER über den Gesamtbestand (stabile
Nummern trotz Filter), zwei Admin-Routen hinter der bestehenden Auth, zwei
Ansichten im Blatt-Stil. Ausgang-Werte: `open` (ohne Rückmeldung),
`acknowledged`, `corrected`, neu `corrected_other`, `rejected`. SQLite kennt
die Enum nicht als Constraint — die Erweiterung braucht keine Migration.

**Tech Stack:** Drizzle/`node:sqlite` (`db.all(sql\`…\`)` wie in
`repo/bilanz.ts`), Hono + Hono-JSX, Vitest.

## Global Constraints

- Entscheidung Betreiber: Navi-Name **„Meldungen"**; Antwort-Datum wird von
  Hand eingetragen (das echte Mail-Datum; Eingangsbestätigungen zählen nicht).
- Historie ist **nicht öffentlich** (nur hinter `/admin/*`-Auth).
- Keine Ampelfarben auf Ausgängen; Zeitstempel UTC-Epoch-Sekunden, Formatierung
  nur in der Ansicht; kein `any`, kein `as` außer Typ-Guards.
- Seitengröße 100; Nummern chronologisch aufsteigend über den Gesamtbestand
  (`COALESCE(sent_at, created_at), id`), Liste zeigt neueste zuerst.
- **Verteidigung in der Tiefe:** Der Meldungen-Router trägt seine eigene
  `adminAuth`-Schicht zusätzlich zur /admin/*-Verdrahtung in app.ts — faellt
  die äußere durch einen Programmierfehler weg, sperrt die innere weiter.
  Ein Test montiert den Router ohne die äußere Schicht und erwartet 401.
  Alle Antworten tragen `Cache-Control: no-store`.

---

### Task 1: Ausgang-Erweiterung und Repo-Modul

**Files:**
- Modify: `packages/api/src/db/schema.ts` (outcome-Enum + `corrected_other`)
- Create: `packages/api/src/repo/meldungen.ts`
- Test: `packages/api/src/repo/meldungen.test.ts`

**Interfaces:**
- Produces: `listeMeldungen(db, filter)`, `zaehleMeldungen(db, filter)`,
  `leseMeldung(db, id)`, `setzeAusgang(db, id, angaben)`,
  Typen `MeldungsZeile`, `MeldungsFilter`, `Ausgang`.

- [ ] **Step 1: Failing Tests** — Nummern bleiben beim Filtern stabil (drei
  Meldungen, Filter auf Medium B ⇒ Nummer 2 bleibt 2); Filter Medium,
  Kategorie, Ausgang, Freitext (ref/Überschrift/URL, LIKE, maskiert);
  Seiten (limit/offset); `leseMeldung` liefert Ereignisse
  (`response_events` + `article_checks`) zeitlich sortiert; `setzeAusgang`
  schreibt outcome/respondedAt/correctedAt und lehnt unbekannte ids ab.
- [ ] **Step 2: Implementierung** — Unterabfrage mit
  `ROW_NUMBER() OVER (ORDER BY COALESCE(sent_at, created_at), id) AS nummer`,
  außen Filter + `ORDER BY nummer DESC LIMIT :n OFFSET :o`; Join auf
  outlets/error_types für Namen. `setzeAusgang` als einzelnes UPDATE.
- [ ] **Step 3: `pnpm exec vitest run packages/api/src/repo/meldungen.test.ts`** — PASS
- [ ] **Step 4: Commit** `git commit -m "Meldungs-Repo: nummerierte Liste, Detail, Ausgang-Schreiber"`

### Task 2: Ansichten

**Files:**
- Create: `packages/api/src/views/meldungen.tsx`
- Modify: `packages/api/src/views/layout.tsx` (Bereich `meldungen`,
  Navi-Eintrag „Meldungen" in `.randressorts`, BEREICH_TITEL)
- Test: über Task 3 (Routen-Tests prüfen Markup)

**Interfaces:**
- Consumes: `MeldungsZeile`, Detailform aus Task 1;
  `vergleicheFassungen` für die Fahne.
- Produces: `MeldungsListe` (Filterformular als GET, Tabelle `sortierbar`,
  Seiten-Links, die Filter erhalten), `MeldungsDetail` (Fassungen mit Fahne,
  Anker, Versanddaten, Ereignisleiste, Formular „Ausgang setzen":
  Select mit den fünf Ausgängen in Betreiber-Wortwelt, Datumsfelder
  „Antwort vom" / „korrigiert am", Hinweis: Eingangsbestätigungen zählen
  nicht als Antwort).

- [ ] **Step 1:** Ansichten schreiben; Ausgänge als Text ohne Wertungsfarben:
  offen→„ohne Rückmeldung", acknowledged→„Antwort erhalten",
  corrected→„korrigiert wie vorgeschlagen", corrected_other→„anders
  korrigiert", rejected→„als richtig benannt"; `no_response` nur lesbar.
- [ ] **Step 2:** Datumseingabe `<input type="date">`, Umrechnung zur UTC-Epoche
  in der Route (12:00 UTC gegen Zeitzonenkippen).
- [ ] **Step 3: Commit** mit Task 3 gemeinsam.

### Task 3: Routen und Verdrahtung

**Files:**
- Create: `packages/api/src/routes/admin/meldungen.tsx`
- Modify: `packages/api/src/app.ts` (Route registrieren)
- Test: `packages/api/src/routes/admin/meldungen.test.ts`, Ergänzung `app.test.ts`

**Interfaces:**
- Consumes: Task-1-Repo, Task-2-Ansichten.
- Produces: `GET /admin/meldungen` (Filter aus Query, zod-geprüft, Unlesbares
  ignoriert), `GET /admin/meldungen/:id` (404 bei unbekannt),
  `POST /admin/meldungen/:id/ausgang` (Redirect zurück aufs Detail).

- [ ] **Step 1: Failing Tests** — Liste 200 mit Kennung + Nummer; Filter
  wirkt; Detail zeigt beide Fassungen; POST setzt Ausgang und leitet um;
  alles hinter Auth (401 ohne); der Router allein montiert (ohne app.ts-
  Schicht) liefert ebenfalls 401; Antworten tragen no-store.
- [ ] **Step 2: Implementieren + verdrahten**; Navi zeigt „Meldungen" nur
  Betreibern (wie Medien|Kategorien).
- [ ] **Step 3: Voll-Lauf** `pnpm exec vitest run && pnpm typecheck && pnpm lint` — PASS
- [ ] **Step 4: Commit + Push**; Deploy abwarten, live gegen `/admin/meldungen`
  prüfen (401 ohne Zugang genügt als Beleg).
