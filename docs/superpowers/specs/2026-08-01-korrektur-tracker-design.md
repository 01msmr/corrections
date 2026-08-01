# Korrektur-Tracker — Design

**Stand:** 2026-08-01
**Status:** abgestimmt, Grundlage für den Implementierungsplan

---

## 1. Kontext und Ziel

Beim Lesen von Online-Artikeln gefundene Fehler werden an die zuständige Redaktion
gemeldet. Das System erfasst diese Meldungen strukturiert, verfolgt was daraus wird
— Antwort, Korrektur, keine Reaktion — und stellt das Ergebnis öffentlich und
nachvollziehbar dar.

Die Frage, die das Projekt beantwortet, ist nicht „welches Medium macht die meisten
Fehler". Das lässt sich aus dieser Datengrundlage nicht beantworten und wird auch
nicht behauptet. Die Frage ist: **Was passiert, wenn man einen Fehler meldet?**

Betrieb: öffentliches Repository, Selfhosting per Docker unter einer Subdomain.

---

## 2. Harte Randbedingungen

Diese beiden bestimmen das Design, nicht die Kosmetik.

### 2.1 Keine Personendaten in öffentlich erreichbaren Bereichen

Keine Namen von Autorinnen und Autoren, Herausgebern oder sonstigen beteiligten
Personen. Keine E-Mail-Adressen. Kein Wortlaut aus Redaktionsantworten.

Umgesetzt als **Struktur, nicht als Flag**:

- `author` wird nicht gespeichert. Nicht „gespeichert und nicht publiziert" — gar
  nicht erhoben. Was nicht in der Datenbank liegt, kann kein Bug und kein Dump
  veröffentlichen. Für die Auswertung auf Outlet-Ebene wird das Feld nicht gebraucht.
- Zwei getrennte Router mit **zwei getrennten Typen**: `/api/public/*` serialisiert
  ausschließlich `PublicCorrection`, ein Typ, der die kritischen Felder nicht besitzt.
  `/api/admin/*` (hinter Auth) sieht alles. Kein Laufzeit-Filtern, kein „maskieren
  vergessen".
- Ein Test prüft jede öffentliche Antwort gegen eine Feld-Sperrliste
  (`recipient_email`, `from_addr`, `excerpt`, `contact_emails`, `observed_text`, …).
  Ein Feld, das versehentlich in den Public-Typ gerät, macht die Suite rot.

### 2.2 Kein Redaktions-Blaming — nur harte Fakten

- Keine Rankings, keine Bestenlisten, kein „Top 10", kein zusammengesetzter Score
  oder Index pro Outlet.
- Standardsortierung der Tabelle: **alphabetisch**. Der Nutzer kann nach Quote
  sortieren — dann ist die Reihenfolge seine Handlung, keine Aussage der Seite.
- Keine Ampelfarben, kein Rot/Grün auf Werten. Ein rotes Badge ist ein Urteil,
  auch ohne Wort. Farbe nur zur Unterscheidung von Serien.
- Keine Superlative in Überschriften und Fließtext.
- Die **Startseite handelt vom Phänomen, nicht von Häusern**: Wie oft führen
  gemeldete Fehler zu einer Korrektur, bei welchen Fehlertypen, wie entwickelt sich
  das. Die Aufschlüsselung nach Outlet ist vollständig vorhanden und erreichbar —
  sie ist nur nicht die Schlagzeile.

---

## 3. Grundsatzentscheidungen

### 3.1 Der Server versendet die Mail, nicht das Endgerät

Ursprünglich sollte der iOS-Kurzbefehl die Mail über den Mail-Client verschicken und
zusätzlich einen JSON-POST an die API senden. Das bedeutet **zwei Schreibvorgänge
ohne gemeinsame Transaktion**: Mail raus / POST fehlgeschlagen ⇒ Meldung existiert in
der Welt, aber nicht in der Datenbank. POST erfolgreich / Mail still gescheitert
(falscher iOS-Standardaccount) ⇒ Datensatz ohne Wirkung, der die Antwortquote
verfälscht. Beides fällt erst Wochen später auf, wenn überhaupt.

Stattdessen: **Der Server baut und versendet die Mail per SMTP über ein Relay des
Mailproviders** (nicht über einen eigenen MTA — die Zustell-Reputation bleibt damit
die des Providers).

Folgen:

- **Die `Message-ID` ist bekannt, weil der Server sie vergibt.** Kein Fuzzy-Match über
  URL und Zeitfenster. Das ist der Hauptgewinn — er kostet nichts und hängt an keinem
  Provider-Feature.
- Der Gesendet-Ordner muss im Dauerbetrieb nicht geparst werden. IMAP liest nur INBOX.
- Retry und Fehlerbehandlung liegen serverseitig.

Bewusst in Kauf genommenes Risiko: SMTP-Zugangsdaten auf einem öffentlich
erreichbaren Server. Abgemildert durch Credentials mit reinem Submit-Recht,
Rate-Limit und Relay-Nutzung statt eigenem MTA. Siehe Abschnitt 13.

### 3.2 Erfassung im selbstgehosteten Web-Formular, nicht im Kurzbefehl

Der Kurzbefehl schrumpft auf **zwei Aktionen**: Safari-Details holen → URL
`https://<host>/neu?url=…` öffnen. Danach wird er nicht mehr angefasst.

Damit verschwinden:

- Das Bearer-Token im Klartext im Kurzbefehl — ersetzt durch eine Browser-Session
  hinter der bestehenden Auth. Kein Rotationsproblem, kein Geheimnis auf dem Gerät.
