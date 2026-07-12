DROP TABLE `article_tags`;--> statement-breakpoint
DROP TABLE `tags`;--> statement-breakpoint
ALTER TABLE `user_settings` ADD `date_format` text DEFAULT 'relative' NOT NULL;