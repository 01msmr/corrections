-- Korrigiert wurde, als die Redaktion es schrieb -- nicht, als unsere
-- Pruefung es bemerkte. Der Abgleich hatte das Pruefdatum eingetragen; das
-- liegt Tage spaeter und verzerrt jede Dauer, die daraus gerechnet wird.
--
-- Angefasst wird nur, was diese Handschrift traegt: manuell bestaetigt UND
-- das Korrekturdatum genau auf dem juengsten Pruefdatum. Von Hand im Detail
-- gesetzte Daten bleiben damit unberuehrt.
UPDATE `corrections`
SET `corrected_at` = (
  SELECT r.`received_at` FROM `response_events` r
  WHERE r.`correction_id` = `corrections`.`id` AND r.`kind` = 'reply'
  ORDER BY r.`received_at` DESC, r.`id` DESC LIMIT 1
)
WHERE `verification` = 'manual'
  AND `corrected_at` = (
    SELECT a.`checked_at` FROM `article_checks` a
    WHERE a.`correction_id` = `corrections`.`id`
    ORDER BY a.`checked_at` DESC, a.`id` DESC LIMIT 1
  )
  AND EXISTS (
    SELECT 1 FROM `response_events` r2
    WHERE r2.`correction_id` = `corrections`.`id` AND r2.`kind` = 'reply'
  );