- Das Outlet-Wörterbuch im Kurzbefehl. Neue Redaktion oder geänderte Adresse ist ein
  Datenbankeintrag, keine neue Kurzbefehl-Version auf mehreren Geräten.
- Die Kurzbefehl-Versionierung überhaupt. Ein Fehler in der Erfassungslogik ist ein
  Deploy.
- Die iOS-Bindung. Am Schreibtisch gelesene Artikel sind gleichwertig erfassbar.

Einstiegswege in das Formular:

| Weg | URL | Zitat | JS nötig |
|---|---|---|---|
| iOS/iPadOS Safari, Text markiert → Teilen → Kurzbefehl | ja | ja (Auswahl) | nein |
| macOS Safari, gleiches Share-Sheet | ja | ja | nein |
| Android Chrome → Web Share Target der PWA | ja | ja | nein |
| Desktop, beliebiger Browser: URL und Zitat einfügen | ja | ja | nein |
| Desktop-Bookmarklet (füllt beides vor) | ja | ja | ja |

Nur die letzte Zeile braucht `javascript:`. Sie ist Bequemlichkeit, **nicht
tragend** — etliche Nachrichtenseiten setzen eine CSP, die `javascript:`-URLs
blockt. Als Pflichtpfad wäre das eine Fehlerquelle, die bei jedem neuen Outlet neu
entdeckt würde.

Bekannte Grenze: Die Erfassung braucht Netz. Kein Offline-Puffer, kein Sync.

### 3.3 `quote_before` muss wortgleich sein

Die spätere Korrektur-Erkennung sucht exakt diesen String im Artikel. Copy-Paste und
Textauswahl liefern das; Abgetipptes nicht. Das Formular bekommt deshalb ein
Einfügefeld mit entsprechender Beschriftung, kein Freitextfeld „sinngemäß".

### 3.4 Ein Container, ein Prozess

Ein Node-Prozess bedient die Hono-API, liefert das gebaute Frontend statisch aus und
fährt IMAP-Poll sowie Artikel-Checks als In-Process-Cron. Zwei schreibende Prozesse
auf einer SQLite-Datei erzeugen Lock-Konflikte ohne Gegenwert — es gibt genau einen
Nutzer. Ein Image, ein Container, ein Traefik-Label, ein Backup-Ziel.

Persistenz: `better-sqlite3` mit Drizzle. Kein libSQL — die Turso-Infrastruktur wird
nicht genutzt.

---

## 4. Architektur

```
korrektur-tracker/
├─ CLAUDE.md
├─ Dockerfile
├─ docker-compose.yml            # Traefik-Labels, /admin zusätzlich basicauth
├─ packages/
│  ├─ shared/                    # Zod-Schemas, Typen, URL-Kanonisierung,
│  │                             # Text-Normalisierung, Kennzahlen-Konstanten
│  ├─ api/
│  │  ├─ src/routes/public/      # nur PublicCorrection
│  │  ├─ src/routes/admin/       # hinter Auth
│  │  ├─ src/db/                 # schema.ts, migrations/, views/
│  │  ├─ src/dispatch/           # Mail-Bau, SMTP-Relay
│  │  ├─ src/article/            # Fetch, Readability-Extraktion, Anker, Checks
│  │  ├─ src/ingest/             # imap-client.ts (IO), parser.ts, matcher.ts (rein)
│  │  └─ src/backfill/           # Einmalwerkzeug, nicht im Laufzeitpfad
│  └─ web/                       # Vite + React, TanStack Table v8, Recharts
├─ tests/fixtures/               # synthetische .eml + HTML-Varianten
└─ fixtures.local/               # echte .eml, gitignored
```

Regeln:

- Zod-Schemas leben in `shared` und sind die einzige Typquelle. Keine parallelen
  Interfaces.
- Parser und Matcher sind reine Funktionen ohne IO. IO ausschließlich in
  `ingest/imap-client.ts`, `dispatch/` und `article/fetch.ts`.
- Zeitstempel immer UTC-Epoch (int) in der Datenbank, Formatierung nur in der UI.
- Datenbankänderungen nur über Drizzle-Migrationen.
- TypeScript strict, kein `any`, kein `as` außer in Typ-Guards.

---

## 5. Datenmodell

```
outlets
  id, name, primary_domain, publisher, country, notes
  contact_emails (json)            ← intern, nie öffentlich; Rollenadressen bevorzugt
  archived (bool)

outlet_domains
  id, outlet_id fk, domain (unique)

error_types
  id, key (unique, unveränderlich), label, description
  sort_order, archived (bool), created_at

corrections
  id, ref (unique), idempotency_key (unique)
  created_at, dispatch_mode ('smtp' | 'mailto')
  article_url, article_url_canon, outlet_id, headline, published_at
  error_type_id fk, severity (1..3)
  quote_before (≤200 Zeichen, wortgleich)
  quote_prefix, quote_suffix, quote_position_hint
  anchor_quality ('exact' | 'context' | 'none')
  suggestion_after, comment
  recipient_email                  ← intern
  message_id                       ← nur bei dispatch_mode='smtp'
  dispatch_status ('prepared' | 'sent' | 'failed' | 'bounced'), sent_at
  outcome ('open' | 'acknowledged' | 'corrected' | 'rejected' | 'no_response')
  responded_at, corrected_at
  verification ('manual' | 'none')
  source ('web' | 'backfill' | 'manual'), needs_review (bool)

response_events
  id, correction_id, kind ('reply' | 'autoreply' | 'bounce')
  received_at, raw_message_id
  from_addr, excerpt               ← intern, kein öffentlicher Serializer

article_checks
  id, correction_id, checked_at, http_status
  quote_state, match_confidence
  observed_text                    ← intern
  page_text_hash

imap_cursor
  folder, uidvalidity, last_uid
```

