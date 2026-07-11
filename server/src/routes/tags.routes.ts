import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { db, schema } from "../db/connection";
import { requireAuth } from "../middleware";
import type { TagDTO } from "@rift/shared";

export const tagRoutes = new Hono();

tagRoutes.use("*", async (c, next) => {
  const user = requireAuth(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  await next();
});

tagRoutes.get("/", async (c) => {
  const user = requireAuth(c)!;
  const result = await db
    .select()
    .from(schema.tags)
    .where(eq(schema.tags.userId, user.id))
    .all();

  const dtos: TagDTO[] = result.map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
  }));
  return c.json(dtos);
});

tagRoutes.post("/", async (c) => {
  const user = requireAuth(c)!;
  const body = await c.req.json<{ name: string; color?: string }>();
  if (!body.name) return c.json({ error: "Missing tag name" }, 400);

  const result = await db
    .insert(schema.tags)
    .values({ userId: user.id, name: body.name, color: body.color ?? null })
    .returning();

  const t = result[0]!;
  return c.json({ id: t.id, name: t.name, color: t.color }, 201);
});

tagRoutes.put("/:id", async (c) => {
  const user = requireAuth(c)!;
  const id = parseInt(c.req.param("id"), 10);
  const body = await c.req.json<{ name?: string; color?: string }>();

  const existing = await db.query.tags.findFirst({
    where: and(eq(schema.tags.id, id), eq(schema.tags.userId, user.id)),
  });
  if (!existing) return c.json({ error: "Tag not found" }, 404);

  const update: Partial<typeof schema.tags.$inferInsert> = {};
  if (body.name !== undefined) update.name = body.name;
  if (body.color !== undefined) update.color = body.color;

  await db.update(schema.tags).set(update).where(eq(schema.tags.id, id));
  return c.json({ success: true });
});

tagRoutes.delete("/:id", async (c) => {
  const user = requireAuth(c)!;
  const id = parseInt(c.req.param("id"), 10);

  const existing = await db.query.tags.findFirst({
    where: and(eq(schema.tags.id, id), eq(schema.tags.userId, user.id)),
  });
  if (!existing) return c.json({ error: "Tag not found" }, 404);

  await db.delete(schema.tags).where(eq(schema.tags.id, id));
  return c.json({ success: true });
});

tagRoutes.post("/articles/:articleId", async (c) => {
  const user = requireAuth(c)!;
  const articleId = parseInt(c.req.param("articleId"), 10);
  const body = await c.req.json<{ tagId: number }>();

  const userArticle = await db.query.userArticles.findFirst({
    where: and(eq(schema.userArticles.userId, user.id), eq(schema.userArticles.articleId, articleId)),
  });
  if (!userArticle) return c.json({ error: "Article not found" }, 404);

  const tag = await db.query.tags.findFirst({
    where: and(eq(schema.tags.id, body.tagId), eq(schema.tags.userId, user.id)),
  });
  if (!tag) return c.json({ error: "Tag not found" }, 404);

  await db
    .insert(schema.articleTags)
    .values({ tagId: body.tagId, userArticleId: userArticle.id })
    .onConflictDoNothing();

  return c.json({ success: true }, 201);
});

tagRoutes.delete("/articles/:articleId/:tagId", async (c) => {
  const user = requireAuth(c)!;
  const articleId = parseInt(c.req.param("articleId"), 10);
  const tagId = parseInt(c.req.param("tagId"), 10);

  const userArticle = await db.query.userArticles.findFirst({
    where: and(eq(schema.userArticles.userId, user.id), eq(schema.userArticles.articleId, articleId)),
  });
  if (!userArticle) return c.json({ error: "Article not found" }, 404);

  await db
    .delete(schema.articleTags)
    .where(and(eq(schema.articleTags.tagId, tagId), eq(schema.articleTags.userArticleId, userArticle.id)));

  return c.json({ success: true });
});