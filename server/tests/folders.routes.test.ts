import { describe, it, expect, vi, beforeEach } from "vitest";
import type { UserDTO } from "@rift/shared";
import { makeMockDb, appWithUser, request } from "./_helpers";

const { db, schema } = makeMockDb();
vi.mock("../src/db/connection", () => ({ db, schema }));

const user: UserDTO = { id: 1, email: "a@b.com", displayName: "A", isAdmin: true };

let folderRoutes: any;

beforeEach(async () => {
  vi.resetModules();
  db._reset();
  folderRoutes = (await import("../src/routes/folders.routes")).folderRoutes;
});

describe("folderRoutes", () => {
  const app = () => appWithUser(folderRoutes, user);

  it("GET / returns 401 when not authenticated", async () => {
    const res = await request(appWithUser(folderRoutes, null), "GET", "/");
    expect(res.status).toBe(401);
  });

  it("GET / returns folders sorted by sortOrder", async () => {
    db._queueAll([
      { id: 2, userId: 1, name: "B", sortOrder: 1 },
      { id: 1, userId: 1, name: "A", sortOrder: 0 },
    ]);
    const res = await request(app(), "GET", "/");
    expect(res.status).toBe(200);
    expect(res.data).toHaveLength(2);
    expect(res.data[0].name).toBe("A");
    expect(res.data[1].name).toBe("B");
  });

  it("POST / returns 400 when name is missing", async () => {
    const res = await request(app(), "POST", "/", {});
    expect(res.status).toBe(400);
    expect(res.data.error).toBe("Missing folder name");
  });

  it("POST / creates a folder with next sortOrder", async () => {
    db._queueAll({ id: 1, sortOrder: 5 });
    db._queueReturning([{ id: 2, name: "New", sortOrder: 6 }]);
    const res = await request(app(), "POST", "/", { name: "New" });
    expect(res.status).toBe(201);
    expect(res.data).toEqual({ id: 2, name: "New", sortOrder: 6 });
  });

  it("POST / creates first folder with sortOrder 0", async () => {
    db._queueAll();
    db._queueReturning([{ id: 1, name: "First", sortOrder: 0 }]);
    const res = await request(app(), "POST", "/", { name: "First" });
    expect(res.status).toBe(201);
    expect(res.data.sortOrder).toBe(0);
  });

  it("PUT /:id returns 404 when folder not found", async () => {
    db._queueGet(undefined);
    const res = await request(app(), "PUT", "/5", { name: "X" });
    expect(res.status).toBe(404);
    expect(res.data.error).toBe("Folder not found");
  });

  it("PUT /:id renames the folder", async () => {
    db._queueGet({ id: 5, userId: 1, name: "Old" });
    const res = await request(app(), "PUT", "/5", { name: "New" });
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
  });

  it("DELETE /:id returns 404 when folder not found", async () => {
    db._queueGet(undefined);
    const res = await request(app(), "DELETE", "/5");
    expect(res.status).toBe(404);
    expect(res.data.error).toBe("Folder not found");
  });

  it("DELETE /:id deletes the folder", async () => {
    db._queueGet({ id: 5, userId: 1, name: "X" });
    const res = await request(app(), "DELETE", "/5");
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
  });
});