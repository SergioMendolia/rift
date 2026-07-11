import type { Context, Next } from "hono";
import { verify, sign } from "hono/jwt";
import { env } from "../env";
import type { UserDTO } from "@rift/shared";
import { db, schema } from "../db/connection";
import { eq } from "drizzle-orm";

export interface AuthVariables {
  user: UserDTO | null;
}

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) {
    c.set("user", null);
    return next();
  }

  try {
    const payload = await verify(token, env.jwtSecret, "HS256");
    const userId = payload.sub as number;
    const user = await db.query.users.findFirst({
      where: eq(schema.users.id, userId),
    });

    if (!user) {
      c.set("user", null);
      return next();
    }

    c.set("user", {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      isAdmin: user.isAdmin,
    });
    return next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    c.set("user", null);
    return next();
  }
}

export function requireAuth(c: Context): UserDTO | null {
  return c.get("user");
}

export function requireAdmin(c: Context): boolean {
  const user = c.get("user");
  return user?.isAdmin === true;
}

export async function issueToken(userId: number): Promise<string> {
  return sign({ sub: userId, alg: "HS256", typ: "JWT" }, env.jwtSecret);
}

export const errorHandler = async (c: Context, next: Next) => {
  try {
    await next();
  } catch (err) {
    console.error("Unhandled error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return c.json({ error: message }, 500);
  }
};