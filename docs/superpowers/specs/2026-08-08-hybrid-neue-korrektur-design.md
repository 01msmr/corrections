# Hybrid-Ressort „Neue Korrektur“: Formular für den Betreiber, mailto für Besucher

Datum: 2026-08-08 · Status: entworfen, vom Betreiber freigegeben

## Problem

`/neu` liegt hinter Basic Auth. Besucher, die auf „Neue Korrektur“ klicken,
landen im Passwort-Dialog — eine Sackgasse. Sie sollen stattdessen einen
vorbereiteten Korrekturhinweis mailen können.

## Entscheidungen (Rückfragen vom 7./8.8.2026)

- **Erkennung: Cookie nach Admin-Besuch.** Jede erfolgreich authentifizierte
  Antwort auf `/neu`/`/neu/*`/`/admin`/`/admin/*` setzt `betreiber=1`
  (HttpOnly, SameSite=Lax, Max-Age 1 Jahr, ohne Secure — lokale Entwicklung
  läuft über http). Der Server rendert die Navigation je nach Cookie; kein
  JavaScript, kein Flackern. **Sicherheit hängt nicht daran:** ein gefälschtes
  Cookie führt nur zum Passwort-Dialog des Formulars.
- **Besucherweg: mailto mit Gerüst** an die `MAIL_FROM`-Adresse (zur Laufzeit
  aus der Umgebung, nichts Hartkodiertes): Betreff „Korrekturhinweis“, Body
  spiegelt die Formularfelder (Artikel-URL / Zitat (falsche Stelle) /
  Vorschlag / Anmerkung), CRLF-getrennt, URL-kodiert.
- **Icons davor:** Betreiber → **paper-plane**, Besucher →
  **envelope-open-text**; Font-Awesome-Glyphen (Free, CC BY 4.0) als
  **inline SVG** in `currentColor` — keine Webfonts (Projektregel), keine
  Farbliterale.

## Umsetzungsskizze

1. `auth.ts`: `betreiberErkennung()`-Middleware (setzt das Cookie nach
   `next()`, nur bei Status < 400) und `istBetreiber(c)` (liest es).
2. `app.ts`: Middleware vor `adminAuth` auf dieselben Pfade;
   `setzeHinweisMailto(env.MAIL_FROM)` beim App-Bau.
3. `layout.tsx`: Modulzustand `HINWEIS_MAILTO` (Fallback `"mailto:"`, damit
   direkt gerenderte Views in Tests funktionieren); `Layout` erhält
   `betreiber?: boolean` (Vorgabe false) und rendert den Ressort-Link mit
   passendem Icon und Ziel. Icon-CSS `.navicon` (≈.85em, `margin-right`).
4. Views hinter der Auth (`capture`, `outlets`, `errorTypes`, `backfill`)
   übergeben statisch `betreiber` — wer sie sieht, ist authentifiziert. Die
   öffentlichen Views (`bilanz`, `ueber`) reichen den Wert aus der Route
   durch (`istBetreiber(c)`).
5. Tests (`app.test.ts`): Cookie kommt nur nach erfolgreichem Admin-Zugriff;
   `/bilanz` ohne Cookie zeigt mailto mit Gerüst und kein `/neu`, mit Cookie
   den Formular-Link.

## Nicht Teil dieser Änderung

- Kein öffentliches Erfassungsformular, keine neue Adresse, keine Änderung
  an Auth oder Formular selbst.
