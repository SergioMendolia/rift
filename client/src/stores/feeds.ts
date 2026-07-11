import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { FeedDTO, FolderDTO } from "@rift/shared";
import { useAuthStore } from "./auth";

export const useFeedsStore = defineStore("feeds", () => {
  const folders = ref<FolderDTO[]>([]);
  const feeds = ref<FeedDTO[]>([]);
  const loading = ref(false);

  const totalUnread = computed(() =>
    feeds.value.reduce((sum, f) => sum + f.unreadCount, 0),
  );

  const savedCount = ref(0);

  const feedsByFolder = computed(() => {
    const map = new Map<number | null, FeedDTO[]>();
    for (const feed of feeds.value) {
      const key = feed.folderId;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(feed);
    }
    return map;
  });

  async function fetchFeeds() {
    const auth = useAuthStore();
    loading.value = true;
    try {
      const res = await fetch("/api/feeds", { headers: auth.authHeaders() });
      if (res.ok) {
        feeds.value = await res.json();
      }
    } finally {
      loading.value = false;
    }
  }

  async function fetchFolders() {
    const auth = useAuthStore();
    const res = await fetch("/api/folders", { headers: auth.authHeaders() });
    if (res.ok) {
      folders.value = await res.json();
    }
  }

  async function addFeed(url: string, folderId: number | null = null) {
    const auth = useAuthStore();
    const res = await fetch("/api/feeds", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth.authHeaders() },
      body: JSON.stringify({ url, folderId }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? "Failed to add feed");
    }
    await fetchFeeds();
    return await res.json();
  }

  async function removeFeed(feedId: number) {
    const auth = useAuthStore();
    await fetch(`/api/feeds/${feedId}`, {
      method: "DELETE",
      headers: auth.authHeaders(),
    });
    await fetchFeeds();
  }

  async function addFolder(name: string) {
    const auth = useAuthStore();
    const res = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth.authHeaders() },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      await fetchFolders();
    }
  }

  async function refreshFeed(feedId: number) {
    const auth = useAuthStore();
    await fetch(`/api/feeds/${feedId}/refresh`, {
      method: "POST",
      headers: auth.authHeaders(),
    });
    await fetchFeeds();
  }

  async function refreshAll() {
    const auth = useAuthStore();
    await fetch("/api/feeds/refresh-all", {
      method: "POST",
      headers: auth.authHeaders(),
    });
    await fetchFeeds();
  }

  async function importOpml(file: File) {
    const auth = useAuthStore();
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/opml/import", {
      method: "POST",
      headers: auth.authHeaders(),
      body: formData,
    });
    if (!res.ok) throw new Error("Import failed");
    const data = await res.json();
    await fetchFeeds();
    await fetchFolders();
    return data.imported as number;
  }

  async function exportOpml() {
    const auth = useAuthStore();
    const res = await fetch("/api/opml/export", {
      headers: auth.authHeaders(),
    });
    if (!res.ok) throw new Error("Export failed");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "rift-subscriptions.opml";
    a.click();
    URL.revokeObjectURL(url);
  }

  return {
    folders,
    feeds,
    loading,
    totalUnread,
    savedCount,
    feedsByFolder,
    fetchFeeds,
    fetchFolders,
    addFeed,
    removeFeed,
    addFolder,
    refreshFeed,
    refreshAll,
    importOpml,
    exportOpml,
  };
});