CREATE TABLE `bucket` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`kind` text NOT NULL,
	`binding` text,
	`endpoint` text,
	`region` text,
	`bucket_name` text,
	`access_key_id` text,
	`secret_access_key` text,
	`public_url` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`bucket_id` text NOT NULL,
	`object_key` text NOT NULL,
	`filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`width` integer,
	`height` integer,
	`alt` text,
	`state` text DEFAULT 'pending' NOT NULL,
	`uploader_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`bucket_id`) REFERENCES `bucket`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`uploader_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `storage_rule` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`bucket_id` text NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`is_fallback` integer DEFAULT false NOT NULL,
	`conditions` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`bucket_id`) REFERENCES `bucket`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `storage_rule_one_fallback` ON `storage_rule` (`is_fallback`) WHERE "storage_rule"."is_fallback" = 1;