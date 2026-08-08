CREATE TABLE `pruef_kontingent` (
	`tag` text NOT NULL,
	`kennung` text NOT NULL,
	`anzahl` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `pruef_kontingent_pk` PRIMARY KEY(`tag`, `kennung`)
);
--> statement-breakpoint
CREATE TABLE `pruef_salz` (
	`tag` text PRIMARY KEY,
	`salz` text NOT NULL
);
