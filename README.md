# Korrektur-Tracker

Korrektur-Tracker erfasst Fehler, die beim Lesen von Online-Artikeln auffallen,
schickt eine Meldung per E-Mail an die zuständige Redaktion und hält fest, was
danach passiert: ob überhaupt geantwortet wird und ob der Artikel tatsächlich
korrigiert wird.

## Was das Projekt macht

Wer beim Lesen eines Online-Artikels einen Fehler findet — eine falsche Zahl, ein
sinnentstellendes Zitat, einen vertauschten Namen — kann ihn über ein Formular
melden. Der Korrektur-Tracker übernimmt den Rest: Er baut daraus eine E-Mail an die
Redaktion, vergibt der Meldung ein Referenz-Kürzel und verfolgt anschließend, ob
eine Antwort eintrifft und ob sich die beanstandete Stelle im Artikel ändert.

## Die Frage, die das beantwortet

Das Projekt beantwortet **nicht** die Frage „welches Medium macht die meisten
Fehler" — das lässt sich aus diesen Daten nicht ableiten und wird auch nirgends
behauptet. Wer viel bei einem Verlag meldet, liest dort vermutlich nur viel; die
absolute Anzahl der Meldungen misst das Leseverhalten des Betreibers, nicht die
Fehlerquote einer Redaktion. Die Frage, die tatsächlich beantwortet wird, lautet:
**Was passiert, wenn man einen Fehler meldet?** Antwortet die Redaktion? Wird der
Artikel korrigiert, und wenn ja, bei welchen Fehlerarten wie zuverlässig?

## Wie eine Meldung durchläuft

1. **Erfassen.** Das Formular ist per Teilen-Funktion des Telefons erreichbar (Text
   markieren, teilen, Kurzbefehl öffnet die vorausgefüllte Seite) oder direkt im
   Browser, mit URL und Zitat von Hand eingetragen.
2. **Verankern.** Der Server ruft den Artikel selbst ab und sucht das gemeldete
   Zitat im umgebenden Text. Statt eines reinen Substring-Vergleichs entstehen dabei
   Kontext-Anker — der Text kurz vor und nach der Stelle.
3. **Referenzieren.** Die Meldung bekommt ein kurzes Referenz-Kürzel (z. B. `K7QW3`).
4. **Versenden.** Der Server baut eine E-Mail mit Fundstelle, Zitat und Vorschlag und
   verschickt sie an die Redaktion; das Kürzel steht im Betreff.
5. **Später:** Antworten der Redaktion werden dem passenden Datensatz zugeordnet,
   und der Artikel wird in Abständen erneut abgerufen, um zu prüfen, ob sich die
   verankerte Stelle verändert hat.

## Warum es Kontext-Anker gibt

Ein reiner Textvergleich kann nur sagen „Zitat noch da" oder „Zitat weg" — und
„weg" bedeutet ebenso gut korrigiert wie umgeschrieben, hinter eine Paywall
gewandert oder schlicht offline. Weil der Anker den Text davor und danach kennt,
kann eine spätere Prüfung diese Fälle auseinanderhalten: die Stelle unverändert, die
Stelle wie vorgeschlagen geändert, die Stelle anders geändert, die Stelle
verschwunden bei sonst erreichbarer Seite, oder die Seite selbst nicht erreichbar.
Ein automatischer Befund setzt dabei nie eigenmächtig „korrigiert" — er landet in
einer Warteschlange zur manuellen Bestätigung.

## Zwei harte Regeln

Beide sind **strukturell erzwungen, nicht nur Konvention**:

**Keine Personendaten von Autor:innen, Redakteur:innen oder sonstigen Beteiligten
irgendwo öffentlich erreichbar.** Die öffentlichen Typen (`PublicCorrection`,
`PublicOutlet`) besitzen die entsprechenden Felder gar nicht erst — es wird zur
Laufzeit nichts herausgefiltert, weil nichts davon in den Typ gelangt. Eine
rekursive Prüfung läuft trotzdem über jede öffentliche Antwort und vergleicht sie
mit einer Sperrliste verbotener Feldnamen. Und falls doch jemand ein verbotenes
Feld in einem öffentlichen Typ deklariert, ohne es zu befüllen — ein Fall, den ein
Laufzeittest nicht sieht —, lässt eine Typ-Ebenen-Prüfung die Kompilierung
fehlschlagen.

