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

  async function updateFeed(feedId: number, changes: { displayName?: string | null; folderId?: number | null }) {
    const auth = useAuthStore();
    const res = await fetch(`/api/feeds/${feedId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...auth.authHeaders() },
      body: JSON.stringify(changes),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? "Failed to update feed");
    }
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

  async function updateFolder(folderId: number, name: string) {
    const auth = useAuthStore();
    const res = await fetch(`/api/folders/${folderId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...auth.authHeaders() },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? "Failed to rename folder");
    }
    await fetchFolders();
  }

  async function removeFolder(folderId: number) {
    const auth = useAuthStore();
    await fetch(`/api/folders/${folderId}`, {
      method: "DELETE",
      headers: auth.authHeaders(),
    });
    await fetchFolders();
    await fetchFeeds();
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
    updateFeed,
    addFolder,
    updateFolder,
    removeFolder,
    refreshFeed,
    refreshAll,
  };
});