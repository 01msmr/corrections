# Bookmarklet und Kurzbefehl

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

Kurzbefehl-Details: „Im Share Sheet anzeigen“, Eingabetyp **Safari-Webseiten**.

Nur zwei Aktionen — die komplette URL entsteht im JavaScript, damit keine
Shortcuts-Kodierung dazwischenfunkt (Zeilenumbrüche und Sonderzeichen in der
Auswahl zerrissen sonst die Query):

1. **JavaScript auf Webseite ausführen**

   ```javascript
   const auswahl = String(getSelection()).trim().slice(0, 200);
   completion(
     "https://korrekturen.msmr.co/neu?url=" +
       encodeURIComponent(location.href) +
       "&text=" +
       encodeURIComponent(auswahl),
   );
   ```

2. **URL öffnen** — Eingabe: „JavaScript-Ergebnis“

Der alte Kurzbefehl (Wörterbuch `RedNAME`/`RedMAIL`, eigener Mailversand) ist
damit abgelöst; seine Stammdaten leben in `packages/api/src/db/medien.json`
weiter (siehe CLAUDE.md).
