CREATE VIRTUAL TABLE `articles_fts` USING fts5(
  title,
  summary,
  content,
  content='articles',
  content_rowid='id',
  tokenize='porter unicode61'
);--> statement-breakpoint
INSERT INTO `articles_fts`(`rowid`, `title`, `summary`, `content`)
  SELECT `id`, `title`, `summary`, `content` FROM `articles`;--> statement-breakpoint
CREATE TRIGGER `articles_ai_fts` AFTER INSERT ON `articles` BEGIN
  INSERT INTO `articles_fts`(`rowid`, `title`, `summary`, `content`)
  VALUES (new.`id`, new.`title`, new.`summary`, new.`content`);
END;--> statement-breakpoint
CREATE TRIGGER `articles_ad_fts` AFTER DELETE ON `articles` BEGIN
  INSERT INTO `articles_fts`(`articles_fts`, `rowid`, `title`, `summary`, `content`)
  VALUES ('delete', old.`id`, old.`title`, old.`summary`, old.`content`);
END;--> statement-breakpoint
CREATE TRIGGER `articles_au_fts` AFTER UPDATE ON `articles` BEGIN
  INSERT INTO `articles_fts`(`articles_fts`, `rowid`, `title`, `summary`, `content`)
  VALUES ('delete', old.`id`, old.`title`, old.`summary`, old.`content`);
  INSERT INTO `articles_fts`(`rowid`, `title`, `summary`, `content`)
  VALUES (new.`id`, new.`title`, new.`summary`, new.`content`);
END;