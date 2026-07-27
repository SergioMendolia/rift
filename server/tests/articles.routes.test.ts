import { describe, it, expect, vi, beforeEach } from "vitest";
import type { UserDTO } from "@rift/shared";
import { makeMockDb, appWithUser, request } from "./_helpers";

const { db, schema } = makeMockDb();
vi.mock("../src/db/connection", () => ({ db, schema }));

const user: UserDTO = { id: 1, email: "a@b.com", displayName: "A", isAdmin: true };

let articleRoutes: any;

beforeEach(async () => {
  vi.resetModules();
  db._reset();
  articleRoutes = (await import("../src/routes/articles.routes")).articleRoutes;
});

function makeArticleRow(id: number, feedId = 1): any {
  return {
    article: {
      id, feedId, guid: `g${id}`, title: `T${id}`, link: `https://${id}`,
      author: null, summary: null, content: null, publishedAt: `2024-01-${String(id).padStart(2, "0")}`,
    },
    userArticle: { read: false, saved: false },
    feedTitle: "Blog",
  };
}

describe("articleRoutes", () => {
  const app = () => appWithUser(articleRoutes, user);

  it("GET / returns 401 when not authenticated", async () => {
    const res = await request(appWithUser(articleRoutes, null), "GET", "/");
    expect(res.status).toBe(401);
  });

  it("GET / returns articles list", async () => {
    db._queueAll([makeArticleRow(1), makeArticleRow(2)]);
    const res = await request(app(), "GET", "/");
    expect(res.status).toBe(200);
    expect(res.data.articles).toHaveLength(2);
    expect(res.data.articles[0]).toMatchObject({ id: 1, feedTitle: "Blog" });
    expect(res.data.nextCursor).toBeNull();
  });

  it("GET / returns nextCursor when more results exist", async () => {
    // 51 rows for limit 50 -> hasMore
    const rows = Array.from({ length: 51 }, (_, i) => makeArticleRow(i + 1));
    db._queueAll(rows);
    const res = await request(app(), "GET", "/?limit=50");
    expect(res.data.articles).toHaveLength(50);
    expect(res.data.nextCursor).toBe(50);
  });

  it("GET / respects limit param", async () => {
    db._queueAll([makeArticleRow(1), makeArticleRow(2)]);
    const res = await request(app(), "GET", "/?limit=2");
    expect(res.data.articles).toHaveLength(2);
  });

  it("GET / with folderId returns empty when folder has no subscriptions", async () => {
    db._queueAll([]);
    const res = await request(app(), "GET", "/?folderId=9");
    expect(res.status).toBe(200);
    expect(res.data.articles).toEqual([]);
    expect(res.data.nextCursor).toBeNull();
  });

  it("GET / with folderId returns articles when folder has subs", async () => {
    db._queueAll([{ feedId: 3 }]); // folderSubs
    db._queueAll([makeArticleRow(1, 3), makeArticleRow(2, 3)]);
    const res = await request(app(), "GET", "/?folderId=1");
    expect(res.data.articles).toHaveLength(2);
  });

  it("GET /?saved=true filters to saved articles", async () => {
    db._queueAll([makeArticleRow(1)]);
    const res = await request(app(), "GET", "/?saved=true");
    expect(res.data.articles).toHaveLength(1);
  });

  it("GET /?read=true filters to read articles", async () => {
    db._queueAll([makeArticleRow(1)]);
    const res = await request(app(), "GET", "/?read=true");
    expect(res.data.articles).toHaveLength(1);
  });

  it("GET /?q= applies a search filter", async () => {
    db._queueAll([makeArticleRow(1), makeArticleRow(2)]);
    const res = await request(app(), "GET", "/?q=hello+world");
    expect(res.status).toBe(200);
    expect(res.data.articles).toHaveLength(2);
  });

  it("GET /?q= does not force hideRead when searching", async () => {
    db._queueAll([makeArticleRow(1)]);
    const res = await request(app(), "GET", "/?q=test");
    expect(res.status).toBe(200);
    expect(res.data.articles).toHaveLength(1);
  });

  it("GET /:id returns 404 when article not found", async () => {
    const res = await request(app(), "GET", "/999");
    expect(res.status).toBe(404);
    expect(res.data.error).toBe("Article not found");
  });

  it("GET /:id returns the article", async () => {
    db._queueGet(makeArticleRow(5));
    const res = await request(app(), "GET", "/5");
    expect(res.status).toBe(200);
    expect(res.data.id).toBe(5);
    expect(res.data.feedTitle).toBe("Blog");
  });

  it("PUT /:id returns 404 when user_article not found", async () => {
    db._queueGet(undefined);
    const res = await request(app(), "PUT", "/5", { read: true });
    expect(res.status).toBe(404);
    expect(res.data.error).toBe("Article not found");
  });

  it("PUT /:id marks as read", async () => {
    db._queueGet({ id: 10, userId: 1, articleId: 5, read: false, saved: false });
    const res = await request(app(), "PUT", "/5", { read: true });
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
  });

  it("PUT /:id marks as unread (clears readAt)", async () => {
    db._queueGet({ id: 10, read: true, saved: false });
    const res = await request(app(), "PUT", "/5", { read: false });
    expect(res.status).toBe(200);
  });

  it("PUT /:id toggles saved", async () => {
    db._queueGet({ id: 10, read: false, saved: false });
    const res = await request(app(), "PUT", "/5", { saved: true });
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
  });

  it("PUT /:id with empty body still succeeds", async () => {
    db._queueGet({ id: 10, read: false, saved: false });
    const res = await request(app(), "PUT", "/5", {});
    expect(res.status).toBe(200);
  });
});