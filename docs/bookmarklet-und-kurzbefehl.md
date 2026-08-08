# Bookmarklet und Kurzbefehl

> **Kürzester Weg:** Auf der Seite „In eigener Sache" stehen zwei Knöpfe, die den
> jeweiligen JavaScript-Code fertig in die Zwischenablage legen — gebaut aus der
> gerade aufgerufenen Adresse. Dieses Dokument erklärt, was dahintersteckt.

Beide Wege öffnen das Erfassungsformular mit vorbefüllter Artikel-URL und
Fundstelle: `GET /neu?url=…&text=…` (Betreiber, hinter Basic Auth). Für den
öffentlichen Besucherweg gilt dasselbe Muster mit `/hinweis` statt `/neu`.

## Bookmarklet (Desktop)

Text im Artikel markieren, dann das Lesezeichen klicken:

```
javascript:(()=>{const t=String(getSelection()).trim().slice(0,200);location.href='https://korrekturen.msmr.co/neu?url='+encodeURIComponent(location.href)+'&text='+encodeURIComponent(t)})()
```

- Die Auswahl wird auf 200 Zeichen gekürzt (QUOTE_MAX_LENGTH des Formulars).
- Beim ersten Aufruf fragt der Browser einmal nach dem Admin-Zugang.
- Die berichtigte Fassung startet im Formular als Kopie der Fundstelle.

## Kurzbefehl (iOS/iPadOS, Teilen-Menü in Safari)

**Fertig zum Übernehmen:** <https://www.icloud.com/shortcuts/84f1ff381c1140b1b07711738869d1b7>
— damit entfallen die Schritte unten. Sie stehen hier, damit nachvollziehbar
bleibt, was der Kurzbefehl tut, und damit er sich mit eigener Adresse nachbauen
lässt.

Kurzbefehl-Details: „Im Share Sheet anzeigen“, Eingabetyp **Safari-Webseiten**.

Nur zwei Aktionen — die komplette URL entsteht im JavaScript, damit keine
Shortcuts-Kodierung dazwischenfunkt (Zeilenumbrüche und Sonderzeichen in der
Auswahl zerrissen sonst die Query):

Wichtig: Die „URL öffnen“-Aktion der Kurzbefehle löst Prozent-Kodierung
wieder auf und reißt die Query am ersten Leerzeichen ab. Deshalb reist die
Vorbefüllung als **base64url** im Parameter `?b=` — dessen Alphabet
(`A–Z a–z 0–9 - _`) übersteht jede Dekodier-Runde.

1. **JavaScript auf Webseite ausführen**

   ```javascript
   const auswahl = String(getSelection()).trim().slice(0, 200);
   const nutzlast = JSON.stringify({ u: location.href, t: auswahl });
   const b64 = btoa(unescape(encodeURIComponent(nutzlast)))
     .replace(/\+/g, "-")
     .replace(/\//g, "_")
     .replace(/=+$/, "");
   completion("https://korrekturen.msmr.co/neu?b=" + b64);
   ```

2. **URL öffnen** — Eingabe: „JavaScript-Ergebnis“

Der alte Kurzbefehl (Wörterbuch `RedNAME`/`RedMAIL`, eigener Mailversand) ist
damit abgelöst; seine Stammdaten leben in `packages/api/src/db/medien.json`
weiter (siehe CLAUDE.md).
