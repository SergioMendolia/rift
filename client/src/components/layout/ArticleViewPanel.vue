<script setup lang="ts">
import { computed } from "vue";
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

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

function toggleSaved() {
  if (article.value) {
    articlesStore.toggleSaved(article.value.id, !article.value.saved);
  }
}

function markUnread() {
  if (article.value) {
    articlesStore.markRead(article.value.id, false);
  }
}

function openOriginal() {
  if (article.value?.link) {
    window.open(article.value.link, "_blank");
  }
}
</script>

<template>
  <div class="article-view">
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
          class="btn"
          :class="{ 'btn-primary': article.saved }"
          @click="toggleSaved"
        >
          {{ article.saved ? "Saved" : "Save" }}
        </button>
        <button class="btn" @click="markUnread" title="Mark as unread">
          Mark Unread
        </button>
        <button class="btn" @click="openOriginal" title="Open original">
          Open Original
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
    </template>
  </div>
</template>