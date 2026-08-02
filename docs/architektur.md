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
