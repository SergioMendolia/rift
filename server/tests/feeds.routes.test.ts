import { describe, it, expect, vi, beforeEach } from "vitest";
import type { UserDTO } from "@rift/shared";
import { makeMockDb, appWithUser, request } from "./_helpers";

const { db, schema } = makeMockDb();
vi.mock("../src/db/connection", () => ({ db, schema }));
vi.mock("../src/services/feed-service", () => ({
  subscribeToFeed: vi.fn(),
  refreshFeed: vi.fn(),
}));

const user: UserDTO = { id: 1, email: "a@b.com", displayName: "A", isAdmin: true };

let feedRoutes: any;
let feedService: any;

beforeEach(async () => {
  vi.resetModules();
  const mod = await import("../src/routes/feeds.routes");
  feedRoutes = mod.feedRoutes;
  feedService = await import("../src/services/feed-service");
  db._reset();
  feedService.subscribeToFeed.mockReset();
  feedService.refreshFeed.mockReset();
});

describe("feedRoutes", () => {
  const app = () => appWithUser(feedRoutes, user);

  it("GET / returns 401 when not authenticated", async () => {
    const a = appWithUser(feedRoutes, null);
    const res = await request(a, "GET", "/");
    expect(res.status).toBe(401);
    expect(res.data.error).toBe("Unauthorized");
  });

  it("GET / returns subscriptions with unread counts", async () => {
    db._queueAll([{ id: 10, feedId: 5, folderId: 2, displayName: null }]);
    db._queueAll([{ id: 5, title: "Blog", feedUrl: "https://f.xml", siteUrl: "https://b", faviconUrl: null, lastFetchedAt: null, lastError: null }]);
    db._queueAll([{ feedId: 5, count: 3 }]);

    const res = await request(app(), "GET", "/");
    expect(res.status).toBe(200);
    expect(res.data).toHaveLength(1);
    expect(res.data[0]).toMatchObject({
      id: 5,
      title: "Blog",
      subscriptionId: 10,
      folderId: 2,
      unreadCount: 3,
    });
  });

  it("POST / returns 400 when url is missing", async () => {
    const res = await request(app(), "POST", "/", { folderId: null });
    expect(res.status).toBe(400);
    expect(res.data.error).toBe("Missing feed URL");
  });

  it("POST / subscribes and returns 201", async () => {
    feedService.subscribeToFeed.mockResolvedValueOnce({ id: 5, title: "Blog" });
    const res = await request(app(), "POST", "/", { url: "https://example.com", folderId: 1 });
    expect(res.status).toBe(201);
    expect(res.data).toEqual({ id: 5, title: "Blog" });
    expect(feedService.subscribeToFeed).toHaveBeenCalledWith("https://example.com", 1, 1);
  });

  it("POST / returns 400 when subscribeToFeed throws", async () => {
    feedService.subscribeToFeed.mockRejectedValueOnce(new Error("bad feed"));
    const res = await request(app(), "POST", "/", { url: "https://x" });
    expect(res.status).toBe(400);
    expect(res.data.error).toBe("bad feed");
  });

  it("DELETE /:id returns 404 when no subscription exists", async () => {
    db._queueReturning([]);
    const res = await request(app(), "DELETE", "/5");
    expect(res.status).toBe(404);
    expect(res.data.error).toBe("Subscription not found");
  });

  it("DELETE /:id deletes subscription and user articles", async () => {
    db._queueReturning([{ id: 10 }]);
    db._queueAll([{ id: 100 }, { id: 101 }]);
    const res = await request(app(), "DELETE", "/5");
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
  });

  it("PUT /:id returns 404 when subscription not found", async () => {
    const res = await request(app(), "PUT", "/5", { displayName: "x" });
    expect(res.status).toBe(404);
    expect(res.data.error).toBe("Subscription not found");
  });

  it("PUT /:id updates subscription", async () => {
    db._queueGet({ id: 7 });
    const res = await request(app(), "PUT", "/5", { displayName: "New", folderId: 2 });
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
  });

  it("POST /:id/refresh returns 404 when subscription not found", async () => {
    const res = await request(app(), "POST", "/5/refresh");
    expect(res.status).toBe(404);
    expect(res.data.error).toBe("Subscription not found");
  });

  it("POST /:id/refresh refreshes the feed", async () => {
    db._queueGet({ id: 7 });
    feedService.refreshFeed.mockResolvedValueOnce(undefined);
    const res = await request(app(), "POST", "/5/refresh");
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(feedService.refreshFeed).toHaveBeenCalledWith(5);
  });

  it("POST /:id/refresh returns 500 when refreshFeed throws", async () => {
    db._queueGet({ id: 7 });
    feedService.refreshFeed.mockRejectedValueOnce(new Error("boom"));
    const res = await request(app(), "POST", "/5/refresh");
    expect(res.status).toBe(500);
    expect(res.data.error).toBe("boom");
  });

  it("POST /refresh-all refreshes all feeds", async () => {
    db._queueAll([{ feedId: 1 }, { feedId: 2 }, { feedId: 1 }]);
    feedService.refreshFeed.mockResolvedValue(undefined);
    const res = await request(app(), "POST", "/refresh-all");
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(feedService.refreshFeed).toHaveBeenCalledTimes(2);
  });
});