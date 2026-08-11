CREATE TABLE
	`setting` (
		`key` text PRIMARY KEY NOT NULL,
		`value` text NOT NULL,
		`updated_at` integer DEFAULT (cast(unixepoch ('subsecond') * 1000 as integer)) NOT NULL
	);