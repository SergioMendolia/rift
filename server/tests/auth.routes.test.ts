import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { makeMockDb, appWithUser, request } from "./_helpers";

const { db, schema } = makeMockDb();
vi.mock("../src/db/connection", () => ({ db, schema }));

let authRoutes: any;

beforeEach(async () => {
  vi.resetModules();
  db._reset();
  (globalThis as any).Bun.password.hash.mockClear();
  (globalThis as any).Bun.password.verify.mockClear();
  authRoutes = (await import("../src/routes/auth.routes")).authRoutes;
});

describe("authRoutes", () => {
  it("GET /status returns needsSetup true when no users exist", async () => {
    db._queueAll([]);
    const res = await request(authRoutes, "GET", "/status");
    expect(res.status).toBe(200);
    expect(res.data.needsSetup).toBe(true);
    expect(res.data.hasAdmin).toBe(false);
  });

  it("GET /status returns needsSetup false when users exist", async () => {
    db._queueAll([{ isAdmin: true }, { isAdmin: false }]);
    const res = await request(authRoutes, "GET", "/status");
    expect(res.status).toBe(200);
    expect(res.data.needsSetup).toBe(false);
    expect(res.data.hasAdmin).toBe(true);
  });

  it("GET /me returns 401 when not authenticated", async () => {
    const res = await request(authRoutes, "GET", "/me");
    expect(res.status).toBe(401);
  });

  it("GET /me returns user when authenticated", async () => {
    const app = new Hono();
    app.use("*", async (c, next) => {
      c.set("user", { id: 1, email: "a@b.com", displayName: "A", isAdmin: true });
      await next();
    });
    app.route("/", authRoutes);
    const res = await request(app, "GET", "/me");
    expect(res.status).toBe(200);
    expect(res.data).toEqual({ id: 1, email: "a@b.com", displayName: "A", isAdmin: true });
  });

  it("POST /setup returns 400 when setup already complete", async () => {
    db._queueAll([{ id: 1 }]);
    const res = await request(authRoutes, "POST", "/setup", {
      email: "a@b.com", password: "pw", displayName: "A",
    });
    expect(res.status).toBe(400);
    expect(res.data.error).toBe("Setup already complete");
  });

  it("POST /setup returns 400 when missing fields", async () => {
    db._queueAll([]);
    const res = await request(authRoutes, "POST", "/setup", { email: "a@b.com" });
    expect(res.status).toBe(400);
    expect(res.data.error).toBe("Missing required fields");
  });

  it("POST /setup creates admin and returns token", async () => {
    db._queueAll([]);
    db._queueReturning([{ id: 1, email: "a@b.com", displayName: "A", isAdmin: true }]);
    const res = await request(authRoutes, "POST", "/setup", {
      email: "a@b.com", password: "pw", displayName: "A",
    });
    expect(res.status).toBe(200);
    expect(res.data.token).toBeTruthy();
    expect(res.data.user).toEqual({ id: 1, email: "a@b.com", displayName: "A", isAdmin: true });
    expect((globalThis as any).Bun.password.hash).toHaveBeenCalledWith("pw");
  });

  it("POST /login returns 400 when missing fields", async () => {
    const res = await request(authRoutes, "POST", "/login", { email: "a@b.com" });
    expect(res.status).toBe(400);
    expect(res.data.error).toBe("Missing email or password");
  });

  it("POST /login returns 401 when user not found", async () => {
    const res = await request(authRoutes, "POST", "/login", {
      email: "nope@b.com", password: "pw",
    });
    expect(res.status).toBe(401);
    expect(res.data.error).toBe("Invalid credentials");
  });

  it("POST /login returns 401 when password invalid", async () => {
    db._queueGet({ id: 1, email: "a@b.com", passwordHash: "hash:wrong", displayName: "A", isAdmin: true });
    (globalThis as any).Bun.password.verify.mockResolvedValueOnce(false);
    const res = await request(authRoutes, "POST", "/login", {
      email: "a@b.com", password: "pw",
    });
    expect(res.status).toBe(401);
    expect(res.data.error).toBe("Invalid credentials");
  });

  it("POST /login returns token when credentials valid", async () => {
    db._queueGet({ id: 1, email: "a@b.com", passwordHash: "hash:pw", displayName: "A", isAdmin: true });
    (globalThis as any).Bun.password.verify.mockResolvedValueOnce(true);
    const res = await request(authRoutes, "POST", "/login", {
      email: "a@b.com", password: "pw",
    });
    expect(res.status).toBe(200);
    expect(res.data.token).toBeTruthy();
    expect(res.data.user).toEqual({ id: 1, email: "a@b.com", displayName: "A", isAdmin: true });
  });
});