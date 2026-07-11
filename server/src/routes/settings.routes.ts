import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { db, schema } from "../db/connection";
import { requireAuth } from "../middleware";
import type { UpdateSettingsRequest } from "@rift/shared";

export const settingsRoutes = new Hono();

settingsRoutes.use("*", async (c, next) => {
  const user = requireAuth(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  await next();
});

settingsRoutes.get("/", async (c) => {
  const user = requireAuth(c)!;
  const settings = await db.query.userSettings.findFirst({
    where: eq(schema.userSettings.userId, user.id),
  });

  if (!settings) {
    const result = await db
      .insert(schema.userSettings)
      .values({ userId: user.id, theme: "light", markReadOnOpen: true })
      .returning();
    return c.json({
      theme: result[0]!.theme,
      markReadOnOpen: result[0]!.markReadOnOpen,
    });
  }

  return c.json({
    theme: settings.theme,
    markReadOnOpen: settings.markReadOnOpen,
  });
});

settingsRoutes.put("/", async (c) => {
  const user = requireAuth(c)!;
  const body = await c.req.json<UpdateSettingsRequest>();

  const update: Partial<typeof schema.userSettings.$inferInsert> = {};
  if (body.theme !== undefined) update.theme = body.theme;
  if (body.markReadOnOpen !== undefined) update.markReadOnOpen = body.markReadOnOpen;

  const existing = await db.query.userSettings.findFirst({
    where: eq(schema.userSettings.userId, user.id),
  });

  if (existing) {
    await db
      .update(schema.userSettings)
      .set(update)
      .where(eq(schema.userSettings.userId, user.id));
  } else {
    await db.insert(schema.userSettings).values({
      userId: user.id,
      theme: update.theme ?? "light",
      markReadOnOpen: update.markReadOnOpen ?? true,
    });
  }

  return c.json({ success: true });
});