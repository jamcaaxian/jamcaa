CREATE TABLE `category` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`parent_id` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `category_slug_key` ON `category` (`slug`);--> statement-breakpoint
CREATE TABLE `tag` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tag_slug_key` ON `tag` (`slug`);--> statement-breakpoint
INSERT INTO `category` (`id`, `name`, `slug`)
VALUES ('jamcaa-default-category', 'General', 'general');--> statement-breakpoint
ALTER TABLE `post` ADD `category_id` text REFERENCES category(id);--> statement-breakpoint
UPDATE `post`
SET `category_id` = 'jamcaa-default-category'
WHERE `category_id` IS NULL;--> statement-breakpoint
CREATE TABLE `__new_post` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`author_id` text NOT NULL,
	`category_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`published_at` integer,
	`title` text NOT NULL,
	`excerpt` text,
	`body` text NOT NULL,
	FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `category`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
INSERT INTO `__new_post` (`id`, `slug`, `status`, `author_id`, `category_id`, `created_at`, `updated_at`, `published_at`, `title`, `excerpt`, `body`)
SELECT `id`, `slug`, `status`, `author_id`, `category_id`, `created_at`, `updated_at`, `published_at`, `title`, `excerpt`, `body`
FROM `post`;--> statement-breakpoint
DROP TABLE `post`;--> statement-breakpoint
ALTER TABLE `__new_post` RENAME TO `post`;--> statement-breakpoint
CREATE UNIQUE INDEX `post_slug_key` ON `post` (`slug`);--> statement-breakpoint
CREATE TABLE `_jamcaa_post_tag` (
	`entry_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`entry_id`, `tag_id`),
	FOREIGN KEY (`tag_id`) REFERENCES `tag`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`entry_id`) REFERENCES `post`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `_jamcaa_post_tag_term_idx` ON `_jamcaa_post_tag` (`tag_id`,`entry_id`);