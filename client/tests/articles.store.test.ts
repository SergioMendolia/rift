import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  setActivePinia(createPinia());
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  localStorage.clear();
});

function jsonResponse(body: any, ok = true, status = 200) {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) };
}

async function setupAuth() {
  const { useAuthStore } = await import("../src/stores/auth");
  const auth = useAuthStore();
  auth.token = "tok";
  auth.user = { id: 1, email: "a@b.com", displayName: "A", isAdmin: true };
  return auth;
}

function makeArticle(id: number): any {
  return { id, feedId: 1, feedTitle: "Blog", guid: `g${id}`, title: `T${id}`, link: "", author: null, summary: null, content: null, publishedAt: "2024-01-01", read: false, saved: false };
}

describe("useArticlesStore", () => {
  it("loadArticles fetches with all filter and hideRead", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ articles: [makeArticle(1)], nextCursor: null }));
    const auth = await setupAuth();
    const { useArticlesStore } = await import("../src/stores/articles");
    const store = useArticlesStore();
    await store.loadArticles(true);
    expect(store.articles).toHaveLength(1);
    expect(store.loading).toBe(false);
    expect(fetchMock).toHaveBeenCalled();
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("limit=50");
    expect(url).toContain("hideRead=true");
  });

  it("loadArticles with feed filter sets feedId param", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ articles: [], nextCursor: null }));
    const auth = await setupAuth();
    const { useArticlesStore } = await import("../src/stores/articles");
    const store = useArticlesStore();
    store.currentFilter = { type: "feed", feedId: 5 };
    await store.loadArticles(true);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("feedId=5");
  });

  it("loadArticles with saved filter sets saved param and forces hideRead=false", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ articles: [], nextCursor: null }));
    const auth = await setupAuth();
    const { useArticlesStore } = await import("../src/stores/articles");
    const store = useArticlesStore();
    store.currentFilter = { type: "saved" };
    store.hideRead = true;
    await store.loadArticles(true);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("saved=true");
    expect(url).toContain("hideRead=false");
  });

  it("loadArticles appends when not reset", async () => {
    const auth = await setupAuth();
    const { useArticlesStore } = await import("../src/stores/articles");
    const store = useArticlesStore();
    store.articles = [makeArticle(1)];
    store.nextCursor = 10;
    fetchMock.mockResolvedValueOnce(jsonResponse({ articles: [makeArticle(2)], nextCursor: null }));
    await store.loadArticles(false);
    expect(store.articles).toHaveLength(2);
  });

  it("loadArticle sets current article and marks read", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(makeArticle(5)));
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true }));
    const auth = await setupAuth();
    const { useArticlesStore } = await import("../src/stores/articles");
    const store = useArticlesStore();
    const art = await store.loadArticle(5);
    expect(art?.id).toBe(5);
    expect(store.currentArticle?.id).toBe(5);
  });

  it("loadArticle returns null on non-ok", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}, false, 404));
    const auth = await setupAuth();
    const { useArticlesStore } = await import("../src/stores/articles");
    const store = useArticlesStore();
    const art = await store.loadArticle(999);
    expect(art).toBeNull();
  });

  it("markRead updates article and decrements feed unread", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true }));
    const auth = await setupAuth();
    const { useArticlesStore } = await import("../src/stores/articles");
    const { useFeedsStore } = await import("../src/stores/feeds");
    const store = useArticlesStore();
    const feeds = useFeedsStore();
    feeds.feeds = [{ id: 1, title: "B", unreadCount: 5, feedUrl: "", siteUrl: null, faviconUrl: null, lastFetchedAt: null, lastError: null, subscriptionId: 1, folderId: null, displayName: null }];
    store.articles = [makeArticle(1)];
    await store.markRead(1, true);
    expect(store.articles[0].read).toBe(true);
    expect(feeds.feeds[0].unreadCount).toBe(4);
  });

  it("markRead does not refetch when state unchanged", async () => {
    const auth = await setupAuth();
    const { useArticlesStore } = await import("../src/stores/articles");
    const store = useArticlesStore();
    store.articles = [{ ...makeArticle(1), read: true }];
    await store.markRead(1, true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("toggleSaved updates saved state", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true }));
    const auth = await setupAuth();
    const { useArticlesStore } = await import("../src/stores/articles");
    const store = useArticlesStore();
    store.articles = [makeArticle(1)];
    await store.toggleSaved(1, true);
    expect(store.articles[0].saved).toBe(true);
  });

  it("selectArticle marks unread article as read", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true }));
    const auth = await setupAuth();
    const { useArticlesStore } = await import("../src/stores/articles");
    const { useFeedsStore } = await import("../src/stores/feeds");
    const store = useArticlesStore();
    const feeds = useFeedsStore();
    feeds.feeds = [{ id: 1, title: "B", unreadCount: 1, feedUrl: "", siteUrl: null, faviconUrl: null, lastFetchedAt: null, lastError: null, subscriptionId: 1, folderId: null, displayName: null }];
    const art = makeArticle(1);
    store.articles = [art];
    await store.selectArticle(art);
    expect(store.currentArticle?.id).toBe(1);
    expect(store.articles[0].read).toBe(true);
  });

  it("setFilter resets and loads", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ articles: [makeArticle(1)], nextCursor: null }));
    const auth = await setupAuth();
    const { useArticlesStore } = await import("../src/stores/articles");
    const store = useArticlesStore();
    store.articles = [makeArticle(99)];
    await store.setFilter({ type: "saved" });
    expect(store.currentFilter.type).toBe("saved");
    expect(store.articles).toHaveLength(1);
    expect(store.articles[0].id).toBe(1);
  });

  it("setHideRead resets and loads", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ articles: [], nextCursor: null }));
    const auth = await setupAuth();
    const { useArticlesStore } = await import("../src/stores/articles");
    const store = useArticlesStore();
    store.articles = [makeArticle(1)];
    await store.setHideRead(false);
    expect(store.hideRead).toBe(false);
    expect(store.articles).toHaveLength(0);
  });

  it("setSearchQuery sets q param and reloads", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ articles: [makeArticle(1)], nextCursor: null }));
    const auth = await setupAuth();
    const { useArticlesStore } = await import("../src/stores/articles");
    const store = useArticlesStore();
    await store.setSearchQuery("vue tips");
    expect(store.searchQuery).toBe("vue tips");
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("q=vue+tips");
    expect(store.articles).toHaveLength(1);
  });

  it("clearSearch empties the query and reloads", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ articles: [], nextCursor: null }));
    const auth = await setupAuth();
    const { useArticlesStore } = await import("../src/stores/articles");
    const store = useArticlesStore();
    store.searchQuery = "old";
    await store.clearSearch();
    expect(store.searchQuery).toBe("");
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).not.toContain("q=");
  });

  it("loadArticles sends q when searchQuery is set", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ articles: [], nextCursor: null }));
    const auth = await setupAuth();
    const { useArticlesStore } = await import("../src/stores/articles");
    const store = useArticlesStore();
    store.searchQuery = "rust";
    await store.loadArticles(true);
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("q=rust");
  });
});