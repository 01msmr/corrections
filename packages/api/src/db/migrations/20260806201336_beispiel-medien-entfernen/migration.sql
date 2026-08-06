-- Die drei Platzhalter aus dem fruehen seed() (vor medien.json) verschwinden
-- aus Bestandsdatenbanken -- aber nur, wenn keine Meldung auf sie zeigt.
-- Zeigt doch eine darauf, bleibt das Medium samt Domain unangetastet.
DELETE FROM `outlet_domains` WHERE `outlet_id` IN (
  SELECT `id` FROM `outlets`
  WHERE `primary_domain` IN ('beispiel-zeitung.de', 'muster-magazin.de', 'probe-anzeiger.de')
    AND `id` NOT IN (SELECT `outlet_id` FROM `corrections`)
);
--> statement-breakpoint
DELETE FROM `outlets`
WHERE `primary_domain` IN ('beispiel-zeitung.de', 'muster-magazin.de', 'probe-anzeiger.de')
  AND `id` NOT IN (SELECT `outlet_id` FROM `corrections`);
