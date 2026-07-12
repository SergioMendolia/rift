<script setup lang="ts">
import { computed, ref } from "vue";
import { useArticlesStore } from "../../stores/articles";
import { useFeedsStore } from "../../stores/feeds";

const props = defineProps<{
  showBack?: boolean;
}>();

const emit = defineEmits<{
  selectArticle: [id: number];
  showSidebar: [];
}>();

const articlesStore = useArticlesStore();
const feedsStore = useFeedsStore();

const articles = computed(() => articlesStore.articles);

const SWIPE_THRESHOLD = 60;
const SWIPE_MAX = 80;

const swipeId = ref<number | null>(null);
const swipeOffset = ref(0);
let startX = 0;
let startY = 0;
let isSwiping = false;
let isHorizontal = false;

function onTouchStart(e: TouchEvent, articleId: number) {
  startX = e.touches[0].clientX;
  startY = e.touches[0].clientY;
  isSwiping = true;
  isHorizontal = false;
  swipeId.value = articleId;
  swipeOffset.value = 0;
}

function onTouchMove(e: TouchEvent) {
  if (!isSwiping) return;
  const dx = e.touches[0].clientX - startX;
  const dy = e.touches[0].clientY - startY;

  if (!isHorizontal) {
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return;
    isHorizontal = Math.abs(dx) > Math.abs(dy);
    if (!isHorizontal) {
      isSwiping = false;
      swipeId.value = null;
      swipeOffset.value = 0;
      return;
    }
  }

  if (isHorizontal && dx > 0) {
    e.preventDefault();
    swipeOffset.value = Math.min(dx, SWIPE_MAX);
  }
}

function onTouchEnd(articleId: number) {
  if (!isSwiping || !isHorizontal) {
    isSwiping = false;
    swipeId.value = null;
    swipeOffset.value = 0;
    return;
  }

  const article = articles.value.find((a) => a.id === articleId);
  if (swipeOffset.value >= SWIPE_THRESHOLD && article) {
    if (navigator.vibrate) navigator.vibrate(10);
    articlesStore.markRead(articleId, !article.read);
  }

  isSwiping = false;
  swipeId.value = null;
  swipeOffset.value = 0;
}

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

async function refreshAll() {
  await feedsStore.refreshAll();
  await articlesStore.loadArticles(true);
}
</script>

<template>
  <div class="article-list">
    <div class="article-list-header">
      <button
        v-if="props.showBack"
        class="btn btn-ghost btn-icon mobile-back-btn"
        title="Feeds"
        @click="emit('showSidebar')"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 12h18M3 6h18M3 18h18" />
        </svg>
      </button>
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
          @click="refreshAll()"
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
        class="article-card-wrapper"
        @touchstart.passive="onTouchStart($event, article.id)"
        @touchmove.passive="false"
        @touchmove="onTouchMove"
        @touchend="onTouchEnd(article.id)"
      >
        <div class="article-card-swipe-bg" :class="{ 'swipe-read': article.read, 'swipe-unread': !article.read, 'swipe-visible': swipeId === article.id && swipeOffset > 0 }">
          <svg v-if="article.read" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
          </svg>
          <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
        </div>
        <div
          class="article-card"
          :class="{ read: article.read, active: articlesStore.currentArticle?.id === article.id, 'swipe-active': swipeId === article.id }"
          :style="swipeId === article.id ? { transform: `translateX(${swipeOffset}px)` } : {}"
          @click="swipeId === article.id ? null : emit('selectArticle', article.id)"
        >
          <div class="feed-name">{{ article.feedTitle }}</div>
          <div class="title">{{ article.title }}</div>
          <div v-if="article.summary" class="summary">{{ article.summary }}</div>
          <div class="meta">
            <span>{{ formatTime(article.publishedAt) }}</span>
            <span v-if="article.saved" class="saved-indicator">Saved</span>
          </div>
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