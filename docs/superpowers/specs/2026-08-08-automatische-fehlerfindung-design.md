# Automatische Fehlerfindung über LanguageTool

Datum: 2026-08-08 · Status: entworfen, vom Betreiber freigegeben

## Warum nicht selbst gebaut

Erwogen und **verworfen**: eigener Regelkatalog plus Hunspell-Wörterbuch. Die
Messung entschied:

- `nspell` wendet die Affixregeln des deutschen Wörterbuchs falsch an — es
  hält `gehen`, `empfehlen`, `löschen` für Fehler. Unbrauchbar.
- `hunspell-spellchecker` rechnet korrekt, belegt aber **+304 MB** im
  Node-Prozess (gemessen). Das Speicherlimit unter Passenger auf dem
  netcup-Shared-Hosting ließ sich nicht ermitteln; das Risiko bleibt.
- Beide kennen **keine Komposita**: `Mietwagen`, `Kontaktdaten`,
  `Bundesnetzagentur` gelten als unbekannt — in Nachrichtendeutsch eine Flut
  von Fehlalarmen.
- LanguageTools eingebautes `suggest()` schlug für das korrekte `Mietwagen`
  „Mittragen" vor und übersah den eingebauten Dreher ganz.

Ein Testabruf gegen LanguageTool fand dagegen alle eingebauten Fehler,
darunter den **Dreher im Kompositum** (`Mietwgaen` → `Mietwagen`) und das
fehlende Komma vor dem Nebensatz — und meldete `Kontaktdaten`, `Bluetooth`,
`Mietwagen` korrekt **nicht**. Damit entfällt der eigene Regelkatalog; es
bleibt die Zuordnung der LanguageTool-Regeln auf unsere Kategorien.

## Entscheidungen

- **Dienst:** LanguageTool, Adresse in `LANGUAGETOOL_URL` (Vorgabe
  `https://api.languagetool.org/v2/check`), Sprache `de-DE`. Der Umzug auf
  eine eigene Instanz (LGPL 2.1, Docker) ist damit ein Eintrag in Plesk,
  keine Codeänderung — netcup selbst kann sie nicht hosten (kein Java).
- **Filter:** `misspelling`, `grammar`, `typographical`, `whitespace` und die
  Kommasetzungs-Kategorie sind Kandidaten; `issueType: style` steht in einem
  zurückhaltenden zweiten Block darunter („weiche" Befunde).
- **Auflage erfüllt:** sichtbarer Link auf languagetool.org ohne
  `rel="nofollow"` am Prüfblock, wie die Nutzungsbedingungen es verlangen.
- **Ausfall ist kein Fehler:** Ist LanguageTool nicht erreichbar, langsam
  oder liefert Unlesbares, erscheint das Formular unverändert ohne
  Vorschläge. Nie eine Fehlerseite.

## Kontingent (Entscheidung vom 8.8.2026)

Die Bedingungen der öffentlichen API untersagen automatisierte Anfragen. Der
Betreiber löst sie von Hand aus; für den öffentlichen Weg `/hinweis` gilt ein
Kontingent, damit wir nicht zum Bot werden:

| Wer | Kontingent |
|---|---|
| Betreiber (Cookie `betreiber` + Auth auf `/neu`) | ohne Begrenzung |
| Besucher | **2 Prüfungen pro Tag**; sobald **20 Prüfungen am Tag** insgesamt gelaufen sind: **1 pro Tag** |

**„Pro Person" ohne gespeicherte IP:** gezählt wird ein
`sha256(IP + Tagessalz)`, gekürzt — der Tagessalz wechselt täglich und wird
nicht aufbewahrt, die Zeilen des Vortags werden beim ersten Schreiben des
neuen Tages gelöscht. Damit ist die Zählung nach Tagesende nicht mehr auf
eine Person zurückführbar (§2.1: keine personenbezogenen Daten).

## Zuordnung (die eigentliche Katalogarbeit)

Dokumentierte Tabelle LanguageTool-Regel → unsere Fehlerart. Grundlage sind
`rule.id`, `rule.category.id` und `rule.issueType`:

| LanguageTool | unsere Fehlerart |
|---|---|
| `category.id: HILFESTELLUNG_KOMMASETZUNG`, `KOMMA_*` | Satzzeichen fehlen / zu viel (je nach Vorschlag) |
| `GERMAN_SPELLER_RULE` mit Nachbartausch-Beziehung | ein Buchstabendreher |
| `GERMAN_SPELLER_RULE` sonst | Zeichen fehlen / zu viel / falsche Wortwahl (aus dem Zeichen-Diff) |
| `issueType: whitespace`, `WHITESPACE_RULE` | Leerzeichen fehlen / zu viel |
| `issueType: typographical` | Zeichen zu viel |
| `KOMP_WIE`, `issueType: grammar` mit Wortersetzung | falsche Wortwahl |
| `issueType: style` | **kein Kandidat** — zweiter Block, nicht vorbelegt |

Welche Fehlerart es genau ist, entscheidet am Ende der bestehende
`detectErrorTypeKey(falsch, richtig)` aus `shared` — die Tabelle liefert nur
die Vorauswahl, wo die Erkennung nichts hergibt.

## Markierung im Text

LanguageTool liefert je Treffer `sentence` sowie `offset`/`length` — damit
steht der Satzkontext samt Fundstelle ohne eigene Suche fest.

- **Formular:** Kandidatenliste zeigt den Satz mit karmin hervorgehobener
  Fundstelle; ein Klick füllt „Falsch ist"/„Richtig wäre" (und die Kategorie,
  wenn die Erkennung sie liefert).
- **Mail:** unter dem Zitat steht der Satz, in dem die Stelle steckt, mit
  derselben Hervorhebung — die Redaktion findet die Stelle im Artikel, statt
  ein isoliertes Zitat suchen zu müssen.

## Nicht Teil dieser Änderung

- Kein eigener Regelkatalog, kein Wörterbuch im Repo.
- Keine Prüfung ohne Zutun: sie läuft nur auf Klick, nie automatisch beim
  Tippen.
- Keine Speicherung der Befunde in der Datenbank — sie sind Vorschläge, kein
  Datenbestand.
