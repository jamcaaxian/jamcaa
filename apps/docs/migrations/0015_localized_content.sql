DROP INDEX `page_address`;

--> statement-breakpoint
ALTER TABLE `page` ADD `locale` text DEFAULT 'und' NOT NULL;

--> statement-breakpoint
ALTER TABLE `page` ADD `translation_id` text;

--> statement-breakpoint
UPDATE `page`
SET
	`locale` = 'en-US',
	`translation_id` = `id`;

--> statement-breakpoint
CREATE UNIQUE INDEX `page_locale_address_key` ON `page` (`locale`, `address`);

--> statement-breakpoint
CREATE UNIQUE INDEX `page_translation_locale_key` ON `page` (`translation_id`, `locale`);

--> statement-breakpoint
DROP INDEX `post_slug_key`;

--> statement-breakpoint
ALTER TABLE `post` ADD `locale` text DEFAULT 'und' NOT NULL;

--> statement-breakpoint
ALTER TABLE `post` ADD `translation_id` text;

--> statement-breakpoint
UPDATE `post`
SET
	`locale` = 'en-US',
	`translation_id` = `id`;

--> statement-breakpoint
CREATE UNIQUE INDEX `post_locale_slug_key` ON `post` (`locale`, `slug`);

--> statement-breakpoint
CREATE UNIQUE INDEX `post_translation_locale_key` ON `post` (`translation_id`, `locale`);

--> statement-breakpoint
PRAGMA foreign_keys = OFF;

--> statement-breakpoint
CREATE TABLE
	`__new__jamcaa_post_former_address` (
		`locale` text DEFAULT 'und' NOT NULL,
		`path` text NOT NULL,
		`entry_id` text NOT NULL,
		`created_at` integer DEFAULT (cast(unixepoch ('subsecond') * 1000 as integer)) NOT NULL,
		PRIMARY KEY (`locale`, `path`),
		FOREIGN KEY (`entry_id`) REFERENCES `post` (`id`) ON UPDATE no action ON DELETE cascade
	);

--> statement-breakpoint
INSERT INTO
	`__new__jamcaa_post_former_address` ("locale", "path", "entry_id", "created_at")
SELECT
	'en-US',
	"path",
	"entry_id",
	"created_at"
FROM
	`_jamcaa_post_former_address`;

--> statement-breakpoint
DROP TABLE `_jamcaa_post_former_address`;

--> statement-breakpoint
ALTER TABLE `__new__jamcaa_post_former_address`
RENAME TO `_jamcaa_post_former_address`;

--> statement-breakpoint
PRAGMA foreign_keys = ON;

--> statement-breakpoint
CREATE INDEX `_jamcaa_post_former_address_entry_idx` ON `_jamcaa_post_former_address` (`entry_id`);