**Kein Ranking, keine Bestenliste, keine Ampelfarben.** Quoten werden erst ab einer
Mindestfallzahl gezeigt und immer zusammen mit ihrem n, nie isoliert. Tabellen sind
alphabetisch sortiert, nicht nach Wert. Absolute Meldungszahlen sagen etwas über die
Lesegewohnheiten des Betreibers aus, nicht über die Fehlerquote eines Verlags — das
Frontend soll das auch so zeigen.

## Stand der Arbeit

Umgesetzt sind die Phasen **P0–P2**: Monorepo-Grundgerüst, Erfassung und Versand,
Stammdaten (Redaktionen, Fehlerarten), Kennzahlen-Ansichten und der öffentliche
Serializer samt seiner Schutzmechanismen.

Geplant, aber noch nicht gebaut: **P3** Zuordnung eingehender Antworten per IMAP,
**P4** Nacherfassung bereits versendeter Mails aus dem Altbestand, **P5**
regelmäßige Artikel-Prüfungen per Cronjob, **P6** das öffentliche Dashboard, **P7**
eine Methodik-Seite, die erklärt, was die Zahlen nicht aussagen.

Es gibt noch keine Nutzer:innen und noch keinen Produktivbetrieb — das hier ist ein
lauffähiger Codestand für die ersten drei Phasen, kein laufender Dienst.

## Erste Schritte

Voraussetzung: Node.js ≥ 22, pnpm 9. Das Repo ist ein Monorepo aus
`packages/shared` (Zod-Schemas, reine Normalisierungsfunktionen — die einzige
Typquelle) und `packages/api` (Server: Formular, Versand, Admin-Oberfläche,
Datenbank).

```bash
pnpm install   # Abhängigkeiten installieren
pnpm test      # 147 Tests über 24 Dateien
pnpm build     # TypeScript-Build beider Pakete
pnpm dev       # Entwicklungsserver mit Watch-Modus (tsx)
pnpm bundle    # esbuild-Bündel für den Produktionsbetrieb
```

`pnpm build` und `pnpm bundle` kompilieren nur, ohne die Anwendung zu starten. Für
`pnpm dev` braucht der Server dagegen eine vollständige Umgebung — `web.ts`
validiert sie beim Start und bricht sonst sofort ab. `.env.example` im
Repo-Wurzelverzeichnis listet alle Variablen; ohne eigenen Default sind das
`ADMIN_USER`, `ADMIN_PASSWORD`, `PUBLIC_BASE_URL`, `SMTP_HOST`, `SMTP_USER`,
`SMTP_PASSWORD` und `MAIL_FROM` — diese müssen in der Shell gesetzt sein (es gibt
kein automatisches Laden einer `.env`-Datei). `MIGRATIONS_DIR` gehört nicht dazu:
`pnpm dev` setzt es für das eigene Arbeitsverzeichnis bereits korrekt, ein eigener
Wert ist nicht nötig. Beim ersten Start legt die Anwendung ein paar erfundene
Platzhalter-Redaktionen an (z. B. „Beispiel-Zeitung") — keine echten Titel, nur
Testdaten.

## Deployment

Ein GitHub-Actions-Workflow baut und bündelt die Anwendung bei jedem Push auf
`main` und lädt die drei Artefakte — Web-Prozess, Worker-Prozess und Migrationen —
per rsync über SSH auf den Server. Dort startet Phusion Passenger den Web-Prozess,
während ein Cronjob in regelmäßigen Abständen den Worker aufruft. Es gibt keinen
Docker-Container und auf dem Server läuft kein Build-Schritt.

## Wo man mehr liest

- [`docs/superpowers/specs/2026-08-01-korrektur-tracker-design.md`](docs/superpowers/specs/2026-08-01-korrektur-tracker-design.md) —
  das vollständige Design: Datenmodell, Zuordnungslogik, Kennzahlen, Recht und
  Sicherheit.
- [`docs/superpowers/plans/2026-08-01-korrektur-tracker-p0-p2.md`](docs/superpowers/plans/2026-08-01-korrektur-tracker-p0-p2.md) —
  der Umsetzungsplan für P0–P2, Aufgabe für Aufgabe.
