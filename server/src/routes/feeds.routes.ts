import { Hono } from "hono";
import { eq, and, sql, inArray } from "drizzle-orm";
import { db, schema } from "../db/connection";
import { requireAuth } from "../middleware";
import { subscribeToFeed, refreshFeed } from "../services/feed-service";
import type { CreateFeedRequest, FeedDTO } from "@rift/shared";

export const feedRoutes = new Hono();

feedRoutes.use("*", async (c, next) => {
  const user = requireAuth(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  await next();
});

feedRoutes.get("/", async (c) => {
  const user = requireAuth(c)!;

  const subs = await db
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.userId, user.id))
    .all();

  const feeds = await db.select().from(schema.feeds).all();
  const feedMap = new Map(feeds.map((f) => [f.id, f]));

  const unreadCounts = await db
    .select({
      feedId: schema.articles.feedId,
      count: sql<number>`count(*)`,
    })
    .from(schema.userArticles)
    .innerJoin(schema.articles, eq(schema.userArticles.articleId, schema.articles.id))
    .where(and(eq(schema.userArticles.userId, user.id), eq(schema.userArticles.read, false)))
    .groupBy(schema.articles.feedId)
    .all();
  const countMap = new Map(unreadCounts.map((r) => [r.feedId, r.count]));

  const dtos: FeedDTO[] = subs.map((sub) => {
    const feed = feedMap.get(sub.feedId);
    return {
      id: feed!.id,
      title: feed!.title,
      feedUrl: feed!.feedUrl,
      siteUrl: feed!.siteUrl,
      faviconUrl: feed!.faviconUrl,
      lastFetchedAt: feed!.lastFetchedAt,
      lastError: feed!.lastError,
      subscriptionId: sub.id,
      folderId: sub.folderId,
      displayName: sub.displayName,
      unreadCount: countMap.get(sub.feedId) ?? 0,
    };
  });

  return c.json(dtos);
});

feedRoutes.post("/", async (c) => {
  const user = requireAuth(c)!;
  const body = await c.req.json<CreateFeedRequest>();
  if (!body.url) return c.json({ error: "Missing feed URL" }, 400);

  try {
    const feedDTO = await subscribeToFeed(body.url, user.id, body.folderId ?? null);
    return c.json(feedDTO, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to subscribe to feed";
    return c.json({ error: message }, 400);
  }
});

feedRoutes.delete("/:id", async (c) => {
  const user = requireAuth(c)!;
  const feedId = parseInt(c.req.param("id"), 10);

  const result = await db
    .delete(schema.subscriptions)
    .where(and(eq(schema.subscriptions.feedId, feedId), eq(schema.subscriptions.userId, user.id)))
    .returning();

  if (result.length === 0) return c.json({ error: "Subscription not found" }, 404);

  const articleIds = (await db
    .select({ id: schema.articles.id })
    .from(schema.articles)
    .where(eq(schema.articles.feedId, feedId))
    .all()).map((a) => a.id);

  if (articleIds.length > 0) {
    await db
      .delete(schema.userArticles)
      .where(and(
        eq(schema.userArticles.userId, user.id),
        inArray(schema.userArticles.articleId, articleIds),
      ));
  }

  return c.json({ success: true });
});

feedRoutes.put("/:id", async (c) => {
  const user = requireAuth(c)!;
  const feedId = parseInt(c.req.param("id"), 10);
  const body = await c.req.json<{ displayName?: string | null; folderId?: number | null }>();

  const sub = await db.query.subscriptions.findFirst({
    where: and(eq(schema.subscriptions.feedId, feedId), eq(schema.subscriptions.userId, user.id)),
  });
  if (!sub) return c.json({ error: "Subscription not found" }, 404);

  const update: Partial<typeof schema.subscriptions.$inferInsert> = {};
  if (body.displayName !== undefined) update.displayName = body.displayName || null;
  if (body.folderId !== undefined) update.folderId = body.folderId;

  await db
    .update(schema.subscriptions)
    .set(update)
    .where(eq(schema.subscriptions.id, sub.id));

  return c.json({ success: true });
});

feedRoutes.post("/:id/refresh", async (c) => {
  const user = requireAuth(c)!;
  const feedId = parseInt(c.req.param("id"), 10);

  const sub = await db.query.subscriptions.findFirst({
    where: and(eq(schema.subscriptions.feedId, feedId), eq(schema.subscriptions.userId, user.id)),
  });
  if (!sub) return c.json({ error: "Subscription not found" }, 404);

  try {
    await refreshFeed(feedId);
    return c.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to refresh feed";
    return c.json({ error: message }, 500);
  }
});

feedRoutes.post("/refresh-all", async (c) => {
  const user = requireAuth(c)!;
  const subs = await db
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.userId, user.id))
    .all();

  const feedIds = [...new Set(subs.map((s) => s.feedId))];
  await Promise.allSettled(feedIds.map((id) => refreshFeed(id)));
  return c.json({ success: true });
});