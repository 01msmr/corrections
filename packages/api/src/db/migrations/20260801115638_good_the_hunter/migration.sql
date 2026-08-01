CREATE TABLE `article_checks` (
	`id` text PRIMARY KEY,
	`correction_id` text NOT NULL,
	`checked_at` integer NOT NULL,
	`http_status` integer,
	`quote_state` text NOT NULL,
	`match_confidence` integer,
	`observed_text` text,
	`page_text_hash` text,
	CONSTRAINT `fk_article_checks_correction_id_corrections_id_fk` FOREIGN KEY (`correction_id`) REFERENCES `corrections`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `corrections` (
	`id` text PRIMARY KEY,
	`ref` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`created_at` integer NOT NULL,
	`dispatch_mode` text NOT NULL,
	`article_url` text NOT NULL,
	`article_url_canon` text NOT NULL,
	`outlet_id` text NOT NULL,
	`headline` text,
	`published_at` integer,
	`error_type_id` text NOT NULL,
	`severity` integer NOT NULL,
	`quote_before` text NOT NULL,
	`quote_prefix` text,
	`quote_suffix` text,
	`quote_position_hint` integer,
	`anchor_quality` text DEFAULT 'none' NOT NULL,
	`suggestion_after` text NOT NULL,
	`comment` text,
	`recipient_email` text NOT NULL,
	`message_id` text,
	`dispatch_status` text DEFAULT 'prepared' NOT NULL,
	`sent_at` integer,
	`send_confirmed_by` text,
	`outcome` text DEFAULT 'open' NOT NULL,
	`responded_at` integer,
	`corrected_at` integer,
	`verification` text DEFAULT 'none' NOT NULL,
	`source` text NOT NULL,
	`needs_review` integer DEFAULT false NOT NULL,
	CONSTRAINT `fk_corrections_outlet_id_outlets_id_fk` FOREIGN KEY (`outlet_id`) REFERENCES `outlets`(`id`),
	CONSTRAINT `fk_corrections_error_type_id_error_types_id_fk` FOREIGN KEY (`error_type_id`) REFERENCES `error_types`(`id`)
);
--> statement-breakpoint
CREATE TABLE `error_types` (
	`id` text PRIMARY KEY,
	`key` text NOT NULL,
	`label` text NOT NULL,
	`description` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `imap_cursor` (
	`folder` text PRIMARY KEY,
	`uidvalidity` integer NOT NULL,
	`last_uid` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `outlet_domains` (
	`id` text PRIMARY KEY,
	`outlet_id` text NOT NULL,
	`domain` text NOT NULL,
	CONSTRAINT `fk_outlet_domains_outlet_id_outlets_id_fk` FOREIGN KEY (`outlet_id`) REFERENCES `outlets`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `outlets` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`primary_domain` text NOT NULL,
	`publisher` text,
	`country` text,
	`notes` text,
	`contact_emails` text DEFAULT '[]' NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `response_events` (
	`id` text PRIMARY KEY,
	`correction_id` text NOT NULL,
	`kind` text NOT NULL,
	`received_at` integer NOT NULL,
	`raw_message_id` text,
	`from_addr` text,
	`excerpt` text,
	CONSTRAINT `fk_response_events_correction_id_corrections_id_fk` FOREIGN KEY (`correction_id`) REFERENCES `corrections`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `article_checks_correction_idx` ON `article_checks` (`correction_id`,`checked_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `corrections_ref_unique` ON `corrections` (`ref`);--> statement-breakpoint
CREATE UNIQUE INDEX `corrections_idempotency_unique` ON `corrections` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `corrections_outlet_sent_idx` ON `corrections` (`outlet_id`,`sent_at`);--> statement-breakpoint
CREATE INDEX `corrections_error_type_idx` ON `corrections` (`error_type_id`);--> statement-breakpoint
CREATE INDEX `corrections_dispatch_status_idx` ON `corrections` (`dispatch_status`);--> statement-breakpoint
CREATE INDEX `corrections_canon_idx` ON `corrections` (`article_url_canon`);--> statement-breakpoint
CREATE UNIQUE INDEX `error_types_key_unique` ON `error_types` (`key`);--> statement-breakpoint
CREATE UNIQUE INDEX `outlet_domains_domain_unique` ON `outlet_domains` (`domain`);--> statement-breakpoint
CREATE INDEX `outlet_domains_outlet_idx` ON `outlet_domains` (`outlet_id`);--> statement-breakpoint
CREATE INDEX `response_events_correction_idx` ON `response_events` (`correction_id`);