`quote_state`: `unchanged | changed_as_suggested | changed_otherwise | passage_gone |
unreachable`

**Indizes:** `corrections(ref)` UNIQUE, `corrections(idempotency_key)` UNIQUE,
`corrections(outlet_id, sent_at)`, `corrections(error_type_id)`,
`corrections(dispatch_status)`, `corrections(article_url_canon)`,
`outlet_domains(domain)` UNIQUE, `error_types(key)` UNIQUE,
`response_events(correction_id)`, `article_checks(correction_id, checked_at)`.

### 5.0 Stammdaten sind Daten, keine Enums

Redaktionen und Fehlerarten werden über Admin-Formulare gepflegt (Abschnitt 10).
Daraus folgt Dreierlei:

**`error_type` ist eine Tabelle, kein Enum.** Seed mit den zwölf Ausgangswerten:
`rechtschreibung`, `grammatik`, `zeichensetzung`, `zahl`, `datum`, `name`,
`faktenfehler`, `falschzitat`, `uebersetzung`, `bild`, `ueberschrift_deckt_nicht`,
`sonstiges`. Der `key` ist nach der Anlage **unveränderlich**, weil er im Meta-Block
versendeter Mails steht (`typ=zahl`) und dort nicht nachträglich korrigierbar ist.
`label`, `description` und `sort_order` sind frei änderbar.

**Kein Hard-Delete von referenzierten Stammdaten.** Wird eine Fehlerart oder ein
Outlet gelöscht, das in `corrections` vorkommt, wird `archived = true` gesetzt: der
Eintrag verschwindet aus allen Auswahllisten, bleibt aber in Historie, Tabelle und
Kennzahlen erhalten. Ein echtes `DELETE` ist nur zulässig, wenn keine Referenzen
existieren — typischerweise bei einem versehentlich automatisch angelegten Outlet.
Rückwirkend Datensätze verschwinden zu lassen, würde jede veröffentlichte Zahl
unbemerkt verändern.

**Ein Outlet, mehrere Domains.** Die automatische Anlage bei unbekannter Domain
(Abschnitt 6) erzeugt zwangsläufig Dubletten — `sz-magazin.sueddeutsche.de` neben
`sueddeutsche.de`. Statt einer Merge-Funktion löst das `outlet_domains`: die Auflösung
läuft über diese Tabelle, ein Outlet kann beliebig viele Domains führen. Die
Review-Queue für neu angelegte Outlets bietet deshalb „als weitere Domain zu
bestehendem Outlet zuordnen" an; das leere Outlet wird dabei hart gelöscht, weil es
noch keine Referenzen hat.

### 5.1 Zwei Achsen statt eines Status

Ein einzelnes Status-Enum (`sent | delivered | acknowledged | corrected | …`) mischt
zwei unabhängige Sachverhalte und verliert dabei Information: Eine zugestellte *und*
korrigierte Meldung könnte nur einen der beiden Werte tragen. Deshalb getrennt:

- `dispatch_status` — was mit der Mail passiert ist
- `outcome` — was die Redaktion getan hat

`sent_at` bleibt `NULL`, bis der Versand belegt ist: bei SMTP durch die Serverantwort,
bei `mailto:` (spätere Phase) durch die eintreffende BCC-Kopie. Das ist die
strukturelle Voraussetzung dafür, dass die Fremdnutzer-Phase keinen Datenbruch
erzeugt.

### 5.2 `ref` und Idempotenz sind zwei verschiedene Dinge

Ein Hash über `url + ISO-Minute` als Referenz-Token ist kaputt: Zwei Fehler im selben
Artikel in derselben Minute kollidieren (die zweite Meldung fällt auf 409 und geht
verloren), zwei Meldungen 90 Sekunden auseinander erzeugen zwei verschiedene Tokens,
und serverseitiges Nachrechnen driftet über die Minutengrenze.

Getrennt:

- `idempotency_key` — clientseitiger Hash, schützt gegen Doppelabsenden bei
  Netzwackler.
- `ref` — **serverseitig vergeben**: `K` + 5 Zeichen Crockford-Base32 (Alphabet ohne
  `I`, `L`, `O`, `U`, damit nichts verwechselt wird), z. B. `K7QW3`. Ein String, der
  überall identisch auftaucht: Betreff, Meta-Block, Detail-URL, Datenbank — keine
  Zusammensetzlogik, die auseinanderlaufen könnte.

  32⁵ = 33.554.432 Werte. Bei 1.000 Datensätzen kollidiert eine einzelne Vergabe mit
  ~0,003 %, bei 10.000 mit ~0,03 %. Eine Kollision ist ohnehin kein Datenverlust,
  sondern ein Retry: `UNIQUE`-Index, bei Verletzung neu würfeln, maximal fünf Versuche,
  danach Fehler. Das `K`-Präfix hält den Betreff-Regex spezifisch — `[K7QW3]`
  kollidiert nicht mit `[Ticket#12345]` und ähnlichem Beiwerk, und ein zufälliger
  Falschtreffer läuft ins Leere, weil er in der Datenbank nicht existiert.

Der Hash stand ursprünglich nur deshalb im Kurzbefehl, weil der Client die Mail baute
und das Token vor dem Versand brauchte. Mit dem serverseitigen Versand entfällt der
Grund.

---

## 6. Erfassung und Versand

Ablauf beim Absenden des Formulars:

