import Parser from "rss-parser";
import { eq, and } from "drizzle-orm";
import { db, schema } from "../db/connection";
import { env } from "../env";
import type { FeedDTO } from "@rift/shared";

const parser = new Parser({
  timeout: 10000,
  headers: {
    "User-Agent": env.userAgent,
  },
});

const FETCH_TIMEOUT = 10000;

const FEED_LINK_RE = /<link\b[^>]*\brel=["']alternate["'][^>]*>/gi;
const TYPE_RE = /type=["']([^"']+)["']/i;
const HREF_RE = /href=["']([^"']+)["']/i;

const FEED_MIME_TYPES = new Set([
  "application/rss+xml",
  "application/atom+xml",
  "application/feed+json",
  "text/xml",
  "application/xml",
]);

const COMMON_FEED_PATHS = ["/feed", "/rss", "/rss.xml", "/feed.xml", "/index.xml", "/atom.xml"];

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 2000;

async function fetchWithRetry(input: string, init?: RequestInit): Promise<Response> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    try {
      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });
      if (response.status !== 429) return response;
      if (attempt === MAX_RETRIES) return response;
      const retryAfter = response.headers.get("retry-after");
      const delay = retryAfter
        ? parseFloat(retryAfter) * 1000
        : RETRY_BASE_MS * 2 ** attempt;
      await new Promise((r) => setTimeout(r, delay));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error("retry loop exited unexpectedly");
}

export function rewriteKnownSites(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname.endsWith("reddit.com")) {
      let path = u.pathname;
      if (path.endsWith(".rss")) {
        return `${u.origin}${path}${u.search}`;
      }
      const segments = path.split("/").filter(Boolean);
      const last = segments[segments.length - 1];
      if (last === "search") {
        return `${u.origin}${path}.rss${u.search}`;
      }
      if (path === "/" || path === "") {
        return `${u.origin}/.rss${u.search}`;
      }
      if (path.endsWith("/")) {
        return `${u.origin}${path}.rss${u.search}`;
      }
      return `${u.origin}${path}/.rss${u.search}`;
    }
    return url;
  } catch {
    return url;
  }
}

export async function discoverFeedUrl(url: string): Promise<string> {
  const rewritten = rewriteKnownSites(url);

  const response = await fetchWithRetry(rewritten, {
    headers: { "User-Agent": env.userAgent },
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
  const text = await response.text();

  if (
    contentType.includes("xml") ||
    contentType.includes("rss") ||
    contentType.includes("atom") ||
    text.trimStart().startsWith("<?xml")
  ) {
    return rewritten;
  }

  const linkMatches = text.match(FEED_LINK_RE) ?? [];
  for (const tag of linkMatches) {
    const typeMatch = tag.match(TYPE_RE);
    const type = typeMatch ? typeMatch[1].toLowerCase() : "";
    if (!FEED_MIME_TYPES.has(type)) continue;

    const hrefMatch = tag.match(HREF_RE);
    if (!hrefMatch) continue;

    try {
      return new URL(hrefMatch[1], url).toString();
    } catch {
      continue;
    }
  }

  const baseUrl = new URL(url);
  for (const path of COMMON_FEED_PATHS) {
    const candidate = new URL(path, `${baseUrl.origin}${baseUrl.pathname.replace(/\/$/, "")}`).toString();
    try {
      const probe = await fetchWithRetry(candidate, {
        headers: { "User-Agent": env.userAgent },
        redirect: "follow",
      });
      const probeContentType = (probe.headers.get("content-type") ?? "").toLowerCase();
      if (
        probe.ok &&
        (probeContentType.includes("xml") ||
          probeContentType.includes("rss") ||
          probeContentType.includes("atom"))
      ) {
        return candidate;
      }
    } catch {
      continue;
    }
  }

  throw new Error("Could not find an RSS feed at this URL");
}

export async function subscribeToFeed(
  url: string,
  userId: number,
  folderId: number | null,
): Promise<FeedDTO> {
  const normalizedUrl = url.trim();

  let feedUrl = rewriteKnownSites(normalizedUrl);
  const rewrittenByKnownSite = feedUrl !== normalizedUrl;
  if (!rewrittenByKnownSite) {
    try {
      feedUrl = await discoverFeedUrl(feedUrl);
    } catch {
      // fall through; feedUrl is the original URL, parser.parseURL will give the real error
    }
  }

  let feed = await db.query.feeds.findFirst({
    where: eq(schema.feeds.url, feedUrl),
  });

  if (!feed) {
    const parsed = await parser.parseURL(feedUrl);
    const faviconUrl = await tryGetFavicon(parsed.link ?? feedUrl);

    const feedResult = await db
      .insert(schema.feeds)
      .values({
        url: feedUrl,
        title: parsed.title ?? feedUrl,
        feedUrl,
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
        "User-Agent": env.userAgent,
        ...(feed.etag ? { "If-None-Match": feed.etag } : {}),
        ...(feed.lastModified ? { "If-Modified-Since": feed.lastModified } : {}),
      },
    };

    const response = await fetchWithRetry(feed.feedUrl, fetchOptions);

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
      content: item["content:encoded"] ?? item.content ?? null,
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