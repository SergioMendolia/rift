import { describe, it, expect, vi, beforeEach } from "vitest";
import type { UserDTO } from "@rift/shared";
import { makeMockDb, appWithUser, request } from "./_helpers";

const { db, schema } = makeMockDb();
vi.mock("../src/db/connection", () => ({ db, schema }));

const user: UserDTO = { id: 1, email: "a@b.com", displayName: "A", isAdmin: true };

let settingsRoutes: any;

beforeEach(async () => {
  vi.resetModules();
  db._reset();
  settingsRoutes = (await import("../src/routes/settings.routes")).settingsRoutes;
});

describe("settingsRoutes", () => {
  const app = () => appWithUser(settingsRoutes, user);

  it("GET / returns 401 when not authenticated", async () => {
    const res = await request(appWithUser(settingsRoutes, null), "GET", "/");
    expect(res.status).toBe(401);
  });

  it("GET / creates default settings when none exist", async () => {
    db._queueGet(undefined);
    db._queueReturning([{ theme: "light", markReadOnOpen: true, dateFormat: "relative" }]);
    const res = await request(app(), "GET", "/");
    expect(res.status).toBe(200);
    expect(res.data).toEqual({ theme: "light", markReadOnOpen: true, dateFormat: "relative" });
  });

  it("GET / returns existing settings", async () => {
    db._queueGet({ theme: "dark", markReadOnOpen: false, dateFormat: "long" });
    const res = await request(app(), "GET", "/");
    expect(res.status).toBe(200);
    expect(res.data).toEqual({ theme: "dark", markReadOnOpen: false, dateFormat: "long" });
  });

  it("PUT / updates existing settings", async () => {
    db._queueGet({ theme: "light", markReadOnOpen: true });
    const res = await request(app(), "PUT", "/", { theme: "dark", markReadOnOpen: false });
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
  });

  it("PUT / creates settings when none exist", async () => {
    db._queueGet(undefined);
    const res = await request(app(), "PUT", "/", { theme: "sepia" });
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
  });

  it("PUT / with no fields still succeeds", async () => {
    db._queueGet({ theme: "light", markReadOnOpen: true });
    const res = await request(app(), "PUT", "/", {});
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
  });
});