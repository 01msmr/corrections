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
   Browser, mit URL und Zitat von Hand eingetragen. Überschrift, Fehlerart und —
   bei zählbaren Arten — die Anzahl samt konkretem Satzzeichen erkennt der Server
   automatisch und benennt sie sprachlich korrekt („zwei Zeichen fehlen",
   „ein Komma zu viel"); jede Automatik ist von Hand übersteuerbar.
2. **Verankern.** Der Server ruft den Artikel selbst ab und sucht das gemeldete
   Zitat im umgebenden Text. Statt eines reinen Substring-Vergleichs entstehen dabei
   Kontext-Anker — der Text kurz vor und nach der Stelle.
3. **Referenzieren.** Die Meldung bekommt ein kurzes Referenz-Kürzel (z. B. `K7QW3`).
4. **Versenden.** Der Server baut eine E-Mail mit Fundstelle, Zitat und Vorschlag und
   verschickt sie an die Redaktion; das Kürzel steht im Betreff.
5. **Später:** Antworten der Redaktion werden dem passenden Datensatz zugeordnet,
   und der Artikel wird in Abständen erneut abgerufen, um zu prüfen, ob sich die
   verankerte Stelle verändert hat.

## Erfassen per Lesezeichen oder Kurzbefehl

Beide Wege öffnen das Formular mit Artikeladresse und markierter Fundstelle
vorausgefüllt. **Den fertigen JavaScript-Code gibt es auf der Seite „In eigener
Sache" per Knopfdruck in die Zwischenablage** — er wird dort aus der gerade
aufgerufenen Adresse gebaut und zeigt für Angemeldete auf `/neu`, für alle
anderen auf `/hinweis`.

Die Vorbefüllung reist als **base64url im Parameter `b`** (JSON `{u, t}`), nicht
als `?url=…&text=…`. Grund: Die Aktion „URL öffnen" der iOS-Kurzbefehle löst
Prozent-Kodierung wieder auf und schneidet die Adresse dann am ersten Leerzeichen
der Auswahl ab — die Fundstelle kam als einzelnes Wort an. Das Alphabet von
base64url (`A–Z a–z 0–9 - _`) übersteht diese Runde unbeschadet. Die alten
Parameter `url` und `text` werden weiterhin gelesen.

**Lesezeichen (Desktop).** Text im Artikel markieren, Lesezeichen anklicken.
Manche Browser öffnen Lesezeichen in einem neuen, leeren Tab — dort hat das
Skript keinen Artikel mehr vor sich und überträgt nichts. In Vivaldi hilft ein
Spitzname (etwa `kor`), den man in der Adresszeile eintippt; alternativ die
Einstellung „Lesezeichen in neuem Tab öffnen" abschalten.

**Kurzbefehl (iOS).** Fertig zum Übernehmen: <https://www.icloud.com/shortcuts/84f1ff381c1140b1b07711738869d1b7>.
Wer ihn selbst bauen will — zwei Aktionen genügen: *JavaScript auf Webseite ausführen*
(mit dem kopierten Code) und *URL öffnen* mit dem JavaScript-Ergebnis. In den
Kurzbefehl-Details muss „Im Share Sheet anzeigen" aktiv sein, und unter
Einstellungen → Apps → Kurzbefehle → Erweitert das Ausführen von Skripten
erlaubt. Ohne beides bleibt die Empfangen-Aktion auf „von Nirgendwo" stehen
bzw. die Skriptaktion wird abgelehnt.

Ausführlicher, mit dem Code zum Nachlesen: [`docs/bookmarklet-und-kurzbefehl.md`](docs/bookmarklet-und-kurzbefehl.md).

## Automatische Fehlersuche

Im Formular durchsucht ein Knopf den ganzen Artikel nach Rechtschreib-,
Grammatik- und Zeichensetzungsfehlern; jeder Treffer zeigt die Änderung und den
Satz, in dem sie steckt, mit markierter Fundstelle. Ein Klick übernimmt ihn in
die Felder. Geprüft wird über **[LanguageTool](https://languagetool.org)**;
die Adresse steht in `LANGUAGETOOL_URL` (Vorgabe: die öffentliche API), sodass
eine eigene Instanz später ein Konfigurationseintrag ist und keine Codeänderung.

Zwei Dinge sind bewusst so gebaut:

- **Nur auf Klick, nie beim Tippen** — die öffentliche API untersagt
  automatisierte Anfragen. Für den öffentlichen Weg `/hinweis` gilt zusätzlich
  ein Tageskontingent (zwei Prüfungen je Person, ab 20 am Tag nur noch eine).
  Gezählt wird ein Hash aus Tagessalz und IP; die IP wird nie gespeichert, und
  mit dem Salz verschwindet am Tagesende die Rückrechenbarkeit.
- **Ein Ausfall ist kein Fehler** — ist der Dienst nicht erreichbar, arbeitet
  das Formular unverändert weiter, nur ohne Vorschläge.

Warum kein eigenes Wörterbuch: gemessen belegte ein deutsches Hunspell-Wörterbuch
im Arbeitsspeicher 87–304 MB, kannte keine Komposita (`Kontaktdaten`,
`Mietwagen` galten als unbekannt) und erkannte den eingebauten Buchstabendreher
nicht. Die Begründung samt Messwerten steht in
[`docs/superpowers/specs/2026-08-08-automatische-fehlerfindung-design.md`](docs/superpowers/specs/2026-08-08-automatische-fehlerfindung-design.md).

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
Stammdaten (Medien, Fehlerarten), Kennzahlen-Ansichten und der öffentliche
Serializer samt seiner Schutzmechanismen. Die Anwendung läuft produktiv auf einem
Shared-Webhosting (Plesk/Passenger) und wird bei jedem Push automatisch deployt.

Von **P4** (Nacherfassung des Altbestands) stehen die Werkzeuge: Korpus-Export,
Vorlagen-Parser und Review-Queue samt Import (siehe unten). Geplant, aber noch
nicht gebaut: **P3** Zuordnung eingehender Antworten per IMAP, **P5** regelmäßige
Artikel-Prüfungen per Cronjob, **P6** das öffentliche Dashboard („Bilanz"), **P7**
eine Methodik-Seite, die erklärt, was die Zahlen nicht aussagen.

## Altbestand nacherfassen (Backfill)

Über 1300 Korrekturmails aus den Jahren vor diesem Projekt stammen aus einem
iOS-Kurzbefehl mit fester Vorlage. Drei Einmalwerkzeuge im Paket
`packages/backfill` holen sie in die Datenbank — getrennt vom Server-Laufzeitpfad,
gemeinsam mit dem Dauerbetrieb haben sie nur `packages/shared`:

```bash
pnpm backfill:korpus   # Gesendet-Ordner einmalig read-only als .eml nach fixtures.local/
pnpm backfill:review   # Review-Queue auf :3223 — Enter übernehmen, E bearbeiten, X verwerfen
pnpm backfill:import   # übernommene Entscheidungen als source='backfill' in die Datenbank
```

Korpus und Review bleiben lokal: Die `.eml`-Dateien enthalten echte Korrespondenz und
verlassen den Rechner nicht. Für die Produktion wandert nur die Entscheidungsdatei über
eine Adminseite auf den Server, wo derselbe Import läuft — er ergänzt fehlende
Datensätze und rührt vorhandene nicht an, sodass parallel erfasste Meldungen erhalten
bleiben.

Der Parser liest die Vorlage konservativ (85 % sicher, Rest zur Prüfung oder
verworfen — geraten wird nie), Entscheidungen landen als JSONL neben dem Korpus,
und der Import ist über die Message-ID idempotent. `fixtures.local/` ist vom
Repository ausgeschlossen; die Testfixtures im Code sind synthetisch.

**Die Review lässt sich jederzeit unterbrechen und fortsetzen.** Jede Entscheidung
wird sofort an `fixtures.local/review-entscheidungen.jsonl` angehängt — nichts liegt
nur im Browser oder im Arbeitsspeicher. Beim nächsten Start liest die Queue diese
Datei und überspringt alles bereits Entschiedene; ist der Server beendet, genügt ein
erneutes `pnpm backfill:review` und der Aufruf von http://localhost:3223.

## Erste Schritte

Voraussetzung: Node.js ≥ 22, pnpm 9. Das Repo ist ein Monorepo aus
`packages/shared` (Zod-Schemas, reine Normalisierungs-, Erkennungs- und
Benennungsfunktionen — die einzige Typquelle), `packages/api` (Server: Formular,
Versand, Admin-Oberfläche, Datenbank) und `packages/backfill` (Einmalwerkzeuge
für den Altbestand).

```bash
pnpm install   # Abhängigkeiten installieren
pnpm test      # 242 Tests über 31 Dateien
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
per tar über SSH auf den Server (rsync steht in der Chroot nicht zur Verfügung). Dort startet Phusion Passenger den Web-Prozess,
während ein Cronjob in regelmäßigen Abständen den Worker aufruft. Es gibt keinen
Docker-Container und auf dem Server läuft kein Build-Schritt.

## Wo man mehr liest

- [`docs/superpowers/specs/2026-08-01-korrektur-tracker-design.md`](docs/superpowers/specs/2026-08-01-korrektur-tracker-design.md) —
  das vollständige Design: Datenmodell, Zuordnungslogik, Kennzahlen, Recht und
  Sicherheit.
- [`docs/superpowers/plans/2026-08-01-korrektur-tracker-p0-p2.md`](docs/superpowers/plans/2026-08-01-korrektur-tracker-p0-p2.md) —
  der Umsetzungsplan für P0–P2, Aufgabe für Aufgabe.
