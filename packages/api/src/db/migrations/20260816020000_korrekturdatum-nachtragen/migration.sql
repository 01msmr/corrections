-- Ausgang "korrigiert" ohne Korrekturdatum: die Detailseite liess das Feld
-- frei, damit blieb die manuelle Bestaetigung aus und die Quote zaehlte den
-- Fall nicht -- obwohl der Ausgang gesetzt dastand.
--
-- Nachgetragen wird der Tag der Antwort, dieselbe Quelle wie in der
-- Warteschlange. Wo keine Antwort vermerkt ist, bleibt es leer: dann gibt es
-- keinen Anhalt, und Raten waere schlimmer als eine Luecke.
UPDATE `corrections`
SET `corrected_at` = COALESCE(
      `responded_at`,
      (SELECT r.`received_at` FROM `response_events` r
       WHERE r.`correction_id` = `corrections`.`id` AND r.`kind` = 'reply'
       ORDER BY r.`received_at` DESC, r.`id` DESC LIMIT 1)
    ),
    `verification` = 'manual'
WHERE `outcome` IN ('corrected', 'corrected_other')
  AND `corrected_at` IS NULL
  AND COALESCE(
      `responded_at`,
      (SELECT r2.`received_at` FROM `response_events` r2
       WHERE r2.`correction_id` = `corrections`.`id` AND r2.`kind` = 'reply'
       ORDER BY r2.`received_at` DESC, r2.`id` DESC LIMIT 1)
    ) IS NOT NULL;
