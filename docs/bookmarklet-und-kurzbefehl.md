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
javascript:(()=>{const t=String(getSelection()).trim().slice(0,280);location.href='https://korrekturen.msmr.co/neu?url='+encodeURIComponent(location.href)+'&text='+encodeURIComponent(t)})()
```

- Die Auswahl wird auf 280 Zeichen gekürzt (QUOTE_MAX_LENGTH des Formulars).
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
   const auswahl = String(getSelection()).trim().slice(0, 280);
   const nutzlast = JSON.stringify({ u: location.href, t: auswahl });
   const b64 = btoa(unescape(encodeURIComponent(nutzlast)))
     .replace(/\+/g, "-")
     .replace(/\//g, "_")
     .replace(/=+$/, "");
   completion("https://korrekturen.msmr.co/neu?b=" + b64);
   ```

2. **URL öffnen** — Eingabe: „JavaScript-Ergebnis“

## Aus einer Nachrichten-App (SPIEGEL und andere)

Dort gibt es kein Safari, also auch kein „JavaScript auf Webseite ausführen“.
Die Vorbefüllung kommt deshalb über zwei getrennte Parameter:

| Parameter | Inhalt |
|---|---|
| `url` | Adresse des Artikels — derselbe Parameter wie beim Bookmarklet |
| `q` | die markierte Stelle, **base64url** |

Warum `q` und nicht das vorhandene `text`: `text` reist prozentkodiert, und
genau die löst die „URL öffnen“-Aktion wieder auf — die Adresse reißt dann am
ersten Leerzeichen der Auswahl ab. Und warum kein JSON in `b` wie in Safari:
Kurzbefehle können Text nicht für JSON escapen; ein Anführungszeichen in der
Auswahl — in Zitaten die Regel — machte es unlesbar. Ein eigenes Feld hat
beide Probleme nicht.

**Kurzbefehl (Markierung teilen).** Eingabetyp *Text und URLs*, „Im Share
Sheet anzeigen“ an:

1. **Text codieren** → Base64, Eingabe: Teilen-Eingabe (die Markierung)
2. **Text ersetzen**: `+` → `-`
3. **Text ersetzen**: `/` → `_`
4. **Text ersetzen** (regulärer Ausdruck): `=+$` → *(leer)*
5. **URL öffnen**: `https://korrekturen.msmr.co/hinweis?url=[Artikeladresse]&q=[Ergebnis]`

Die Schritte 2–4 machen aus gewöhnlichem Base64 die URL-sichere Fassung;
ohne sie zerlegt die „URL öffnen“-Aktion die Adresse an `+` und `/`.

Kommt keine Markierung mit, genügt `?url=` allein: das Formular öffnet sich mit
ausgefüllter Adresse, und „Artikel auf Fehler durchsehen“ arbeitet schon —
dafür reicht die Adresse. Im leeren Fundstellen-Feld steht dann zusätzlich
ein Knopf, der die Zwischenablage übernimmt.

Kommen `b` und `url` zusammen, gilt `b`.

Der alte Kurzbefehl (Wörterbuch `RedNAME`/`RedMAIL`, eigener Mailversand) ist
damit abgelöst; seine Stammdaten leben in `packages/api/src/db/medien.json`
weiter (siehe CLAUDE.md).
