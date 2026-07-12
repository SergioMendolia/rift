<script setup lang="ts">
import { computed } from "vue";
import { useArticlesStore } from "../../stores/articles";
import { useFeedsStore } from "../../stores/feeds";

const emit = defineEmits<{
  selectArticle: [id: number];
}>();

const articlesStore = useArticlesStore();
const feedsStore = useFeedsStore();

const articles = computed(() => articlesStore.articles);

const headerTitle = computed(() => {
  const filter = articlesStore.currentFilter;
  if (filter.type === "all") return "All Items";
  if (filter.type === "saved") return "Saved";
  if (filter.type === "feed") {
    const feed = feedsStore.feeds.find((f) => f.id === filter.feedId);
    return feed?.displayName ?? feed?.title ?? "Feed";
  }
  if (filter.type === "folder") {
    const folder = feedsStore.folders.find((f) => f.id === filter.folderId);
    return folder?.name ?? "Folder";
  }
  return "Articles";
});

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = diffMs / 3600000;
  if (diffH < 1) return "just now";
  if (diffH < 24) return `${Math.floor(diffH)}h ago`;
  const diffDays = diffH / 24;
  if (diffDays < 7) return `${Math.floor(diffDays)}d ago`;
  return d.toLocaleDateString();
}

function loadMore() {
  articlesStore.loadArticles(false);
}
</script>

<template>
  <div class="article-list">
    <div class="article-list-header">
      <h2>{{ headerTitle }}</h2>
      <div style="display: flex; gap: 2px; align-items: center;">
        <button
          class="btn btn-ghost btn-icon"
          :class="{ 'btn-primary': !articlesStore.hideRead }"
          :title="articlesStore.hideRead ? 'Showing unread only — click to show all' : 'Showing all — click to hide read'"
          @click="articlesStore.setHideRead(!articlesStore.hideRead)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
        <button
          class="btn btn-ghost btn-icon"
          title="Refresh all feeds"
          @click="feedsStore.refreshAll()"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 2v6h-6M3 22v-6h6M3 12a9 9 0 0 1 15-6.7L21 8M21 12a9 9 0 0 1-15 6.7L3 16" />
          </svg>
        </button>
      </div>
    </div>
    <div class="article-list-content">
      <div v-if="articles.length === 0 && !articlesStore.loading" class="empty-state">
        <div class="icon">No articles</div>
        <p>No articles to show here.</p>
      </div>
      <div
        v-for="article in articles"
        :key="article.id"
        class="article-card"
        :class="{ read: article.read, active: articlesStore.currentArticle?.id === article.id }"
        @click="emit('selectArticle', article.id)"
      >
        <div class="feed-name">{{ article.feedTitle }}</div>
        <div class="title">{{ article.title }}</div>
        <div v-if="article.summary" class="summary">{{ article.summary }}</div>
        <div class="meta">
          <span>{{ formatTime(article.publishedAt) }}</span>
          <span v-if="article.saved" class="saved-indicator">Saved</span>
        </div>
      </div>
      <button
        v-if="articlesStore.nextCursor"
        class="btn btn-ghost"
        style="width: 100%; justify-content: center;"
        @click="loadMore"
        :disabled="articlesStore.loading"
      >
        {{ articlesStore.loading ? "Loading..." : "Load more" }}
      </button>
    </div>
  </div>
</template>