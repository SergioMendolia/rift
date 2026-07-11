import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { db, schema } from "../db/connection";
import { issueToken, requireAuth } from "../middleware";
import type { LoginRequest, SetupRequest } from "@rift/shared";

export const authRoutes = new Hono();

authRoutes.get("/status", async (c) => {
  const userCount = await db.select().from(schema.users).all();
  const hasAdmin = userCount.some((u) => u.isAdmin);
  return c.json({ needsSetup: userCount.length === 0, hasAdmin });
});

authRoutes.get("/me", async (c) => {
  const user = requireAuth(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  return c.json(user);
});

authRoutes.post("/setup", async (c) => {
  const existingUsers = await db.select().from(schema.users).all();
  if (existingUsers.length > 0) {
    return c.json({ error: "Setup already complete" }, 400);
  }

  const body = await c.req.json<SetupRequest>();
  if (!body.email || !body.password || !body.displayName) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  const passwordHash = await Bun.password.hash(body.password);
  const result = await db
    .insert(schema.users)
    .values({
      email: body.email,
      passwordHash,
      displayName: body.displayName,
      isAdmin: true,
    })
    .returning();

  const user = result[0]!;

  await db.insert(schema.userSettings).values({
    userId: user.id,
    theme: "light",
    markReadOnOpen: true,
  });

  const token = await issueToken(user.id);
  return c.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      isAdmin: user.isAdmin,
    },
  });
});

authRoutes.post("/login", async (c) => {
  const body = await c.req.json<LoginRequest>();
  if (!body.email || !body.password) {
    return c.json({ error: "Missing email or password" }, 400);
  }

  const user = await db.query.users.findFirst({
    where: eq(schema.users.email, body.email),
  });

  if (!user) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const valid = await Bun.password.verify(body.password, user.passwordHash);
  if (!valid) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const token = await issueToken(user.id);
  return c.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      isAdmin: user.isAdmin,
    },
  });
});