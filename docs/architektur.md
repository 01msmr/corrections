# Aufbau und Deployment

Zwei Diagramme: wie eine Meldung durch die Anwendung läuft, und wie der Code auf
den Server kommt. Beides beschreibt den Stand, nicht die Absicht — was hier steht,
existiert.

## Aufbau

```mermaid
flowchart TB
    subgraph Eingabe
        KB["iOS-Kurzbefehl<br/>Teilen-Menü"]
        BM["Bookmarklet<br/>Desktop"]
        BR["Browser<br/>direkt"]
    end

    KB --> NEU
    BM --> NEU
    BR --> NEU

    NEU["/neu — Erfassung<br/>hinter Basic Auth"]
    ADM["/admin — Redaktionen,<br/>Fehlerarten"]

    subgraph API["packages/api — Hono auf Node 26"]
        NEU --> REPO
        ADM --> REPO
        REPO["repo/corrections.ts<br/>Ablauf einer Meldung"]
        REPO --> FETCH["article/fetch + extract<br/>Artikel holen, Text ziehen"]
        FETCH --> ANCHOR["article/anchor.ts<br/>Fundstelle verankern"]
        REPO --> COMPOSE["dispatch/compose.ts<br/>Betreff, Text, HTML"]
        COMPOSE --> SEND["dispatch/send.ts<br/>SMTP"]
        REPO --> DB[("data/korrektur.db<br/>SQLite über node:sqlite")]
        WORKER["worker.ts<br/>noch kein Cronjob"] -.-> DB
    end

    subgraph SHARED["packages/shared — reine Funktionen, kein IO"]
        SCHEMA["schemas.ts — Zod, einzige Typquelle"]
        URL["url.ts — Kanonisierung"]
        TEXT["text.ts — Normalisierung"]
        DIFF["diff.ts — Wortvergleich für die Hervorhebung"]
        REGION["regions.ts — Sprachraum-Kürzel"]
    end

    REPO --> SCHEMA
    REPO --> URL
    ANCHOR --> TEXT
    COMPOSE --> DIFF
    ADM --> REGION

    SEND --> MX["mxe8db.netcup.net<br/>Submission, STARTTLS"]
    MX --> RELAY["relay.yourmailgateway.de"]
    RELAY --> RED["Redaktion"]
    RED -. "Antwort mit Kennung<br/>im Betreff, manuell erfasst" .-> ADM
```

Der Rückweg ist bewusst gestrichelt: Einen automatischen Abruf der Antworten gibt
es nicht. Die Kennung im Betreff (`compose.ts`) ist die Zuordnungshilfe beim
Nachtragen von Hand.

## Deployment

```mermaid
flowchart LR
    DEV["Arbeitsplatz<br/>pnpm dev"] -->|"git push main"| GH["GitHub<br/>01msmr/corrections"]

    GH --> ACT

    subgraph ACT["GitHub Actions — .github/workflows/deploy.yml"]
        direction TB
        INST["pnpm install"] --> BUILD["pnpm -r build"]
        BUILD --> PRUEF["typecheck · lint · test"]
        PRUEF --> BUNDLE["pnpm bundle — esbuild<br/>ein CJS-Bündel, keine node_modules"]
        BUNDLE --> REN["web.js → app.js"]
        REN --> MIG["migrations/ mitkopieren"]
    end

    MIG -->|"tar über SSH<br/>kein rsync: fehlt in der Chroot"| SRV

    subgraph SRV["netcup Webhosting — Plesk, Passenger"]
        direction TB
        ROOT["/korrekturen.msmr.co<br/>app.js · worker.js · migrations/"]
        DATA[("data/korrektur.db<br/>bleibt beim Deployment stehen")]
        HTTPDOCS["httpdocs/<br/>leer, nur Dokumentenstamm"]
        ROOT --- DATA
    end

    SRV -->|"touch tmp/restart.txt"| PASS["Passenger startet neu<br/>Migrationen + Seed beim Start"]
    PASS --> LIVE["https://korrekturen.msmr.co"]

    ENVV["Umgebungsvariablen<br/>im Plesk-Node.js-Panel"] -.-> PASS
    DNS["DNS bei netcup<br/>SPF · DKIM key2 · DMARC p=none"] -.-> LIVE
```

