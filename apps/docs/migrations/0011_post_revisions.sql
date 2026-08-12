CREATE TABLE `_jamcaa_post_revision` (
	`ordinal` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`entry_id` text NOT NULL,
	`format_version` integer DEFAULT 1 NOT NULL,
	`snapshot` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "_jamcaa_post_revision_snapshot_json" CHECK(json_valid("_jamcaa_post_revision"."snapshot"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `_jamcaa_post_revision_id_key` ON `_jamcaa_post_revision` (`id`);--> statement-breakpoint
CREATE INDEX `_jamcaa_post_revision_entry_order_idx` ON `_jamcaa_post_revision` (`entry_id`,`ordinal`);