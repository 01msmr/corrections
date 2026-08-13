# Bookmarklet und Kurzbefehl

> **Kürzester Weg:** Auf der Seite „In eigener Sache" liegt der
> JavaScript-Code für das Bookmarklet per Knopfdruck in der Zwischenablage,
> und der fertige Kurzbefehl ist dort als iCloud-Link samt QR-Code verknüpft.
> Dieses Dokument erklärt, was dahintersteckt.

Alle Wege öffnen das Erfassungsformular mit vorbefüllter Artikel-URL und
Fundstelle — Betreiber unter `/neu` (hinter der Anmeldung, Versand über den
Server), Besucher unter `/hinweis` (Versand über das eigene Mail-Programm).
Die Vorbefüllung kennt drei Parameterformen:

| Parameter | Inhalt | Verwender |
|---|---|---|
| `url` + `text` | Adresse und Fundstelle, prozentkodiert | Bookmarklet (Desktop-Browser) |
| `url` + `q` | Adresse unverändert, Fundstelle **base64url** | der eine Kurzbefehl (unten) |
| `b` | JSON `{u, t}` als base64url | älterer Safari-Kurzbefehl |

Kommen `b` und `url` zusammen, gilt `b`. Die Adresse kürzt der Server selbst:
kanonische Form, und alles ab dem `?` entfällt — Teilen-Anhängsel wie
`?sara_ref=…` (SPIEGEL-App) muss kein Kurzbefehl abtrennen. Doppelte
Leerzeichen in der Fundstelle (Reste entfernter Verlinkungssymbole) glättet
er ebenfalls. Eine vorbefüllte
Fundstelle ist im Formular gegen versehentliches Tippen gesperrt — grau hinterlegt, der erste
Tipp entsperrt, erst der zweite schreibt.

## Bookmarklet (Desktop)

Text im Artikel markieren, dann das Lesezeichen klicken:

```
javascript:(()=>{const t=String(getSelection()).trim().slice(0,280);location.href='https://korrekturen.msmr.co/neu?url='+encodeURIComponent(location.href)+'&text='+encodeURIComponent(t)})()
```

- Die Auswahl wird auf 280 Zeichen gekürzt (QUOTE_MAX_LENGTH des Formulars).
- Beim ersten Aufruf fragt der Browser einmal nach dem Admin-Zugang; danach
  trägt eine Sitzung 90 Tage.
- Die berichtigte Fassung startet im Formular als Kopie der Fundstelle.
- Prozentkodierung ist hier unproblematisch: im Browser baut JavaScript die
  Adresse, keine Kurzbefehl-Aktion dekodiert sie wieder auf.

## Der eine Kurzbefehl (Safari **und** Apps)

In Apps — SPIEGEL und andere — gibt es kein Safari, also auch kein
„JavaScript auf Webseite ausführen". Dieser Kurzbefehl kommt ohne aus und
funktioniert dadurch überall gleich. Benutzung: **Stelle markieren →
Kopieren → Artikel/Seite teilen → Kurzbefehl antippen.**

Kopfzeile: „Im Share Sheet anzeigen" **an** · Empfangen **Safari-Webseiten
und URLs** · wenn keine Eingabe: **Fortfahren**.

1. **URLs abrufen** aus *Kurzbefehl-Eingabe*
2. **Zwischenablage abrufen**
3. **Text aus Eingabe abrufen** — zieht reinen Text aus dem Rich Text, den
   Apps beim Kopieren ablegen; ohne diesen Schritt reist RTF-Quelltext
4. **Base64 codieren**, Zeilenumbrüche: *Keine*
5. **Text ersetzen**: `+` → `-` (kein regulärer Ausdruck)
6. **Text ersetzen**: `/` → `_` (kein regulärer Ausdruck)
7. **Text ersetzen** (regulärer Ausdruck **an**): `=+$` → *(leer)*
8. **URL öffnen**: `https://korrekturen.msmr.co/neu?url=[URLs]&q=[Aktualisierter Text]`
   — beide Variablen von Hand einsetzen: *URLs* aus Schritt 1,
   *Aktualisierter Text* aus Schritt 7 (den letzten der drei!). Besucher
   nehmen `/hinweis` statt `/neu`.

Warum dieser Aufbau:

- **`q` statt `text`:** `text` reist prozentkodiert, und genau die löst die
  „URL öffnen"-Aktion wieder auf — die Adresse riss am ersten Leerzeichen
  der Auswahl ab.
- **Kein JSON wie in `b`:** Kurzbefehle können Text nicht für JSON escapen;
  ein Anführungszeichen in der Auswahl — in Zitaten die Regel — machte es
  unlesbar.
- **Schritte 5–7** machen aus gewöhnlichem Base64 die URL-sichere Fassung;
  ohne sie zerlegt „URL öffnen" die Adresse an `+` und `/`.
- Kommt dennoch Rich Text an, lässt der Server das Feld lieber leer, statt
  RTF-Quelltext hineinzustellen.

Kommt keine Markierung mit, genügt `?url=` allein: das Formular öffnet sich
mit ausgefüllter Adresse, und „Artikel auf Fehler durchsehen" arbeitet schon
— dafür reicht die Adresse. Im leeren Fundstellen-Feld steht dann ein Knopf,
der die Zwischenablage übernimmt (wo der Browser das Lesen erlaubt).

## Älterer Safari-Kurzbefehl (`?b=`)

**iCloud-Link:** <https://www.icloud.com/shortcuts/84f1ff381c1140b1b07711738869d1b7>
— funktioniert weiterhin, kann aber nur in Safari laufen (er liest die
Markierung per Skript aus der Seite). Zwei Aktionen; in den Details muss
„Im Share Sheet anzeigen" aktiv sein (Eingabetyp **Safari-Webseiten**), und
unter Einstellungen → Apps → Kurzbefehle → Erweitert das Ausführen von
Skripten erlaubt.

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

2. **URL öffnen** — Eingabe: „JavaScript-Ergebnis"

Der alte Kurzbefehl (Wörterbuch `RedNAME`/`RedMAIL`, eigener Mailversand) ist
damit abgelöst; seine Stammdaten leben in `packages/api/src/db/medien.json`
weiter (siehe CLAUDE.md).
