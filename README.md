# Korrekturen — Textfehler melden und verfolgen

Erfasst Fehler in Online-Artikeln, meldet sie per E-Mail an die zuständige
Redaktion und verfolgt, was daraus wird: ob eine Antwort kommt und ob die
beanstandete Stelle sich ändert. Läuft produktiv unter
[korrekturen.msmr.co](https://korrekturen.msmr.co).

Das Projekt beantwortet **nicht**, welches Medium die meisten Fehler macht —
absolute Meldungszahlen messen das Leseverhalten des Betreibers, nicht die
Sorgfalt einer Redaktion. Die Frage ist: **Was passiert, wenn man einen
Fehler meldet?**

## Komponenten

**Erfassung.** Ein Formular für beide Rollen: Betreiber unter `/neu`
(Anmeldung, Versand über den Server), Besucher unter `/hinweis` (Versand über
das eigene Mail-Programm). Vorbefüllung über drei Wege — Bookmarklet
(Desktop), ein Kurzbefehl für Safari **und** Nachrichten-Apps (Adresse aus
dem Teilen-Menü, Fundstelle aus der Zwischenablage), oder von Hand. Eine
vorbefüllte Fundstelle ist gegen versehentliches Tippen gesperrt. Details:
[`docs/bookmarklet-und-kurzbefehl.md`](docs/bookmarklet-und-kurzbefehl.md).

**Automatische Vorschläge.** Kategorie, Schweregrad, Anzahl und konkretes
Satzzeichen werden aus dem Paar Fundstelle/Berichtigung erkannt (reine
Regeln, kein Modell) und sprachlich korrekt benannt („zwei Zeichen fehlen").
Konservativ: lieber kein Vorschlag als ein falscher; alles von Hand
übersteuerbar.

**Fehlersuche im Artikel.** Ein Knopf prüft den Artikel über die
[LanguageTool](https://languagetool.org)-API; Treffer zeigen Änderung und
Satz und lassen sich per Klick übernehmen. Läuft nur auf Klick; für
Besucher gilt ein Tageskontingent (gezählt als Hash aus Tagessalz und IP,
die IP wird nie gespeichert). Ist der Artikel nicht lesbar — häufig ein
Zustimmungsfenster —, wird ersatzweise die Fundstelle geprüft und das auch
gesagt. Ein Ausfall des Dienstes ist kein Fehler: das Formular arbeitet
unverändert weiter.

**Artikel hinter einer Bezahlschranke.** Der Server bekommt dort nur
Abo-Werbung zu sehen; er erkennt das (der Abruf gelingt, der Text bleibt
unter der Mindestlänge) und sagt es, statt eine Panne vorzutäuschen. Als
Ausweg erscheint im Formular ein Feld: den Artikel angemeldet öffnen, Text
kopieren, einfügen. Er dient dem Prüfen und dem Verankern der Fundstelle
und wird **nie gespeichert** — abgelegt werden wie sonst auch nur Fundstelle
und die beiden 48-Zeichen-Anker. Zugangsdaten kommen dabei nirgends ins
Spiel, weder eigene noch fremde.

**Mail.** Text- und HTML-Teil (multipart): Wortmarke, Korrekturfahne, beide
Fassungen mit markierter Fehlstelle, Kontext-Anker, Referenz-Kennung im
Betreff. Über die Kennung finden Antworten später zum Datensatz zurück.

**Kontext-Anker.** Beim Absenden wird der Artikel einmal abgerufen und die
Fundstelle mit Text davor/danach verankert. Eine spätere Prüfung kann so
unterscheiden: unverändert, wie vorgeschlagen geändert, anders geändert,
verschwunden, Seite nicht erreichbar. Automatische Befunde landen in einer
Warteschlange, nie direkt als „korrigiert".

**Bilanz.** Öffentliche Auswertung: Kennzahlen, Verlauf, Kategorien- und
Medienverteilung mit Anteils-Segmenten, umschaltbar mit/ohne weiche
Kategorien. Quoten nur mit n, Tabellen alphabetisch, keine Rankings. Ein
Abschnitt erklärt, was die Zahlen nicht sagen.

**Historie.** Nummerierte, filterbare Liste aller Meldungen mit Kennung
und Ausgang (`/admin/meldungen`, nicht öffentlich, mit eigener Auth-Schicht
zusätzlich zur äußeren — Verteidigung in der Tiefe). Die laufende Nummer
zählt chronologisch über den Gesamtbestand und bleibt beim Filtern stehen.
Das Detail zeigt beide Fassungen in der Mail-Auszeichnung, die
Ereignisleiste (Antworten, Artikel-Prüfungen) und setzt den Ausgang:
ohne Rückmeldung / Antwort erhalten / korrigiert wie vorgeschlagen /
anders korrigiert / als richtig benannt.

**Verwaltung.** Medien (Domains, Kontaktadressen) und Fehlerkategorien
(sortierbar per Drag & Drop) hinter der Anmeldung; nach einmaliger
Basic-Auth trägt ein Sitzungs-Cookie 90 Tage.

**Worker.** Separater Prozess für wiederkehrende Aufgaben, per Cron
aufgerufen. Ein Gang durch den Posteingang: Eingangsbestätigungen wandern
in den Papierkorb (zählen nicht als Antwort), echte Redaktionsantworten
werden zugeordnet — über die Kennung im Betreff, den Faden (In-Reply-To)
oder, für Meldungen aus der Zeit vor dem Projekt, über Artikeltitel plus
Absender-Domain — und landen als Ereignis in der Historie; offene
Meldungen wechseln auf „Antwort erhalten". Der erste Lauf liest das ganze
Postfach (UID-Cursor), danach nur das Neue.

**Backfill.** Drei Einmalwerkzeuge (`pnpm backfill:korpus|review|import`)
holen über 1300 Alt-Meldungen aus dem Gesendet-Ordner in die Datenbank:
Korpus-Export, Review-Queue auf `:3223` (unterbrechbar, idempotent), Import
über eine Adminseite. Echte Mails bleiben lokal in `fixtures.local/`.

**PWA.** Favicon, Touch-Icons (iOS/Android), Web-Manifest mit Shortcuts und
ein minimaler Service Worker (nur Offline-Hinweis, kein Cache). Icons werden
aus einer Quelle generiert: `tools/iconsErzeugen.py`.

## Schutzregeln (strukturell erzwungen)

- **Keine Personendaten öffentlich.** Die öffentlichen Typen
  (`PublicCorrection`, `PublicOutlet`) besitzen die Felder gar nicht erst;
  eine Sperrliste (`FORBIDDEN_PUBLIC_FIELDS`) wird zur Laufzeit rekursiv
  geprüft und auf Typ-Ebene beim Kompilieren.
- **Kein Ranking.** Keine Bestenlisten, keine Ampelfarben auf Werten,
  Quoten nie ohne n.
- Zitierte Fundstellen ≤ 280 Zeichen; sie gehen nur an die Redaktion des
  Textes und in die nicht-öffentliche Ablage.

## Struktur

| Pfad | Inhalt |
|---|---|
| `packages/shared` | Zod-Schemas, Palette, reine Erkennungs-/Normalisierungs-/Benennungsfunktionen — einzige Typquelle |
| `packages/api` | Server: Formulare, Versand, Bilanz, Verwaltung, Datenbank (Drizzle + SQLite), Worker |
| `packages/backfill` | Einmalwerkzeuge für den Altbestand |
| `tools/` | Icon-Generator, Backfill-Import-CLI |
| `docs/` | Architektur, Specs, Anleitung Bookmarklet/Kurzbefehl |

## Entwicklung

Voraussetzungen: Node.js ≥ 22, pnpm 9.

```bash
pnpm install
pnpm test        # Vitest, gesamtes Monorepo
pnpm typecheck
pnpm lint
pnpm dev         # Entwicklungsserver (braucht Umgebung, siehe .env.example)
pnpm build       # TypeScript-Build
pnpm bundle      # esbuild-Bündel für die Produktion
```

`web.ts` validiert die Umgebung beim Start und bricht ohne vollständige
Konfiguration ab; `.env.example` listet alle Variablen.

## Deployment

GitHub Actions baut, prüft und bündelt bei jedem Push auf `main` und lädt
Web-Prozess, Worker und Migrationen per tar über SSH auf Shared-Hosting
(Plesk/Passenger; rsync steht in der Chroot nicht zur Verfügung). Migrationen
laufen beim Start; die Kennzahlen-Views werden aus den Konstanten neu
erzeugt.