1. Validierung (Zod), URL-Kanonisierung (`utm_*`, Fragment, bekannte Tracking-Parameter
   entfernen) → `article_url_canon`.
2. Outlet über die Domain auflösen, bei unbekannter Domain automatisch anlegen und
   `needs_review` setzen.
3. Artikel abrufen, mit `@mozilla/readability` + `linkedom` extrahieren, Text
   normalisieren (Abschnitt 8.2), `quote_before` darin lokalisieren und Anker ableiten.
   Schlägt das fehl, wird trotzdem gespeichert — mit `anchor_quality='none'`.
4. `ref` vergeben (bei `UNIQUE`-Verletzung neu würfeln, max. fünf Versuche).
5. Mail bauen und per SMTP-Relay versenden.
6. Bei Erfolg `dispatch_status='sent'`, `sent_at` setzen, `message_id` speichern.
   Bei Fehler `dispatch_status='failed'` und sichtbare Rückmeldung im Formular.

Mailaufbau:

```
From:    korrektur@<domain>
Subject: Korrekturhinweis: <Kurzbeschreibung> [K7QW3]

<Anrede, Fundstelle mit Link, Zitat, Vorschlag, Kommentar>

--
Diese Meldung wurde über <host> erstellt.
[korrektur-meta]
v=2; ref=K7QW3; url=<canon>; typ=<error_types.key>; sev=<1..3>
[/korrektur-meta]
```

Kein `Reply-To` mit Tag — Begründung in Abschnitt 7.

Der Token steht **am Ende des Betreffs**, damit `Re:`/`AW:`/`WG:`-Präfixe nicht stören;
gesucht wird er später trotzdem im gesamten Betreff. Der Meta-Block im Body ist die
dritte Zuordnungsstufe: Antworten, die das Original zitieren, tragen ihn zurück.

---

## 7. Antwort-Zuordnung

IMAP-Poll alle 15 Minuten, nur INBOX. Zustandshaltung über `UIDVALIDITY` + höchste
gesehene `UID` pro Ordner in `imap_cursor` — niemals über Datum oder Gelesen-Status.

Zuordnungskaskade — drei Stufen, die sich gegenseitig nicht ersetzen, weil sie in
verschiedenen Situationen greifen:

1. **`In-Reply-To` / `References`** gegen `corrections.message_id` → deterministisch.
   Greift bei jeder Antwort aus einem normalen Mail-Client.
2. **Betreff-Token** `/\[(K[0-9A-HJKMNP-TV-Z]{5})\]/`, im **gesamten** Betreff gesucht,
   nicht nur am Ende → fängt Ticketsysteme, die den Referenz-Header verlieren, ihren
   eigenen Token aber nur *ergänzen* statt den Betreff zu ersetzen. Ohne diese Stufe
   wäre jede Antwort aus einem Leserbrief-Ticketsystem dauerhaft Handarbeit.
3. **`ref` im zitierten Original** — derselbe Regex über den Body. Antworten, die den
   Ursprungstext zitieren, bringen den Meta-Block zurück. Kostet einen Zweig.

Kein Treffer ⇒ Review-Queue, kein Raten. Jeder Treffer wird gegen die Datenbank
aufgelöst; ein zufälliger Regex-Falschtreffer findet nichts und wird verworfen.

**Kein VERP, kein getaggtes `Reply-To`.** Es hätte nur den schmalen Fall abgedeckt, in
dem der Betreff zerstört wurde *und* trotzdem an die getaggte Adresse geantwortet wird
— und ausgerechnet Ticketsysteme führen den Anfragenden häufig über `From` statt
`Reply-To`. Zuverlässig wäre der Tag erst im `From` gewesen, dann stünde aber
`korrektur+K7QW3@…` als sichtbarer Absender in der Redaktion, was der Begründung aus
3.1 widerspricht. Plus-Adressierung beim Provider ist damit keine Voraussetzung.

Klassifikation:

- **Autoreply**: `Auto-Submitted: auto-replied`, `X-Autoreply`, `Precedence: bulk`
  → `kind='autoreply'`. Zählt **nicht** als Antwort.
- **Bounce**: `Content-Type: multipart/report; report-type=delivery-status`
  → `kind='bounce'`, setzt `dispatch_status='bounced'`.
- Sonst `kind='reply'`, setzt `responded_at` und `outcome='acknowledged'`, sofern
  nicht bereits weiter.

Voraussetzung für Zustellbarkeit: **SPF, DKIM und DMARC** für die Absenderdomain.
Ohne das landen genau die Mails im Spam, die ankommen sollen.

Optional serverseitig: eine Sieve-Regel auf das Adressmuster sortiert Antworten in
einen eigenen Ordner, den der Worker gezielt liest.

---

## 8. Korrektur-Erkennung über Kontext-Anker

### 8.1 Verfahren

Statt eines reinen Substring-Vergleichs wird die Fundstelle über **Kontext-Anker**
verankert: das Tripel `prefix` / `exact` / `suffix`, normiert im W3C *Web Annotation
Data Model* als `TextQuoteSelector`. Dasselbe Verfahren nutzen Hypothes.is zum
Verankern von Annotationen, GNU `patch` über Kontextzeilen und Googles
`diff-match-patch` beim Anwenden von Patches.

Die Anker entstehen **bei der Erfassung** (Abschnitt 6, Schritt 3), aus dem
gerenderten Artikeltext: je ca. 48 Zeichen vor und nach dem Zitat, verlängert bis der
Anker im Dokument eindeutig ist. `quote_position_hint` dient als Tiebreaker bei
Mehrfachvorkommen.

