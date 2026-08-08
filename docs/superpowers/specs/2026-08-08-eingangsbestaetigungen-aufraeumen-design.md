# Eingangsbestätigungen stündlich in den Papierkorb

Datum: 2026-08-08 · Status: entworfen, vom Betreiber freigegeben

## Entscheidungen

- **Papierkorb statt Löschen:** Der Lauf verschiebt erkannte
  Eingangsbestätigungen per IMAP in den Papierkorb-Ordner des Kontos; endgültig
  räumt der Provider nach seiner Frist. Nichts ist unwiederbringlich weg.
- **Erkennung zweistufig:**
  1. Mails, die der Postfach-Abgleich bereits als `autoreply` verbucht hat
     (`response_events.kind = 'autoreply'`).
  2. Zusätzlich eine pflegbare Musterliste (Betreff/Text, z. B. SPIEGEL
     „Gerne sichten wir …“) für Bestätigungen ohne Zuordnung.
- **Ort: der bestehende Worker** (`worker.ts`), der ohnehin je Lauf das
  Postfach abgleicht. **Voraussetzung:** der Plesk-Cronjob für den Worker —
  laut Betriebsnotizen noch offen; Einrichtung erfolgt durch den Betreiber
  in Plesk (stündlich).

## Offen bei der Umsetzung zu klären (im Code, nicht neu nachfragen)

- Wie der Abgleich Mails liest (IMAP-Bibliothek, Ordner, UID-Verwaltung) —
  die Verschiebung nutzt dieselbe Verbindung und dieselben UIDs.
- Papierkorb-Ordnername des Hosts (üblich "Trash"/"Papierkorb"; per
  Env-Variable übersteuerbar, Vorgabe "Trash").
- Musterliste als Konstante in shared beginnen (Betreff-Teilstrings,
  case-insensitiv); Verwaltung über die Oberfläche erst bei realem Bedarf.
