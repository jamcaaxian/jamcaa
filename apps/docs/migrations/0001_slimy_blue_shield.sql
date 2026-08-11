CREATE TABLE
	`role` (
		`name` text PRIMARY KEY NOT NULL,
		`label` text NOT NULL,
		`description` text,
		`is_system` integer DEFAULT false NOT NULL,
		`created_at` integer DEFAULT (cast(unixepoch ('subsecond') * 1000 as integer)) NOT NULL
	);

--> statement-breakpoint
CREATE TABLE
	`role_capability` (
		`role_name` text NOT NULL,
		`resource` text NOT NULL,
		`action` text NOT NULL,
		PRIMARY KEY (`role_name`, `resource`, `action`),
		FOREIGN KEY (`role_name`) REFERENCES `role` (`name`) ON UPDATE no action ON DELETE cascade
	);

--> statement-breakpoint
ALTER TABLE `session` ADD `impersonated_by` text;

--> statement-breakpoint
ALTER TABLE `user` ADD `role` text;

--> statement-breakpoint
ALTER TABLE `user` ADD `banned` integer DEFAULT false;

--> statement-breakpoint
ALTER TABLE `user` ADD `ban_reason` text;

--> statement-breakpoint
ALTER TABLE `user` ADD `ban_expires` integer;