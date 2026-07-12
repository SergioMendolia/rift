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

describe("useFeedsStore", () => {
  it("fetchFeeds sets feeds from response", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse([{ id: 1, title: "Blog", unreadCount: 3 }]),
    );
    const auth = await setupAuth();
    const { useFeedsStore } = await import("../src/stores/feeds");
    const feeds = useFeedsStore();
    await feeds.fetchFeeds();
    expect(feeds.feeds).toHaveLength(1);
    expect(feeds.feeds[0].title).toBe("Blog");
    expect(feeds.totalUnread).toBe(3);
    expect(feeds.loading).toBe(false);
  });

  it("fetchFeeds does nothing on non-ok response", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([], false, 401));
    const auth = await setupAuth();
    const { useFeedsStore } = await import("../src/stores/feeds");
    const feeds = useFeedsStore();
    feeds.feeds = [{ id: 9, title: "old", unreadCount: 0, feedUrl: "", siteUrl: null, faviconUrl: null, lastFetchedAt: null, lastError: null, subscriptionId: 1, folderId: null, displayName: null }];
    await feeds.fetchFeeds();
    expect(feeds.feeds).toHaveLength(1);
  });

  it("addFeed throws on error response", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "bad feed" }, false, 400));
    const auth = await setupAuth();
    const { useFeedsStore } = await import("../src/stores/feeds");
    const feeds = useFeedsStore();
    await expect(feeds.addFeed("https://x")).rejects.toThrow("bad feed");
  });

  it("addFeed adds and refreshes feed list", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 1, title: "New" }));
    fetchMock.mockResolvedValueOnce(jsonResponse([{ id: 1, title: "New", unreadCount: 0 }]));
    const auth = await setupAuth();
    const { useFeedsStore } = await import("../src/stores/feeds");
    const feeds = useFeedsStore();
    const result = await feeds.addFeed("https://x", null);
    expect(result.title).toBe("New");
    expect(feeds.feeds[0].title).toBe("New");
  });

  it("removeFeed deletes and refreshes", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true }));
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    const auth = await setupAuth();
    const { useFeedsStore } = await import("../src/stores/feeds");
    const feeds = useFeedsStore();
    feeds.feeds = [{ id: 5, title: "x", unreadCount: 0, feedUrl: "", siteUrl: null, faviconUrl: null, lastFetchedAt: null, lastError: null, subscriptionId: 1, folderId: null, displayName: null }];
    await feeds.removeFeed(5);
    expect(feeds.feeds).toHaveLength(0);
  });

  it("updateFeed throws on error", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "fail" }, false, 400));
    const auth = await setupAuth();
    const { useFeedsStore } = await import("../src/stores/feeds");
    const feeds = useFeedsStore();
    await expect(feeds.updateFeed(1, { displayName: "x" })).rejects.toThrow("fail");
  });

  it("updateFeed succeeds and refreshes", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true }));
    fetchMock.mockResolvedValueOnce(jsonResponse([{ id: 1, title: "B", unreadCount: 0 }]));
    const auth = await setupAuth();
    const { useFeedsStore } = await import("../src/stores/feeds");
    const feeds = useFeedsStore();
    await feeds.updateFeed(1, { displayName: "X" });
    expect(feeds.feeds[0].title).toBe("B");
  });

  it("fetchFolders sets folders", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([{ id: 1, name: "Tech", sortOrder: 0 }]));
    const auth = await setupAuth();
    const { useFeedsStore } = await import("../src/stores/feeds");
    const feeds = useFeedsStore();
    await feeds.fetchFolders();
    expect(feeds.folders).toHaveLength(1);
    expect(feeds.folders[0].name).toBe("Tech");
  });

  it("addFolder creates and refreshes folders", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 1, name: "New", sortOrder: 0 }, true, 201));
    fetchMock.mockResolvedValueOnce(jsonResponse([{ id: 1, name: "New", sortOrder: 0 }]));
    const auth = await setupAuth();
    const { useFeedsStore } = await import("../src/stores/feeds");
    const feeds = useFeedsStore();
    await feeds.addFolder("New");
    expect(feeds.folders[0].name).toBe("New");
  });

  it("updateFolder renames and refreshes", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true }));
    fetchMock.mockResolvedValueOnce(jsonResponse([{ id: 1, name: "Renamed", sortOrder: 0 }]));
    const auth = await setupAuth();
    const { useFeedsStore } = await import("../src/stores/feeds");
    const feeds = useFeedsStore();
    await feeds.updateFolder(1, "Renamed");
    expect(feeds.folders[0].name).toBe("Renamed");
  });

  it("updateFolder throws on error", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "no" }, false, 404));
    const auth = await setupAuth();
    const { useFeedsStore } = await import("../src/stores/feeds");
    const feeds = useFeedsStore();
    await expect(feeds.updateFolder(1, "X")).rejects.toThrow("no");
  });

  it("removeFolder deletes and refreshes", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true }));
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    const auth = await setupAuth();
    const { useFeedsStore } = await import("../src/stores/feeds");
    const feeds = useFeedsStore();
    feeds.folders = [{ id: 1, name: "x", sortOrder: 0 }];
    await feeds.removeFolder(1);
    expect(feeds.folders).toHaveLength(0);
  });

  it("feedsByFolder groups feeds by folderId", async () => {
    const auth = await setupAuth();
    const { useFeedsStore } = await import("../src/stores/feeds");
    const feeds = useFeedsStore();
    feeds.feeds = [
      { id: 1, title: "A", folderId: null, unreadCount: 0, feedUrl: "", siteUrl: null, faviconUrl: null, lastFetchedAt: null, lastError: null, subscriptionId: 1, displayName: null },
      { id: 2, title: "B", folderId: 1, unreadCount: 0, feedUrl: "", siteUrl: null, faviconUrl: null, lastFetchedAt: null, lastError: null, subscriptionId: 2, displayName: null },
      { id: 3, title: "C", folderId: 1, unreadCount: 0, feedUrl: "", siteUrl: null, faviconUrl: null, lastFetchedAt: null, lastError: null, subscriptionId: 3, displayName: null },
    ];
    const map = feeds.feedsByFolder;
    expect(map.get(null)).toHaveLength(1);
    expect(map.get(1)).toHaveLength(2);
  });

  it("refreshFeed posts and refreshes feed list", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true }));
    fetchMock.mockResolvedValueOnce(jsonResponse([{ id: 1, title: "B", unreadCount: 0 }]));
    const auth = await setupAuth();
    const { useFeedsStore } = await import("../src/stores/feeds");
    const feeds = useFeedsStore();
    await feeds.refreshFeed(1);
    expect(feeds.feeds[0].title).toBe("B");
  });

  it("refreshAll posts and refreshes feed list", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true }));
    fetchMock.mockResolvedValueOnce(jsonResponse([{ id: 1, title: "B", unreadCount: 0 }]));
    const auth = await setupAuth();
    const { useFeedsStore } = await import("../src/stores/feeds");
    const feeds = useFeedsStore();
    await feeds.refreshAll();
    expect(feeds.feeds[0].title).toBe("B");
  });
});