Zwei Eigenheiten dieser Umgebung, die man kennen muss:

- **Kein `rsync`** in netcups Chroot — der Upload läuft deshalb über `tar` durch
  eine SSH-Verbindung. `tmp/` ist ausgenommen, weil `pnpm bundle` ein leeres
  `build/tmp` anlegt und sonst Passengers Arbeitsverzeichnis überschriebe.
- **Kein sichtbares Anwendungslog.** Passenger leitet die Ausgabe des
  Node-Prozesses nirgendwohin, was aus der Chroot erreichbar wäre. Fehler beim
  Versand sind deshalb nur über den Datensatz selbst zu diagnostizieren, nicht
  über `console.error`.

## Ergänzungen (Stand 5. August 2026)

Seit den Diagrammen oben dazugekommen:

- **Öffentliche Startseite** unter `/` („In eigener Sache", Rubriken „In eigener
  Sache" und „Aus der Werkstatt", zweispaltig). Die Wurzel leitet nicht mehr auf
  das Formular; die Mail-Fußzeile verweist hierher.
- **Formular-Endpunkte** hinter der Basic-Auth (`/neu/*`):
  `POST /neu/vorschau` (Mail-Vorschau ohne Nebenwirkung, Platzhalter-Kennung
  VORSCHAU, echter Versand erst über den Sendeknopf der Vorschau),
  `POST /neu/kategorie` (automatische Kategorie- und Schwere-Erkennung,
  `shared/detect.ts`), `POST /neu/ueberschrift` (holt den Artikeltitel, sobald
  die URL im Formular steht), `POST /admin/fehlerarten/reihenfolge` (ziehbare
  Sortierung, Zehnerschritte).
- **Eine Palette für alles:** `PALETTE`/`PALETTE_DUNKEL` in
  `packages/shared/src/constants.ts`. Oberfläche (CSS-Variablen und data-URIs in
  `layout.tsx`) und Mail (Inline-Stile in `compose.ts`) fragen dieselben Werte
  ab; ein Test pinnt fest, dass in der Mail nichts literal bleibt.
- **Mail als Zeitungskommentar** (`compose.ts`): Titelzeile, Untertitel-Band,
  Rubrik „Korrektur", Schlagzeile, Serifen-Fließtext, Fassungen als Blöcke mit
  farbiger Kante in Courier — nur Inline-Stile und überall vorhandene Schriften.
- **Wortwelt:** Ressorts „In eigener Sache · Neue Korrektur · Titel ·
  Kategorien"; das Versandobjekt heißt Hinweis, sein Token Kennung; Schwere
  leicht/mittel/schwer. Fehlerarten sind die flache Liste des
  ursprünglichen Kurzbefehls plus Ergänzungen.
- **Geplant, noch nicht gebaut:** die öffentliche Statistik-Seite „Bilanz"
  (Route + Ansicht; Kennzahlen-Views und `repo/stats.ts` liegen bereit; Regeln:
  Quoten nie ohne n, alphabetisch, kein Ranking). Offen außerdem: der
  Worker-Cronjob in Plesk und der verwaiste alte Deploy-Schlüssel in
  `authorized_keys`.

## Ergänzungen (Stand 6. August 2026)

### Bilanz — die öffentliche Statistik steht

`GET /bilanz` (öffentlich, fünftes Ressort). Zahlen kommen aus `repo/bilanz.ts`,
die Ansicht aus `views/bilanz.tsx`:

- **Eckdaten** (Korrekturen, Medien, Zeitraum), **beide Leitquoten**,
  **Verteilung** nach Fehlerart und Schwere, **Zeitreihe je Monat**,
  **Medien-Tabelle** und der Abschnitt „Was diese Zahlen nicht sagen".
