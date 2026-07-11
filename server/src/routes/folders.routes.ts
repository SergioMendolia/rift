import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { db, schema } from "../db/connection";
import { requireAuth } from "../middleware";
import type { CreateFolderRequest, FolderDTO } from "@rift/shared";

export const folderRoutes = new Hono();

folderRoutes.use("*", async (c, next) => {
  const user = requireAuth(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  await next();
});

folderRoutes.get("/", async (c) => {
  const user = requireAuth(c)!;
  const result = await db
    .select()
    .from(schema.folders)
    .where(eq(schema.folders.userId, user.id))
    .all();

  const dtos: FolderDTO[] = result
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((f) => ({ id: f.id, name: f.name, sortOrder: f.sortOrder }));
  return c.json(dtos);
});

folderRoutes.post("/", async (c) => {
  const user = requireAuth(c)!;
  const body = await c.req.json<CreateFolderRequest>();
  if (!body.name) return c.json({ error: "Missing folder name" }, 400);

  const maxOrder = await db
    .select()
    .from(schema.folders)
    .where(eq(schema.folders.userId, user.id))
    .all();
  const sortOrder = maxOrder.length > 0 ? Math.max(...maxOrder.map((f) => f.sortOrder)) + 1 : 0;

  const result = await db
    .insert(schema.folders)
    .values({ userId: user.id, name: body.name, sortOrder })
    .returning();

  const f = result[0]!;
  return c.json({ id: f.id, name: f.name, sortOrder: f.sortOrder }, 201);
});

folderRoutes.put("/:id", async (c) => {
  const user = requireAuth(c)!;
  const id = parseInt(c.req.param("id"), 10);
  const body = await c.req.json<Partial<CreateFolderRequest>>();

  const existing = await db.query.folders.findFirst({
    where: and(eq(schema.folders.id, id), eq(schema.folders.userId, user.id)),
  });
  if (!existing) return c.json({ error: "Folder not found" }, 404);

  const update: Partial<typeof schema.folders.$inferInsert> = {};
  if (body.name !== undefined) update.name = body.name;

  await db.update(schema.folders).set(update).where(eq(schema.folders.id, id));
  return c.json({ success: true });
});

folderRoutes.delete("/:id", async (c) => {
  const user = requireAuth(c)!;
  const id = parseInt(c.req.param("id"), 10);

  const existing = await db.query.folders.findFirst({
    where: and(eq(schema.folders.id, id), eq(schema.folders.userId, user.id)),
  });
  if (!existing) return c.json({ error: "Folder not found" }, 404);

  await db.delete(schema.folders).where(eq(schema.folders.id, id));
  return c.json({ success: true });
});