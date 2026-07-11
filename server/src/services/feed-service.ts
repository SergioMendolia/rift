import Parser from "rss-parser";
import { eq, and } from "drizzle-orm";
import { db, schema } from "../db/connection";
import type { FeedDTO } from "@rift/shared";

const parser = new Parser({
  timeout: 10000,
  headers: {
    "User-Agent": "Rift RSS Reader (https://github.com/rift)",
  },
});

export async function subscribeToFeed(
  url: string,
  userId: number,
  folderId: number | null,
): Promise<FeedDTO> {
  const normalizedUrl = url.trim();

  let feed = await db.query.feeds.findFirst({
    where: eq(schema.feeds.url, normalizedUrl),
  });

  if (!feed) {
    const parsed = await parser.parseURL(normalizedUrl);
    const faviconUrl = await tryGetFavicon(parsed.link ?? normalizedUrl);

    const feedResult = await db
      .insert(schema.feeds)
      .values({
        url: normalizedUrl,
        title: parsed.title ?? normalizedUrl,
        feedUrl: normalizedUrl,
        siteUrl: parsed.link ?? null,
        faviconUrl,
        lastFetchedAt: null,
        lastError: null,
      })
      .returning();
    feed = feedResult[0]!;

    if (parsed.items && parsed.items.length > 0) {
      await storeArticles(feed.id, parsed.items);
      await db
        .update(schema.feeds)
        .set({ lastFetchedAt: new Date().toISOString() })
        .where(eq(schema.feeds.id, feed.id));
    }
  }

  const existingSub = await db.query.subscriptions.findFirst({
    where: and(eq(schema.subscriptions.userId, userId), eq(schema.subscriptions.feedId, feed.id)),
  });

  let subscriptionId: number;
  let displayName: string | null = null;

  if (existingSub) {
    subscriptionId = existingSub.id;
    displayName = existingSub.displayName;
  } else {
    const subResult = await db
      .insert(schema.subscriptions)
      .values({
        userId,
        feedId: feed.id,
        folderId,
        displayName: null,
        sortOrder: 0,
      })
      .returning();
    subscriptionId = subResult[0]!.id;
  }

  await ensureUserArticles(feed.id, userId);

  return {
    id: feed.id,
    title: feed.title,
    feedUrl: feed.feedUrl,
    siteUrl: feed.siteUrl,
    faviconUrl: feed.faviconUrl,
    lastFetchedAt: feed.lastFetchedAt,
    lastError: feed.lastError,
    subscriptionId,
    folderId,
    displayName,
    unreadCount: 0,
  };
}

export async function refreshFeed(feedId: number): Promise<void> {
  const feed = await db.query.feeds.findFirst({
    where: eq(schema.feeds.id, feedId),
  });
  if (!feed) throw new Error("Feed not found");

  try {
    const fetchOptions: RequestInit = {
      headers: {
        "User-Agent": "Rift RSS Reader",
        ...(feed.etag ? { "If-None-Match": feed.etag } : {}),
        ...(feed.lastModified ? { "If-Modified-Since": feed.lastModified } : {}),
      },
    };

    const response = await fetch(feed.feedUrl, fetchOptions);

    if (response.status === 304) {
      await db
        .update(schema.feeds)
        .set({ lastFetchedAt: new Date().toISOString(), lastError: null })
        .where(eq(schema.feeds.id, feedId));
      return;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    const parsed = await parser.parseString(text);

    const etag = response.headers.get("etag");
    const lastModified = response.headers.get("last-modified");

    const newItems = await storeArticles(feedId, parsed.items ?? []);

    const update: Partial<typeof schema.feeds.$inferInsert> = {
      lastFetchedAt: new Date().toISOString(),
      lastError: null,
    };
    if (etag) update.etag = etag;
    if (lastModified) update.lastModified = lastModified;

    await db.update(schema.feeds).set(update).where(eq(schema.feeds.id, feedId));

    if (newItems > 0) {
      const subs = await db
        .select()
        .from(schema.subscriptions)
        .where(eq(schema.subscriptions.feedId, feedId))
        .all();
      for (const sub of subs) {
        await ensureUserArticles(feedId, sub.userId);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await db
      .update(schema.feeds)
      .set({ lastError: message, lastFetchedAt: new Date().toISOString() })
      .where(eq(schema.feeds.id, feedId));
    throw err;
  }
}

async function storeArticles(feedId: number, items: any[]): Promise<number> {
  let newCount = 0;

  for (const item of items.slice(0, 50)) {
    const guid = item.guid ?? item.id ?? item.link ?? item.title;
    if (!guid) continue;

    const existing = await db.query.articles.findFirst({
      where: and(eq(schema.articles.feedId, feedId), eq(schema.articles.guid, guid)),
    });
    if (existing) continue;

    await db.insert(schema.articles).values({
      feedId,
      guid,
      title: item.title ?? "Untitled",
      link: item.link ?? "",
      author: item.creator ?? item.author ?? null,
      summary: item.contentSnippet ?? item.summary ?? null,
      content: item.content ?? item["content:encoded"] ?? null,
      publishedAt: item.isoDate ?? item.pubDate ?? new Date().toISOString(),
    });
    newCount++;
  }

  return newCount;
}

async function ensureUserArticles(feedId: number, userId: number): Promise<void> {
  const articles = await db
    .select({ id: schema.articles.id })
    .from(schema.articles)
    .where(eq(schema.articles.feedId, feedId))
    .all();

  for (const article of articles) {
    const existing = await db.query.userArticles.findFirst({
      where: and(
        eq(schema.userArticles.userId, userId),
        eq(schema.userArticles.articleId, article.id),
      ),
    });
    if (!existing) {
      await db.insert(schema.userArticles).values({
        userId,
        articleId: article.id,
        read: false,
        saved: false,
      });
    }
  }
}

async function tryGetFavicon(siteUrl: string): Promise<string | null> {
  try {
    const url = new URL(siteUrl);
    return `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=32`;
  } catch {
    return null;
  }
}