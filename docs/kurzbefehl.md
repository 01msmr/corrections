# Kurzbefehl „Korrektur melden"

Zwei Aktionen, danach nie wieder anzufassen — die gesamte Logik liegt im Server.

1. **Details der Safari-Webseite abrufen** → liefert die URL der aktuellen Seite.
2. **URL öffnen** mit:

   `https://korrektur.example.tld/neu?url=[URL]&text=[Kurzbefehl-Eingabe]`

Beide Werte URL-kodieren (Aktion *Text kodieren*).

## Zitat mitgeben

Beim Teilen aus Safari mit **markiertem Text** liefert das Share-Sheet die Auswahl als
Kurzbefehl-Eingabe. Diese in den Parameter `text` legen — dann steht die Fundstelle
wortgleich im Formular. Das ist wichtig: Abgetipptes lässt sich später nicht im Artikel
verankern, und die automatische Korrekturerkennung findet dann nichts.

## Einrichtung

- Kurzbefehle → Details → *Im Teilen-Menü anzeigen* aktivieren
- Als Eingabetypen *URLs* und *Text* zulassen

## Desktop

Kein Kurzbefehl nötig: `/neu` im Browser öffnen, URL und Zitat einfügen. Optional ein
Bookmarklet, das beides vorbefüllt — bewusst optional, weil manche Nachrichtenseiten
`javascript:`-URLs per CSP blockieren.

## Externer Zugang

Ein verteilbarer Kurzbefehl für fremde Nutzer ist vorgesehen, aber nicht Teil von v1 —
Ablauf in Abschnitt 15 der Spec.
