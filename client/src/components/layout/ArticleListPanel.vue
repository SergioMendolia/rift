<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useArticlesStore } from "../../stores/articles";
import { useFeedsStore } from "../../stores/feeds";
import { useFormatDate } from "../../composables/useFormatDate";
import { filterFromRoute, filterArticlePath } from "../../composables/useNav";

const props = defineProps<{
  showBack?: boolean;
}>();

const emit = defineEmits<{
  showSidebar: [];
}>();

const articlesStore = useArticlesStore();
const feedsStore = useFeedsStore();
const router = useRouter();
const route = useRoute();
const { formatDate } = useFormatDate();

const articles = computed(() => articlesStore.articles);

const SWIPE_THRESHOLD = 60;
const SWIPE_MAX = 80;

const swipeId = ref<number | null>(null);
const swipeOffset = ref(0);
let startX = 0;
let startY = 0;
let isSwiping = false;
let isHorizontal = false;

const searchInput = ref("");
let searchDebounce: ReturnType<typeof setTimeout> | null = null;

function onSearchInput() {
  if (searchDebounce) clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    articlesStore.setSearchQuery(searchInput.value);
  }, 300);
}

function clearSearch() {
  searchInput.value = "";
  if (searchDebounce) clearTimeout(searchDebounce);
  articlesStore.clearSearch();
}

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

// --- Pull-to-refresh ---
const pullDistance = ref(0);
const pullRefreshing = ref(false);
const PULL_THRESHOLD = 70;
const PULL_MAX = 100;
let pullStartY = 0;
let pullActive = false;
const listContent = ref<HTMLElement | null>(null);

function onContentTouchStart(e: TouchEvent) {
  if (pullRefreshing.value) return;
  const el = listContent.value;
  if (!el || el.scrollTop > 0) {
    pullActive = false;
    return;
  }
  pullStartY = e.touches[0].clientY;
  pullActive = true;
}

function onContentTouchMove(e: TouchEvent) {
  if (!pullActive || pullRefreshing.value) return;
  const el = listContent.value;
  if (!el || el.scrollTop > 0) {
    pullActive = false;
    pullDistance.value = 0;
    return;
  }
  const dy = e.touches[0].clientY - pullStartY;
  if (dy <= 0) {
    pullDistance.value = 0;
    return;
  }
  e.preventDefault();
  pullDistance.value = Math.min(dy * 0.5, PULL_MAX);
}

async function onContentTouchEnd() {
  if (!pullActive) return;
  pullActive = false;
  if (pullDistance.value >= PULL_THRESHOLD) {
    pullRefreshing.value = true;
    pullDistance.value = PULL_THRESHOLD;
    if (navigator.vibrate) navigator.vibrate(15);
    try {
      await refreshAll();
    } finally {
      pullRefreshing.value = false;
      pullDistance.value = 0;
    }
  } else {
    pullDistance.value = 0;
  }
}

const headerTitle = computed(() => {
  const filter = articlesStore.currentFilter;
  if (articlesStore.searchQuery) return `Search: "${articlesStore.searchQuery}"`;
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

function loadMore() {
  articlesStore.loadArticles(false);
}

function selectArticle(articleId: number) {
  const filter = filterFromRoute(route.name as string, route.params as Record<string, string>);
  router.push(filterArticlePath(filter, articleId));
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
          title="Refresh all feeds"
          @click="refreshAll()"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 2v6h-6M3 22v-6h6M3 12a9 9 0 0 1 15-6.7L21 8M21 12a9 9 0 0 1-15 6.7L3 16" />
          </svg>
        </button>
      </div>
    </div>
    <div class="article-search-bar">
      <input
        type="search"
        v-model="searchInput"
        placeholder="Search articles…"
        @input="onSearchInput"
        @keyup.enter="onSearchInput"
      />
      <button
        v-if="searchInput"
        class="btn btn-ghost btn-icon search-clear"
        title="Clear search"
        @click="clearSearch"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
    <div
      ref="listContent"
      class="article-list-content"
      :style="{ transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : '', transition: pullActive ? 'none' : 'transform 200ms ease' }"
      @touchstart.passive="onContentTouchStart"
      @touchmove.passive="false"
      @touchmove="onContentTouchMove"
      @touchend="onContentTouchEnd"
      @touchcancel="onContentTouchEnd"
    >
      <div class="pull-to-refresh-indicator" :class="{ active: pullRefreshing }" :style="{ height: pullDistance + 'px', opacity: pullDistance > 0 ? 1 : 0 }">
        <svg v-if="!pullRefreshing" class="pull-arrow" :class="{ ready: pullDistance >= PULL_THRESHOLD }" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M19 12l-7 7-7-7" />
        </svg>
        <svg v-else class="pull-spinner" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      </div>
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
          @click="swipeId === article.id ? null : selectArticle(article.id)"
        >
          <div class="feed-name">{{ article.feedTitle }}</div>
          <div class="title">{{ article.title }}</div>
          <div v-if="article.summary" class="summary">{{ article.summary }}</div>
          <div class="meta">
            <span>{{ formatDate(article.publishedAt) }}</span>
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