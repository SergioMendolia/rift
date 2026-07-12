import { describe, it, expect, vi, beforeEach } from "vitest";
import type { UserDTO } from "@rift/shared";
import { makeMockDb, appWithUser, request } from "./_helpers";

const { db, schema } = makeMockDb();
vi.mock("../src/db/connection", () => ({ db, schema }));

const admin: UserDTO = { id: 1, email: "admin@b.com", displayName: "Admin", isAdmin: true };
const nonAdmin: UserDTO = { id: 2, email: "user@b.com", displayName: "User", isAdmin: false };

let userRoutes: any;

beforeEach(async () => {
  vi.resetModules();
  db._reset();
  (globalThis as any).Bun.password.hash.mockClear();
  userRoutes = (await import("../src/routes/users.routes")).userRoutes;
});

describe("userRoutes", () => {
  it("returns 401 when not authenticated", async () => {
    const res = await request(appWithUser(userRoutes, null), "GET", "/");
    expect(res.status).toBe(401);
  });

  it("returns 403 when not admin", async () => {
    const res = await request(appWithUser(userRoutes, nonAdmin), "GET", "/");
    expect(res.status).toBe(403);
    expect(res.data.error).toBe("Forbidden");
  });

  it("GET / lists all users", async () => {
    db._queueAll([
      { id: 1, email: "admin@b.com", displayName: "Admin", isAdmin: true },
      { id: 2, email: "user@b.com", displayName: "User", isAdmin: false },
    ]);
    const res = await request(appWithUser(userRoutes, admin), "GET", "/");
    expect(res.status).toBe(200);
    expect(res.data).toHaveLength(2);
    expect(res.data[0]).toEqual({ id: 1, email: "admin@b.com", displayName: "Admin", isAdmin: true });
  });

  it("POST / returns 400 when missing fields", async () => {
    const res = await request(appWithUser(userRoutes, admin), "POST", "/", { email: "a@b.com" });
    expect(res.status).toBe(400);
    expect(res.data.error).toBe("Missing required fields");
  });

  it("POST / returns 400 when email already in use", async () => {
    db._queueGet({ id: 1, email: "a@b.com" });
    const res = await request(appWithUser(userRoutes, admin), "POST", "/", {
      email: "a@b.com", password: "pw", displayName: "A",
    });
    expect(res.status).toBe(400);
    expect(res.data.error).toBe("Email already in use");
  });

  it("POST / creates a non-admin user", async () => {
    db._queueGet(undefined);
    db._queueReturning([{ id: 3, email: "new@b.com", displayName: "New", isAdmin: false }]);
    const res = await request(appWithUser(userRoutes, admin), "POST", "/", {
      email: "new@b.com", password: "pw", displayName: "New",
    });
    expect(res.status).toBe(201);
    expect(res.data).toEqual({ id: 3, email: "new@b.com", displayName: "New", isAdmin: false });
    expect((globalThis as any).Bun.password.hash).toHaveBeenCalledWith("pw");
  });

  it("DELETE /:id returns 400 when deleting self", async () => {
    const res = await request(appWithUser(userRoutes, admin), "DELETE", "/1");
    expect(res.status).toBe(400);
    expect(res.data.error).toBe("Cannot delete your own account");
  });

  it("DELETE /:id returns 404 when user not found", async () => {
    db._queueReturning([]);
    const res = await request(appWithUser(userRoutes, admin), "DELETE", "/999");
    expect(res.status).toBe(404);
    expect(res.data.error).toBe("User not found");
  });

  it("DELETE /:id deletes another user", async () => {
    db._queueReturning([{ id: 2 }]);
    const res = await request(appWithUser(userRoutes, admin), "DELETE", "/2");
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
  });
});