- **Zwei Regeln tragen die Ehrlichkeit der Seite:** Eine Korrektur ohne
  Artikel-Prüfung zählt nicht in den Korrektur-Nenner (sie ist *ungeprüft*, nicht
  *nicht korrigiert*), und ohne gelaufenen Postfach-Abgleich bleibt der
  Antwort-Nenner leer. Sonst behauptete die Seite bei frischem Bestand „0 %" —
  eine Aussage über uns, ausgegeben als Aussage über die Redaktionen.
- Monate ohne Korrektur werden in der Zeitreihe mit Null gefüllt, damit die Achse
  keinen gleichmäßigen Verlauf vortäuscht.
- Tabellen lassen sich per Klick auf den Spaltenkopf umsortieren (Zahlenspalten
  beim ersten Klick absteigend). Die Serverantwort bleibt alphabetisch, die
  Voreinstellung stellt also keine Rangfolge auf.

### Altbestand (P4) — Werkzeuge fertig, Import läuft

Eigenes Paket `packages/backfill`, getrennt vom Serverpfad; gemeinsam mit dem
Dauerbetrieb nur `packages/shared`.

- `pnpm backfill:korpus` — Gesendet-Ordner einmalig read-only als `.eml` nach
  `fixtures.local/korpus` (1328 Mails).
- `pnpm backfill:review` — Review-Queue auf **:3223**, ein Bildschirm pro Meldung,
  `Enter` übernehmen / `E` bearbeiten / `X` verwerfen. **Jederzeit unterbrechbar:**
  jede Entscheidung geht sofort nach `fixtures.local/review-entscheidungen.jsonl`,
  der Neustart überspringt Entschiedenes.
- `pnpm backfill:import` bzw. **`/admin/backfill`** — spielt die Entscheidungen
  ein (`source='backfill'`, idempotent über die Message-ID). Die Adminseite ist
  nötig, weil die SSH-Chroot des Hosters **keine Node-Laufzeit** hat.
- Der Vorlagen-Parser liest die Kurzbefehl-Mails konservativ: 85 % sicher, der
  Rest zur Prüfung oder verworfen — geraten wird nie.

### Fehlerarten mit Anzahl und Zeichen

Eine Kategorie, freie Anzahl: `corrections.error_count` und `error_char`. Die
Erkennung zählt mit (`detectErrorCount`, `detectErrorChar`), `benenneFehlerart`
in `shared` fügt es sprachlich zusammen — „ein Zeichen fehlt", „zwei Wörter zu
viel", „ein Komma zu viel". Zahlwörter bis zwölf, darüber Ziffern.

### Medien-Stammdaten

`packages/api/src/db/medien.json` — die Redaktionsnamen und Korrekturadressen aus
dem Wörterbuch des Kurzbefehls (`RedNAME`/`RedMAIL`), beim Start übernommen
(`tools/medienStammdaten.ts`): anlegen, was fehlt, aktualisieren, was abweicht.
Sie schlägt aus Altmails abgeleitete Adressen, weil sie auch Medien ohne Meldung
kennt und Adresswechsel bereits enthält.

### Domains

Ein archiviertes Medium gibt seine Domains frei — sonst blockierte es sie
unsichtbar. Wandert eine Domain zu einem anderen Medium, folgen ihr die
bisherigen Korrekturen (zugeordnet über den Host der kanonischen Artikel-URL);
geholt wird nur von archivierten Medien. Zusatzdomains lassen sich entfernen,
ohne dass Korrekturen verloren gehen; die letzte Domain bleibt stehen.

### Farben

Auszeichnungsfarbe ist Kirschrot `#bb2233` (dunkel `#e07b86`), Schwarz für
Schatten als `PALETTE.schatten`. **Eine Lint-Regel verbietet Farbliterale**
außerhalb von `constants.ts` — der Deploy bricht sonst ab.

### Offen

P3 (Antwort-Zuordnung per IMAP) und P5 (Artikel-Prüfungen per Cronjob) — solange
sie fehlen, bleiben beide Quoten der Bilanz leer. Außerdem weiter offen: der
Worker-Cronjob in Plesk und der verwaiste Deploy-Schlüssel in `authorized_keys`.
