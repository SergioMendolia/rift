import { describe, it, expect, vi, beforeEach } from "vitest";

const selectChain = {
  from: vi.fn(() => selectChain),
  where: vi.fn(() => selectChain),
  all: vi.fn(() => []),
};

const deleteChain = {
  where: vi.fn(() => ({})),
};

const db = {
  select: vi.fn(() => selectChain),
  delete: vi.fn(() => deleteChain),
};

vi.mock("../src/db/connection", () => ({
  db,
  schema: {
    feeds: { id: "feeds.id", feedUrl: "feeds.feed_url" },
    articles: { id: "articles.id", publishedAt: "articles.published_at" },
    userArticles: { articleId: "user_articles.article_id", saved: "user_articles.saved" },
  },
}));

vi.mock("../src/env", () => ({
  env: {
    pollCron: "*/30 * * * *",
    cleanupCron: "0 3 * * *",
    userAgent: "Rift/test",
  },
}));

vi.mock("../src/services/feed-service", () => ({
  refreshFeed: vi.fn(),
}));

let cleanupOldArticles: (cutoff: string) => Promise<number>;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  selectChain.all.mockReturnValue([]);
  db.delete.mockReturnValue(deleteChain);
  deleteChain.where.mockReturnValue({});
  const mod = await import("../src/lib/cron");
  cleanupOldArticles = mod.cleanupOldArticles as typeof cleanupOldArticles;
});

describe("cleanupOldArticles", () => {
  it("returns 0 when there are no stale articles", async () => {
    selectChain.all.mockReturnValueOnce([]); // stale
    const n = await cleanupOldArticles("2025-01-01");
    expect(n).toBe(0);
    expect(db.delete).not.toHaveBeenCalled();
  });

  it("deletes stale, unsaved articles and returns the count", async () => {
    selectChain.all.mockReturnValueOnce([{ id: 1 }, { id: 2 }, { id: 3 }]); // stale
    selectChain.all.mockReturnValueOnce([{ articleId: 2 }]); // saved
    const n = await cleanupOldArticles("2025-01-01");
    expect(n).toBe(2); // ids 1 and 3 deleted, 2 saved
    expect(db.delete).toHaveBeenCalledTimes(1);
  });

  it("returns 0 when all stale articles are saved", async () => {
    selectChain.all.mockReturnValueOnce([{ id: 1 }]);
    selectChain.all.mockReturnValueOnce([{ articleId: 1 }]);
    const n = await cleanupOldArticles("2025-01-01");
    expect(n).toBe(0);
    expect(db.delete).not.toHaveBeenCalled();
  });

  it("deletes in batches of 500", async () => {
    const stale = Array.from({ length: 750 }, (_, i) => ({ id: i + 1 }));
    selectChain.all.mockReturnValueOnce(stale);
    selectChain.all.mockReturnValueOnce([]);
    const n = await cleanupOldArticles("2025-01-01");
    expect(n).toBe(750);
    expect(db.delete).toHaveBeenCalledTimes(2);
  });
});