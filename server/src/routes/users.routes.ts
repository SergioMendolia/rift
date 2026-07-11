import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/connection";
import { requireAuth, requireAdmin } from "../middleware";
import type { CreateUserRequest, UserDTO } from "@rift/shared";

export const userRoutes = new Hono();

userRoutes.use("*", async (c, next) => {
  const user = requireAuth(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  if (!requireAdmin(c)) return c.json({ error: "Forbidden" }, 403);
  await next();
});

userRoutes.get("/", async (c) => {
  const users = await db.select().from(schema.users).all();
  const dtos: UserDTO[] = users.map((u) => ({
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    isAdmin: u.isAdmin,
  }));
  return c.json(dtos);
});

userRoutes.post("/", async (c) => {
  const body = await c.req.json<CreateUserRequest>();
  if (!body.email || !body.password || !body.displayName) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  const existing = await db.query.users.findFirst({
    where: eq(schema.users.email, body.email),
  });
  if (existing) {
    return c.json({ error: "Email already in use" }, 400);
  }

  const passwordHash = await Bun.password.hash(body.password);
  const result = await db
    .insert(schema.users)
    .values({
      email: body.email,
      passwordHash,
      displayName: body.displayName,
      isAdmin: false,
    })
    .returning();

  const user = result[0]!;

  await db.insert(schema.userSettings).values({
    userId: user.id,
    theme: "light",
    markReadOnOpen: true,
  });

  return c.json({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    isAdmin: user.isAdmin,
  }, 201);
});

userRoutes.delete("/:id", async (c) => {
  const id = parseInt(c.req.param("id"), 10);
  const adminUser = requireAuth(c)!;

  if (id === adminUser.id) {
    return c.json({ error: "Cannot delete your own account" }, 400);
  }

  const result = await db.delete(schema.users).where(eq(schema.users.id, id)).returning();
  if (result.length === 0) {
    return c.json({ error: "User not found" }, 404);
  }

  return c.json({ success: true });
});