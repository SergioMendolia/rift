import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer().primaryKey({ autoIncrement: true }),
  email: text().notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
});

export const userSettings = sqliteTable("user_settings", {
  id: integer().primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  theme: text().notNull().default("light"),
  markReadOnOpen: integer("mark_read_on_open", { mode: "boolean" }).notNull().default(true),
  dateFormat: text("date_format").notNull().default("relative"),
});

export const folders = sqliteTable("folders", {
  id: integer().primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text().notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const feeds = sqliteTable("feeds", {
  id: integer().primaryKey({ autoIncrement: true }),
  url: text().notNull().unique(),
  title: text().notNull(),
  feedUrl: text("feed_url").notNull(),
  siteUrl: text("site_url"),
  faviconUrl: text("favicon_url"),
  lastFetchedAt: text("last_fetched_at"),
  lastError: text("last_error"),
  etag: text(),
  lastModified: text("last_modified"),
});

export const subscriptions = sqliteTable("subscriptions", {
  id: integer().primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  feedId: integer("feed_id")
    .notNull()
    .references(() => feeds.id, { onDelete: "cascade" }),
  folderId: integer("folder_id").references(() => folders.id, { onDelete: "set null" }),
  displayName: text("display_name"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const articles = sqliteTable("articles", {
  id: integer().primaryKey({ autoIncrement: true }),
  feedId: integer("feed_id")
    .notNull()
    .references(() => feeds.id, { onDelete: "cascade" }),
  guid: text().notNull(),
  title: text().notNull(),
  link: text().notNull(),
  author: text(),
  summary: text(),
  content: text(),
  publishedAt: text("published_at").notNull(),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
});

export const userArticles = sqliteTable("user_articles", {
  id: integer().primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  articleId: integer("article_id")
    .notNull()
    .references(() => articles.id, { onDelete: "cascade" }),
  read: integer({ mode: "boolean" }).notNull().default(false),
  saved: integer({ mode: "boolean" }).notNull().default(false),
  readAt: text("read_at"),
  savedAt: text("saved_at"),
});