Ein reiner Substring-Test kann nur „Zitat da / Zitat weg" — und „weg" bedeutet
gleichermaßen korrigiert, umgeschrieben, Paywall, depubliziert oder andere
A/B-Variante. Mit Ankern wird unterschieden:

| Befund | `quote_state` |
|---|---|
| Anker gefunden, Mitte identisch | `unchanged` |
| Anker gefunden, Mitte entspricht dem Vorschlag | `changed_as_suggested` |
| Anker gefunden, Mitte anders geändert | `changed_otherwise` |
| Anker weg, Seite erreichbar | `passage_gone` |
| Seite nicht erreichbar, Paywall, Wall | `unreachable` |

Damit wird **die Übernahme des Vorschlags messbar** — und stille Korrekturen ohne
Korrekturhinweis werden sichtbar. Das war mit dem ursprünglichen Boolean nicht
möglich.

### 8.2 Normalisierung ist Pflicht

Vor jedem Vergleich: NFKC, Whitespace zusammenfalten, typografische gegen gerade
Anführungszeichen vereinheitlichen, Geviert- und Halbgeviertstriche, weiche
Trennstriche und geschützte Leerzeichen entfernen. Ohne das melden die Checks
Änderungen, die nur der CMS-Renderer verursacht hat. Das ist die häufigste Ursache für
Fehlalarme und tritt sofort auf. Die Normalisierungsfunktion lebt in `shared` und wird
von Erfassung und Check identisch verwendet.

### 8.3 Kaskade und Konfidenz

Exakt → `prefix`+`suffix` → nur einer von beiden → unscharf (Bitap, kleine Toleranz)
→ nicht gefunden. Jede Stufe senkt `match_confidence`.

**Ein automatischer Befund setzt niemals `corrected_at`.** Er hebt den Datensatz in die
Review-Queue; die Bestätigung ist manuell (`verification='manual'`). Auf einer
öffentlichen Seite darf „korrigiert" keine Vermutung sein.

Cron: Tag 1, 3, 7, 30 und 90 nach `sent_at`. `robots.txt` respektieren, höchstens ein
Request pro Domain und Minute, klarer User-Agent mit Kontakt-URL.

---

## 9. Kennzahlen

### 9.1 Der Fehler, den das Design vermeidet

„Anzahl Meldungen pro Outlet" ist keine Eigenschaft des Outlets. Die Zahl misst, wie
viel dort gelesen wurde. „Süddeutsche 180, taz 4" liest sich als „45-mal so viele
Fehler" und bedeutet „45-mal so viele gelesene Artikel". Auf einer öffentlichen Seite
wäre das eine strukturell erzeugte Falschaussage.

Deshalb:

- **Absolutzahlen heißen im UI „Meine Meldungen"**, nicht „Fehler", und stehen nicht
  im Zentrum.
- **Vergleichbar sind nur bedingte Quoten**: gegeben, dass eine Meldung einging —
  wurde reagiert, wurde korrigiert. Das ist Verhalten der Redaktion und unabhängig
  vom Leseverhalten.

### 9.2 Hierarchie

1. **Korrekturquote** — überprüfbare Realität, Leitkennzahl
2. **Übernahmequote** — Vorschlag übernommen oder anders geändert
3. **Antwortquote** — nur SMTP-Population, mit eigenem n
4. **Median Reaktionszeit** — **nachgeordnet**: keine KPI-Kachel, nicht auf der
   Startseite, nur als standardmäßig ausgeblendete Tabellenspalte und in der
   Detailansicht

### 9.3 Definitionen

| Kennzahl | Zähler | Nenner |
|---|---|---|
| Korrekturquote | `corrected_at` gesetzt, manuell bestätigt | zustellbar ∧ reif ∧ prüfbar |
| Übernahmequote | `quote_state = changed_as_suggested` | alle geänderten Passagen |
| Antwortquote | ≥ 1 `response_event(kind='reply')` | zustellbar ∧ reif ∧ `dispatch_mode='smtp'` |
| Median Reaktionszeit | `responded_at − sent_at` | nur Antwortende, n ausgewiesen |

- **zustellbar** = `dispatch_status='sent'` und kein Bounce. `prepared` und `failed`
  fallen aus jeder öffentlichen Zahl heraus. Eine Mail, die nie ankam, darf keine
  Redaktion belasten.
- **reif** = `sent_at` liegt ≥ **14 Tage** zurück. Ohne diese Grenze ziehen frische
  Meldungen jede Quote nach unten, und die Seite sieht schlechter aus, je aktiver
  gemeldet wird. Der Wert ist eine benannte Konstante in `shared` und wird auf der
  Seite genannt.
