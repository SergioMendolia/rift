import { defineStore } from "pinia";
import { ref } from "vue";
import type { ArticleDTO, ArticleListResponse } from "@rift/shared";
import { useAuthStore } from "./auth";
import { useFeedsStore } from "./feeds";

export type ArticleFilter =
  | { type: "all" }
  | { type: "saved" }
  | { type: "feed"; feedId: number }
  | { type: "folder"; folderId: number }
  | { type: "tag"; tagId: number };

export const useArticlesStore = defineStore("articles", () => {
  const articles = ref<ArticleDTO[]>([]);
  const currentArticle = ref<ArticleDTO | null>(null);
  const nextCursor = ref<number | null>(null);
  const loading = ref(false);
  const currentFilter = ref<ArticleFilter>({ type: "all" });
  const hideRead = ref(true);

  async function loadArticles(reset = false) {
    const auth = useAuthStore();
    loading.value = true;

    const params = new URLSearchParams();
    params.set("limit", "50");

    if (currentFilter.value.type === "feed") {
      params.set("feedId", String(currentFilter.value.feedId));
    } else if (currentFilter.value.type === "folder") {
      params.set("folderId", String(currentFilter.value.folderId));
    } else if (currentFilter.value.type === "saved") {
      params.set("saved", "true");
    }

    if (hideRead.value) {
      params.set("hideRead", "true");
    } else {
      params.set("hideRead", "false");
    }

    if (!reset && nextCursor.value) {
      params.set("cursor", String(nextCursor.value));
    }

    const res = await fetch(`/api/articles?${params}`, {
      headers: auth.authHeaders(),
    });

    if (res.ok) {
      const data: ArticleListResponse = await res.json();
      if (reset) {
        articles.value = data.articles;
      } else {
        articles.value = [...articles.value, ...data.articles];
      }
      nextCursor.value = data.nextCursor;
    }

    loading.value = false;
  }

  async function selectArticle(article: ArticleDTO) {
    currentArticle.value = article;
    if (!article.read) {
      await markRead(article.id, true);
      article.read = true;
    }
  }

  async function loadArticle(id: number): Promise<ArticleDTO | null> {
    const auth = useAuthStore();
    const res = await fetch(`/api/articles/${id}`, {
      headers: auth.authHeaders(),
    });
    if (res.ok) {
      const article = await res.json();
      currentArticle.value = article;
      if (!article.read) {
        await markRead(article.id, true);
        article.read = true;
      }
      return article;
    }
    return null;
  }

  async function markRead(articleId: number, read: boolean) {
    const auth = useAuthStore();
    const article = articles.value.find((a) => a.id === articleId);
    const wasRead = article?.read ?? false;
    if (wasRead === read) return;

    await fetch(`/api/articles/${articleId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...auth.authHeaders() },
      body: JSON.stringify({ read }),
    });

    if (article) {
      article.read = read;
    }
    if (currentArticle.value?.id === articleId) {
      currentArticle.value.read = read;
    }

    const feedsStore = useFeedsStore();
    const feedId = article?.feedId ?? currentArticle.value?.feedId;
    if (feedId !== undefined) {
      const feed = feedsStore.feeds.find((f) => f.id === feedId);
      if (feed) {
        feed.unreadCount = Math.max(0, feed.unreadCount + (read ? -1 : 1));
      }
    }
  }

  async function toggleSaved(articleId: number, saved: boolean) {
    const auth = useAuthStore();
    await fetch(`/api/articles/${articleId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...auth.authHeaders() },
      body: JSON.stringify({ saved }),
    });
    const article = articles.value.find((a) => a.id === articleId);
    if (article) {
      article.saved = saved;
    }
    if (currentArticle.value?.id === articleId) {
      currentArticle.value.saved = saved;
    }
  }

  function setFilter(filter: ArticleFilter) {
    currentFilter.value = filter;
    articles.value = [];
    nextCursor.value = null;
    currentArticle.value = null;
    return loadArticles(true);
  }

  function setHideRead(value: boolean) {
    hideRead.value = value;
    articles.value = [];
    nextCursor.value = null;
    currentArticle.value = null;
    return loadArticles(true);
  }

  return {
    articles,
    currentArticle,
    nextCursor,
    loading,
    currentFilter,
    hideRead,
    loadArticles,
    selectArticle,
    loadArticle,
    markRead,
    toggleSaved,
    setFilter,
    setHideRead,
  };
});