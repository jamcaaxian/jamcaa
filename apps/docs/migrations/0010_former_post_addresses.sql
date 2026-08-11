CREATE TABLE `_jamcaa_post_former_address` (
	`path` text PRIMARY KEY NOT NULL,
	`entry_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `post` (`id`) ON UPDATE no action ON DELETE cascade
);

--> statement-breakpoint
CREATE INDEX `_jamcaa_post_former_address_entry_idx` ON `_jamcaa_post_former_address` (`entry_id`);

--> statement-breakpoint
INSERT INTO `setting` (`key`, `value`, `updated_at`)
VALUES ('platform.publicAddressRevision', '0', cast(unixepoch('subsecond') * 1000 as integer))
ON CONFLICT (`key`) DO NOTHING;