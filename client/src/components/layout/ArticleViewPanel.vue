<script setup lang="ts">
import { computed, ref } from "vue";
import { useArticlesStore } from "../../stores/articles";

const props = defineProps<{
  showBack?: boolean;
}>();

const emit = defineEmits<{
  back: [];
  next: [];
}>();

const articlesStore = useArticlesStore();
const article = computed(() => articlesStore.currentArticle);
const hasNext = computed(() => {
  const articles = articlesStore.articles;
  const idx = articles.findIndex((a) => a.id === article.value?.id);
  return idx >= 0 && idx < articles.length - 1;
});

const swipeOffset = ref(0);
const swipeTriggered = ref(false);
let startY = 0;
let isSwiping = false;
const TRIGGER_THRESHOLD = 80;
const MAX_PULL = 120;

function onTouchStart(e: TouchEvent) {
  const el = e.currentTarget as HTMLElement;
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 4) {
    startY = e.touches[0].clientY;
    isSwiping = true;
    swipeTriggered.value = false;
  } else {
    isSwiping = false;
  }
}

function onTouchMove(e: TouchEvent) {
  if (!isSwiping) return;
  const delta = startY - e.touches[0].clientY;
  if (delta > 0) {
    e.preventDefault();
    swipeOffset.value = Math.min(delta, MAX_PULL);
    swipeTriggered.value = swipeOffset.value >= TRIGGER_THRESHOLD;
  }
}

function vibrate(ms: number = 10) {
  if (navigator.vibrate) navigator.vibrate(ms);
}

function onTouchEnd() {
  if (!isSwiping) return;
  isSwiping = false;
  if (swipeOffset.value >= TRIGGER_THRESHOLD && hasNext.value) {
    vibrate(15);
    emit("next");
  }
  swipeOffset.value = 0;
  swipeTriggered.value = false;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

function toggleSaved() {
  if (article.value) {
    articlesStore.toggleSaved(article.value.id, !article.value.saved);
  }
}

function toggleRead() {
  if (article.value) {
    vibrate(10);
    articlesStore.markRead(article.value.id, !article.value.read);
  }
}

function openOriginal() {
  if (article.value?.link) {
    window.open(article.value.link, "_blank");
  }
}

async function share() {
  if (!article.value) return;
  const shareData = {
    title: article.value.title,
    text: article.value.summary ?? article.value.title,
    url: article.value.link,
  };
  if (navigator.share) {
    try {
      await navigator.share(shareData);
    } catch {}
  } else {
    try {
      await navigator.clipboard.writeText(article.value.link);
      alert("Link copied to clipboard");
    } catch {}
  }
}
</script>

<template>
  <div
    class="article-view"
    :class="{ 'swipe-active': swipeOffset > 0 }"
    @touchstart="onTouchStart"
    @touchmove.passive="false"
    @touchmove="onTouchMove"
    @touchend="onTouchEnd"
  >
    <div
      class="pull-indicator"
      :class="{ 'pull-triggered': swipeTriggered, 'pull-hidden': swipeOffset === 0 }"
      :style="{ transform: `translateY(${120 - swipeOffset}px)` }"
    >
      <svg v-if="swipeTriggered" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>
      <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
      <span>{{ swipeTriggered ? "Release for next" : "Pull for next" }}</span>
    </div>
    <div v-if="!article" class="empty-state">
      <div class="icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
          <path d="M18 14h-8M15 18h-5M10 6h8v4h-8z" />
        </svg>
      </div>
      <p>Select an article to read</p>
    </div>
    <template v-else>
      <div class="article-header">
        <div class="article-feed">{{ article.feedTitle }}</div>
        <h1 class="article-title">{{ article.title }}</h1>
        <div class="article-meta">
          <span v-if="article.author">{{ article.author }}</span>
          <span>{{ formatTime(article.publishedAt) }}</span>
        </div>
      </div>
      <div class="article-actions">
        <button
          v-if="props.showBack"
          class="btn mobile-back-btn"
          @click="emit('back')"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          List
        </button>
        <button
          class="btn btn-icon"
          :class="{ 'btn-primary': article.saved }"
          @click="toggleSaved"
          :title="article.saved ? 'Remove from saved' : 'Save for later'"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        </button>
        <button
          class="btn btn-icon"
          :class="{ 'btn-primary': !article.read }"
          @click="toggleRead"
          :title="article.read ? 'Mark as unread' : 'Mark as read'"
        >
          <svg v-if="article.read" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
        </button>
        <button
          v-if="props.showBack"
          class="btn"
          @click="share"
          title="Share"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
          </svg>
        </button>
        <button
          v-if="props.showBack && hasNext"
          class="btn btn-primary mobile-next-btn"
          @click="emit('next')"
          title="Next article"
        >
          Next
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
      <div class="article-content" v-html="article.content ?? article.summary"></div>
      <div class="article-footer">
        <button class="btn" @click="openOriginal" title="Open original article">
          Read Original
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <path d="M15 3h6v6M10 14L21 3" />
          </svg>
        </button>
      </div>
    </template>
  </div>
</template>