- **prüfbar** (nur Korrekturquote) = Artikel war abrufbar und Zitat oder Anker
  auffindbar. Paywall und Depublikation sind kein „nicht korrigiert" — sie erscheinen
  als eigene Abdeckungszahl („n von m prüfbar"), nicht im Nenner.
- **Autoreplies zählen nicht** als Antwort.
- Median statt Mittelwert, weil die Verteilung stark rechtsschief ist: eine Antwort
  nach acht Monaten verschiebt jeden Mittelwert.

### 9.4 Kleine Fallzahlen

1. **Jede Quote steht nie ohne ihr n**: „42 % (5 von 12)", nicht „42 %".
2. **Unter n = 10 wird keine Quote angezeigt**, nur die Rohzahlen. Der Wert existiert
   in der Datenbank, er wird nur nicht behauptet.
3. **95-%-Wilson-Intervall** wird als Fehlerbalken dargestellt — als Schutz gegen
   Überinterpretation kleiner Unterschiede, **nicht** als Ranking-Kriterium
   (siehe 2.2).

### 9.5 Umsetzung

Alle Kennzahlen als **SQL-Views**, nicht im Frontend gerechnet — damit Tabelle, Chart
und CSV-Export garantiert dieselbe Zahl zeigen. Reifegrenze, n-Schwelle und
Konfidenzniveau als benannte Konstanten in `shared`.

Tests gegen einen Fixture-Datensatz mit bewusst gemeinen Fällen: Bounce, Autoreply,
frische Meldung innerhalb der Reifegrenze, Paywall, n = 1, `mailto:`-Datensatz ohne
belegten Versand.

---

## 10. Öffentliche Darstellung

- **Startseite**: Phänomen-Ebene — Korrekturquote gesamt, Aufschlüsselung nach
  Fehlertyp, Zeitreihe pro Monat, Abdeckung („n von m prüfbar").
- **Tabelle** (TanStack Table v8): Gruppierung nach Outlet, Fehlertyp und Monat,
  Aggregation über die Views, Spaltenfilter, CSV-Export. Alphabetisch vorsortiert,
  n stets sichtbar, Quoten unter der Schwelle unterdrückt.
- **Detailansicht** einer Meldung: Artikel-Link, Zitat, Vorschlag, Status, Verlauf der
  Artikel-Checks. **Kein** Antwortwortlaut, **keine** Adressen.
- **Admin-Stammdaten** hinter Auth:
  - **Redaktionen**: anlegen, bearbeiten, archivieren; Name, Verlag, Land, Notizen,
    Kontaktadressen (mehrere), Domains (mehrere). Löschen nur ohne Referenzen.
  - **Fehlerarten**: anlegen, bearbeiten, archivieren, Reihenfolge ändern. `key` nach
    Anlage gesperrt (siehe 5.0).
- **Admin-Review-Queues** hinter Auth: nicht zugeordnete Antworten, automatische
  Änderungsbefunde, neu angelegte Outlets (mit „zu bestehendem Outlet zuordnen"),
  Backfill-Kandidaten.
- Serverseitige Pagination. Keine Virtualisierung — bei realistischen Bestandsgrößen
  spekulativ.

**„Was diese Zahlen nicht sagen"** — ein kurzer, gut sichtbarer Abschnitt: dass die
Artikelauswahl nicht zufällig ist, dass die Meldungszahl das Leseverhalten abbildet,
dass Redaktionen ohne Antwort trotzdem korrigiert haben können, und dass die
Korrekturerkennung automatisiert ist und irrt. Das kostet keine Glaubwürdigkeit, es
erzeugt sie — und es ist die Absicherung gegen den Vorwurf, mit einer selektiven
Stichprobe Rufschaden anzurichten.

---

## 11. Altbestand (über 300 Meldungen)

### 11.1 Ein Bestand, eine Vorlage

Alle Altmeldungen stammen aus demselben Kurzbefehl. Sie haben keinen Meta-Block, aber
eine feste Struktur. Das ist ein anderes Problem als „beliebige Mails parsen": kein
heuristischer Allzweck-Parser, sondern ein **vorlagenspezifischer Parser**, abgeleitet
aus den echten Mails.

Erster Schritt ist kein Code, sondern ein Korpus: einmalig und read-only alle Mails aus
dem Gesendet-Ordner als `.eml` nach `fixtures.local/` (gitignored — öffentliches
Repository). Danach wird ausschließlich gegen Dateien entwickelt, nie wiederholt gegen
IMAP.

### 11.2 Rekonstruierbarkeit

| Feld | Quelle | Güte |
|---|---|---|
| `sent_at`, `message_id`, `recipient_email` | Header | sicher |
| `outlet_id` | Empfängerdomain | sicher |
| `article_url` | erster externer Link im Body | hoch |
| `headline`, `quote_before`, `suggestion_after`, `error_type` | Vorlagen-Parser | vorlagenabhängig |
| `quote_prefix` / `quote_suffix` | — | nicht rekonstruierbar |

Altdatensätze erhalten `anchor_quality='none'`, `source='backfill'`,
`verification='none'`. Sie fallen aus der Übernahmequote heraus und tragen zur
Korrekturquote nur bei, wenn das Zitat heute noch prüfbar ist. Die Seite weist diese
Ungleichbehandlung aus.

### 11.3 Die alten Antworten sind auffindbar

Sobald die `message_id` jeder Altmeldung in der Datenbank steht, lassen sich Antworten
in INBOX und Archiv über `In-Reply-To` / `References` **deterministisch** zuordnen —
ohne Betreff-Token, ohne Heuristik. Der Backfill liefert damit rückwirkend auch
Antwortquote und Reaktionszeiten über den gesamten Bestand.

### 11.4 Review-Queue auf Durchsatz

300 Datensätze bestätigen heißt: ein Bildschirm in etwa zehn Sekunden. Also eine
Ansicht ohne Scrollen, Rohmail links, geparste Felder rechts, Tastatursteuerung
(`Enter` übernehmen, `E` korrigieren, `X` verwerfen), sortiert nach Konfidenz
absteigend. Was der Parser nicht sicher erkennt, wird **verworfen statt geraten** —
250 belastbare Datensätze sind mehr wert als 320 mit 70 Erfindungen.

### 11.5 Abgrenzung

Der Backfill ist ein **Einmalwerkzeug**: eigener Ordner, eigener `pnpm backfill:*`
Einstieg, nicht im Laufzeitpfad des Servers, nach Abschluss abschaltbar. Gemeinsam mit
dem Dauerbetrieb hat er nur die Zod-Schemas. Seine Testfixtures im Repository sind
**synthetisch** — nach Vorbild der echten Mails, aber ohne echte Adressen, Namen oder
Inhalte.

---

## 12. Recht und Datenschutz

- **Zitatrecht (§ 51 UrhG):** `quote_before` ≤ 200 Zeichen, immer mit Quellenangabe und
  Link. Der bei einem Check beobachtete *neue* Text ist ein weiteres Zitat: intern
  speichern ist nötig und unproblematisch, öffentlich erscheint höchstens das Paar
  „vorher / nachher" innerhalb derselben Grenze — oder nur das Urteil („Vorschlag
  übernommen"). Kein Volltext, kein Absatzkontext, keine öffentlichen Snapshots.
- **Personenbezug:** siehe 2.1. `author` wird nicht erhoben.
- **Antworten der Redaktionen** sind private Korrespondenz: nur Status und — nachrangig
  — Reaktionszeit, nie Wortlaut, auch nicht gekürzt.
- **Impressum und Datenschutzerklärung** sind bei einer öffentlichen Seite Pflicht.
- Kein Rechtsrat. Vor dem Öffentlichschalten lohnt eine kurze anwaltliche Einschätzung.

---

## 13. Sicherheit

- SMTP-Zugangsdaten mit reinem Submit-Recht, Rate-Limit auf dem Versandpfad,
  Versand über das Relay des Providers statt eines eigenen MTA.
- `/neu` und `/admin` hinter Basic-Auth (Traefik-Middleware). Kein Token auf
  Endgeräten.
- `contact_emails` erscheinen in keiner öffentlichen Response und in keinem
  öffentlichen HTML — die Outlet-Tabelle wäre sonst ein Verzeichnis redaktioneller
  Mailadressen für Scraper.
- `.env` in `.gitignore` und `.claudeignore`, `.env.example` mit Platzhaltern im Repo.
- Nie echte Mailinhalte, Adressen oder Tokens committen.
- Backup: `sqlite3 .backup` nächtlich per Cron. Die Datei nicht im laufenden Betrieb
  kopieren.

---

## 14. Phasenplan

| | Phase | Abnahme |
|---|---|---|
| **P0** | Monorepo (`shared`/`api`/`web`), TS strict, Vitest, ESLint, ein Dockerfile, compose + Traefik, `.env.example` | `pnpm build && pnpm test` grün, `docker compose up` → `/healthz` = 200 |
| **P1** | Drizzle-Schema, Migrationen, URL-Kanonisierung, Text-Normalisierung, Zod-Schemas, Kennzahlen-Konstanten, SQL-Views, Seed (12 Fehlerarten, 3 Outlets) | Migration idempotent; Views liefern gegen den Fixture-Datensatz aus 9.5 die erwarteten Zahlen |
| **P2** | **Erfassung + Versand.** Formular `/neu` hinter Auth, Artikel-Fetch + Extraktion + Anker, Outlet-Auflösung, `ref`-Vergabe, Mail-Bau, SMTP-Relay, Meta-Block, Kurzbefehl-Launcher | Meldung vom iPhone erfasst → Mail an Testadresse angekommen, Betreff trägt `[K…]`, Record `sent` mit Ankern; zweimal derselbe Idempotency-Key ⇒ ein Record |
| **P3** | IMAP-Antworten: `imapflow`, Cursor, Zuordnungskaskade, Autoreply-/Bounce-Klassifikation; Parser als reine Funktionen | Dry-Run read-only meldet n Meldungen / m Antworten; Schreiblauf ohne Duplikate; Autoreply erhöht die Antwortquote nicht |
| **P4** | Altbestand: Korpus-Export, Vorlagen-Parser, Konfidenz-Scoring, Review-Queue, `References`-Matching der Altantworten | Bestand durchlaufen; Kennzahlen decken rückwirkend Jahre ab |
| **P5** | Artikel-Checks per Cron: Tag 1/3/7/30/90, `robots.txt`, ein Request pro Domain und Minute, Anker-Kaskade | Lokal servierte HTML-Varianten → alle fünf `quote_state`-Werte korrekt erkannt |
| **P6** | Öffentliches Frontend nach Abschnitt 10, Admin-Stammdatenpflege (Redaktionen, Fehlerarten), Admin-Review-Queues | Sperrlistentest der Public-Serializer grün; Redaktion und Fehlerart über das Formular anlegbar, änderbar, archivierbar; Löschversuch bei Referenzen archiviert statt zu löschen; Lighthouse ≥ 90 |
| **P7** | `/anleitung`: Methodik, „Was diese Zahlen nicht sagen", Einrichtung, Fehlerbehebung. Impressum, Datenschutzerklärung | — |

Der Parser war im Ursprungsplan P2 und ist jetzt P4: Er war dort der Kern, weil der
Server nichts über die versendeten Mails wusste. Jetzt weiß er alles, und der Parser
bedient nur noch den Altbestand. Dadurch steht der produktive Erfassungspfad nach P2 —
**ab Ende P2 wird produktiv gesammelt, während P3–P6 entstehen.**

---

## 15. Nicht in v1

**Öffentliche Erfassung für fremde Nutzer per `mailto:`.** Vorgesehen, aber später.
Der Entwurf steht bereits fest, damit `dispatch_mode` und die getrennten Nenner ab P1
im Schema liegen und die Phase ohne Migration dazukommt:

- Formular öffentlich, erzeugt `mailto:`-Link; die Mail geht unter der Adresse des
  Nutzers raus. Der Server wird dadurch **kein Mail-Relay für Fremde** — eine
  missbräuchliche Meldung würde sonst die Reputation der eigenen Domain und damit die
  Zustellung der eigenen Meldungen gefährden. Zudem wirkt ein Leserbrief von einer
  echten Person in der Redaktion anders als eine Maschinenmail.
- `bcc` auf ein Eingangspostfach belegt den Versand (best effort — nicht alle Clients
  übernehmen `bcc`). Der Betreff-Token ordnet die Kopie zu.
- **Die Antwort ist strukturell unsichtbar.** Sie geht ins Postfach des Nutzers. Auch
  ein `Reply-To` im `mailto:` hilft nicht: RFC 6068 erlaubt es, die meisten Clients
  ignorieren alles außer `to`, `cc`, `bcc`, `subject`, `body`. Der Betreff-Token ist
  hier der einzige verfügbare Schlüssel — er ordnet immerhin die BCC-Kopie zu.
- **Kopier-Button** neben dem Link (Empfänger, Betreff, Body in die Zwischenablage)
  deckt Webmail-Nutzer ohne registrierten `mailto:`-Handler ab. Ohne ihn fehlt eine
  nennenswerte Gruppe.
- **Längenlimit** beachten: je nach OS-Handler reißt der Link um ~2000 Zeichen.
- Fremdmeldungen dürfen nie in den Nenner der Antwortquote geraten (Abschnitt 9.3).
- Ab dieser Phase werden fremde Mailadressen verarbeitet: erweiterte
  Datenschutzerklärung, Rechtsgrundlage, Löschkonzept, Missbrauchsschutz,
  Rate-Limiting.

---

## 16. Benötigte Zuarbeit

1. **Vorlage der bestehenden Kurzbefehl-Mail.** Nötig für den Vorlagen-Parser in P4.
   Die vorliegende `MetaKorrektur.plist` ist ein signiertes Apple Encrypted Archive
   (`AEA1`, Profil 0 — signiert, unverschlüsselt); die Extraktion mit dem `aea`-CLI
   ist noch nicht gelungen. Einfacher: ein unsignierter Export des Kurzbefehls oder
   eine einzelne echte Beispielmail nach `fixtures.local/`.
2. **Mailprovider und Zugangsdaten**: SMTP-Submit-Host, IMAP-Host, Ordnernamen,
   App-Passwort. Bestimmt Auth-Verfahren und Ordnerbezeichnungen.
3. **Absenderdomain mit SPF, DKIM und DMARC.** Voraussetzung dafür, dass Meldungen
   überhaupt ankommen.

Plus-Adressierung beim Provider wird **nicht** benötigt (Abschnitt 7).

---

## 17. Verworfen — und warum

| Ursprünglich | Ersetzt durch | Grund |
|---|---|---|
| Client versendet die Mail, POST zusätzlich | Server versendet per SMTP | Zwei Schreibpfade ohne Transaktion; stille Divergenz |
| Fuzzy-Match der `message_id` über URL + ±10 min | `message_id` ist bekannt | Entfällt mit serverseitigem Versand |
| Dauerbetriebs-Parsing des Gesendet-Ordners | nur einmalig in P4 | dito |
| `ref = sha256(url + ISO-Minute)`, 8 Hex | Server vergibt `K` + 5 Zeichen Base32 | Kollision bei zwei Fehlern pro Minute; Drift beim Nachrechnen; 8 Zeichen unnötig lang |
| VERP-Tag im `Reply-To` als Zuordnungsstufe | ersatzlos gestrichen | Greift ausgerechnet bei Ticketsystemen unzuverlässig; zuverlässig nur im `From`, das widerspricht 3.1 |
| `error_type` als festes Enum | Tabelle `error_types` | Soll im Formular pflegbar sein; `key` bleibt gesperrt, weil er in versendeten Mails steht |
| `outlets.domain` als einziges Feld | Tabelle `outlet_domains` | Automatische Anlage erzeugt zwangsläufig Dubletten; ersetzt eine Merge-Funktion |
| Bearer-Token im Kurzbefehl | Browser-Session hinter Auth | Klartext-Geheimnis auf Endgeräten, Rotationsproblem |
| Outlet-Wörterbuch im Kurzbefehl | Outlet-Tabelle in der Datenbank | Adressänderung erforderte neue Kurzbefehl-Version |
| Drei Container (api/worker/web) | ein Container, ein Prozess | Zwei Schreiber auf einer SQLite-Datei; ein Nutzer |
| libSQL | `better-sqlite3` | Turso-Infrastruktur ungenutzt |
| Ein Status-Enum | `dispatch_status` + `outcome` | Mischte zwei Achsen, verlor Information |
| `error_still_present` als Boolean | `quote_state` mit fünf Werten | „Zitat weg" bedeutete fünf verschiedene Dinge |
| `author` + `publish_author`-Flag | Feld entfernt | Was nicht gespeichert ist, kann nicht leaken |
| Anonymisierte Echt-Mails als Repo-Fixtures | synthetisch im Repo, echte lokal | Öffentliches Repo; private Korrespondenz |
| Virtualisierung, 5.000-Zeilen-Abnahme | serverseitige Pagination | Spekulativ auf Jahre |
| „Quote-Kill-Rate" | Korrekturquote | Kampfbegriff; siehe 2.2 |
| „Anzahl Meldungen pro Outlet" als Leitzahl | bedingte Quoten | Misst das Leseverhalten, nicht das Outlet |
| Reaktionszeit als Kennzahl gleichrangig | nachgeordnet | „braucht 40 Tage" ist Charakterisierung, nicht Fakt |
