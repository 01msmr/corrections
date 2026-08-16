-- Ein Korrekturdatum kann nur von Hand entstehen: ein automatischer Befund
-- setzt es nie (Spec 8.3). Wo es steht, ist die Bestaetigung also manuell --
-- die Kennzahlen-Views verlangen beides zusammen. Bis hierher setzte
-- setzeAusgang nur das Datum, weshalb die Korrekturquote strukturell auf
-- null stand.
UPDATE `corrections`
SET `verification` = 'manual'
WHERE `corrected_at` IS NOT NULL AND `verification` = 'none';
