CREATE TABLE
	`multipart_upload` (
		`media_id` text PRIMARY KEY NOT NULL,
		`upload_id` text NOT NULL,
		`fingerprint` text NOT NULL,
		`part_size` integer NOT NULL,
		`completed_parts` text DEFAULT '[]' NOT NULL,
		`updated_at` integer DEFAULT (cast(unixepoch ('subsecond') * 1000 as integer)) NOT NULL,
		FOREIGN KEY (`media_id`) REFERENCES `media` (`id`) ON UPDATE no action ON DELETE cascade
	);

--> statement-breakpoint
CREATE UNIQUE INDEX `multipart_upload_fingerprint` ON `multipart_upload` (`fingerprint`);