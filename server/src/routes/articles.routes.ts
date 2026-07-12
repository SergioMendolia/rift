import { Hono } from "hono";
import { eq, and, asc, gt, sql } from "drizzle-orm";
import { db, schema } from "../db/connection";
import { requireAuth } from "../middleware";
import type { ArticleDTO, ArticleListResponse, UpdateArticleRequest } from "@rift/shared";

export const articleRoutes = new Hono();

articleRoutes.use("*", async (c, next) => {
  const user = requireAuth(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  await next();
});

articleRoutes.get("/", async (c) => {
  const user = requireAuth(c)!;
  const feedId = c.req.query("feedId");
  const folderId = c.req.query("folderId");
  const read = c.req.query("read");
  const saved = c.req.query("saved");
  const hideRead = c.req.query("hideRead") !== "false";
  const tagId = c.req.query("tagId");
  const cursor = c.req.query("cursor");
  const limit = Math.min(parseInt(c.req.query("limit") ?? "50", 10), 100);

  const conditions = [eq(schema.userArticles.userId, user.id)];

  if (feedId) {
    conditions.push(eq(schema.articles.feedId, parseInt(feedId, 10)));
  }

  if (folderId) {
    const folderSubs = await db
      .select()
      .from(schema.subscriptions)
      .where(and(eq(schema.subscriptions.userId, user.id), eq(schema.subscriptions.folderId, parseInt(folderId, 10))))
      .all();
    const feedIds = folderSubs.map((s) => s.feedId);
    if (feedIds.length === 0) return c.json({ articles: [], nextCursor: null });
    conditions.push(sql`${schema.articles.feedId} IN (${sql.join(feedIds.map((id) => sql`${id}`), sql`,`)})`);
  }

  if (read === "true") {
    conditions.push(eq(schema.userArticles.read, true));
  } else if (read === "false") {
    conditions.push(eq(schema.userArticles.read, false));
  } else if (hideRead) {
    conditions.push(eq(schema.userArticles.read, false));
  }

  if (saved === "true") {
    conditions.push(eq(schema.userArticles.saved, true));
  }

  if (cursor) {
    const cursorArticle = await db.query.articles.findFirst({
      where: eq(schema.articles.id, parseInt(cursor, 10)),
    });
    if (cursorArticle) {
      conditions.push(gt(schema.articles.publishedAt, cursorArticle.publishedAt));
    }
  }

  const results = await db
    .select({
      article: schema.articles,
      userArticle: schema.userArticles,
      feedTitle: schema.feeds.title,
    })
    .from(schema.userArticles)
    .innerJoin(schema.articles, eq(schema.userArticles.articleId, schema.articles.id))
    .innerJoin(schema.feeds, eq(schema.articles.feedId, schema.feeds.id))
    .where(and(...conditions))
    .orderBy(asc(schema.articles.publishedAt))
    .limit(limit + 1)
    .all();

  const hasMore = results.length > limit;
  const items = hasMore ? results.slice(0, limit) : results;
  const nextCursor = hasMore ? items[items.length - 1]!.article.id : null;

  const dtos: ArticleDTO[] = items.map((r) => ({
    id: r.article.id,
    feedId: r.article.feedId,
    feedTitle: r.feedTitle,
    guid: r.article.guid,
    title: r.article.title,
    link: r.article.link,
    author: r.article.author,
    summary: r.article.summary,
    content: r.article.content,
    publishedAt: r.article.publishedAt,
    read: r.userArticle.read,
    saved: r.userArticle.saved,
    tags: [],
  }));

  const response: ArticleListResponse = { articles: dtos, nextCursor };
  return c.json(response);
});

articleRoutes.get("/:id", async (c) => {
  const user = requireAuth(c)!;
  const articleId = parseInt(c.req.param("id"), 10);

  const result = await db
    .select({
      article: schema.articles,
      userArticle: schema.userArticles,
      feedTitle: schema.feeds.title,
    })
    .from(schema.userArticles)
    .innerJoin(schema.articles, eq(schema.userArticles.articleId, schema.articles.id))
    .innerJoin(schema.feeds, eq(schema.articles.feedId, schema.feeds.id))
    .where(and(eq(schema.userArticles.userId, user.id), eq(schema.articles.id, articleId)))
    .get();

  if (!result) return c.json({ error: "Article not found" }, 404);

  return c.json({
    id: result.article.id,
    feedId: result.article.feedId,
    feedTitle: result.feedTitle,
    guid: result.article.guid,
    title: result.article.title,
    link: result.article.link,
    author: result.article.author,
    summary: result.article.summary,
    content: result.article.content,
    publishedAt: result.article.publishedAt,
    read: result.userArticle.read,
    saved: result.userArticle.saved,
    tags: [],
  } satisfies ArticleDTO);
});

articleRoutes.put("/:id", async (c) => {
  const user = requireAuth(c)!;
  const articleId = parseInt(c.req.param("id"), 10);
  const body = await c.req.json<UpdateArticleRequest>();

  const existing = await db.query.userArticles.findFirst({
    where: and(eq(schema.userArticles.userId, user.id), eq(schema.userArticles.articleId, articleId)),
  });
  if (!existing) return c.json({ error: "Article not found" }, 404);

  const update: Partial<typeof schema.userArticles.$inferInsert> = {};
  if (body.read !== undefined) {
    update.read = body.read;
    update.readAt = body.read ? new Date().toISOString() : null;
  }
  if (body.saved !== undefined) {
    update.saved = body.saved;
    update.savedAt = body.saved ? new Date().toISOString() : null;
  }

  await db
    .update(schema.userArticles)
    .set(update)
    .where(and(eq(schema.userArticles.userId, user.id), eq(schema.userArticles.articleId, articleId)));

  return c.json({ success: true });
});