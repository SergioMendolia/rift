import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { makeMockDb } from "./_helpers";

const { db, schema } = makeMockDb();
vi.mock("../src/db/connection", () => ({ db, schema }));

let middleware: any;

beforeEach(async () => {
  vi.resetModules();
  db._reset();
  middleware = await import("../src/middleware/index");
});

function buildApp(user?: { id: number; email: string; displayName: string; isAdmin: boolean }) {
  const app = new Hono();
  app.use("*", middleware.authMiddleware);
  app.get("/", (c) => c.json({ user: c.get("user") }));
  return app;
}

describe("authMiddleware", () => {
  it("sets user to null when no Authorization header", async () => {
    const app = buildApp();
    const res = await app.request("http://localhost/");
    expect(res.status).toBe(200);
    expect((await res.json()).user).toBeNull();
  });

  it("sets user to null when token is malformed", async () => {
    const app = buildApp();
    const res = await app.request("http://localhost/", {
      headers: { Authorization: "Bearer not-a-jwt" },
    });
    expect(res.status).toBe(200);
    expect((await res.json()).user).toBeNull();
  });

  it("sets user to null when token valid but user not found", async () => {
    db._queueGet(undefined);
    const app = buildApp();
    // issue a real token with the dev secret
    const token = await middleware.issueToken(999);
    const res = await app.request("http://localhost/", {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect((await res.json()).user).toBeNull();
  });

  it("sets user from a valid token", async () => {
    db._queueGet({ id: 1, email: "a@b.com", displayName: "A", isAdmin: true });
    const app = buildApp();
    const token = await middleware.issueToken(1);
    const res = await app.request("http://localhost/", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    expect(data.user).toEqual({ id: 1, email: "a@b.com", displayName: "A", isAdmin: true });
  });
});

describe("requireAuth / requireAdmin", () => {
  it("requireAuth returns the user set on context", () => {
    const c = { get: vi.fn(() => ({ id: 1, isAdmin: false })) } as any;
    expect(middleware.requireAuth(c)).toEqual({ id: 1, isAdmin: false });
  });

  it("requireAuth returns null when no user", () => {
    const c = { get: vi.fn(() => null) } as any;
    expect(middleware.requireAuth(c)).toBeNull();
  });

  it("requireAdmin returns true for admin user", () => {
    const c = { get: vi.fn(() => ({ isAdmin: true })) } as any;
    expect(middleware.requireAdmin(c)).toBe(true);
  });

  it("requireAdmin returns false for non-admin", () => {
    const c = { get: vi.fn(() => ({ isAdmin: false })) } as any;
    expect(middleware.requireAdmin(c)).toBe(false);
  });

  it("requireAdmin returns false when no user", () => {
    const c = { get: vi.fn(() => null) } as any;
    expect(middleware.requireAdmin(c)).toBe(false);
  });
});

describe("errorHandler", () => {
  it("catches thrown errors and returns a 500 response", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const app = new Hono();
    app.use("*", middleware.errorHandler);
    app.get("/", () => {
      throw new Error("boom");
    });
    const res = await app.request("http://localhost/");
    expect(res.status).toBe(500);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("passes through when no error", async () => {
    const app = new Hono();
    app.use("*", middleware.errorHandler);
    app.get("/", (c) => c.json({ ok: true }));
    const res = await app.request("http://localhost/");
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });
});

describe("issueToken", () => {
  it("issues a token that authMiddleware can verify", async () => {
    db._queueGet({ id: 5, email: "x@y.com", displayName: "X", isAdmin: false });
    const token = await middleware.issueToken(5);
    const app = buildApp();
    const res = await app.request("http://localhost/", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    expect(data.user.id).toBe(5);
  });
});