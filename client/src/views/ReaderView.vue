<script setup lang="ts">
import { onMounted, ref, computed, watch } from "vue";
import { useFeedsStore } from "../stores/feeds";
import { useArticlesStore, type ArticleFilter } from "../stores/articles";
import { useSettingsStore } from "../stores/settings";
import { useAuthStore } from "../stores/auth";
import Sidebar from "../components/layout/Sidebar.vue";
import ArticleListPanel from "../components/layout/ArticleListPanel.vue";
import ArticleViewPanel from "../components/layout/ArticleViewPanel.vue";

const feedsStore = useFeedsStore();
const articlesStore = useArticlesStore();
const settingsStore = useSettingsStore();
const auth = useAuthStore();

const collapsedFolders = ref<Set<number>>(new Set());

const currentArticle = computed(() => articlesStore.currentArticle);

const mobilePane = ref<"sidebar" | "list" | "article">("list");

function isMobile() {
  return window.innerWidth <= 768;
}

function selectFilter(filter: ArticleFilter) {
  articlesStore.setFilter(filter);
  if (isMobile()) mobilePane.value = "list";
}

function toggleFolder(id: number) {
  if (collapsedFolders.value.has(id)) {
    collapsedFolders.value.delete(id);
  } else {
    collapsedFolders.value.add(id);
  }
}

function selectArticle(articleId: number) {
  articlesStore.loadArticle(articleId);
  if (isMobile()) mobilePane.value = "article";
}

function showSidebar() {
  mobilePane.value = "sidebar";
}

function backToList() {
  mobilePane.value = "list";
}

function nextArticle() {
  const articles = articlesStore.articles;
  const currentIdx = articles.findIndex((a) => a.id === currentArticle.value?.id);
  if (currentIdx >= 0 && currentIdx < articles.length - 1) {
    selectArticle(articles[currentIdx + 1].id);
  }
}

watch(() => articlesStore.currentArticle, (article) => {
  if (isMobile() && article) mobilePane.value = "article";
});

onMounted(async () => {
  await feedsStore.fetchFeeds();
  await feedsStore.fetchFolders();
  await articlesStore.loadArticles(true);
});

function handleKeydown(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

  const articles = articlesStore.articles;
  const currentIdx = articles.findIndex((a) => a.id === currentArticle.value?.id);

  if (e.key === "j" || e.key === "ArrowDown") {
    e.preventDefault();
    const nextIdx = Math.min(currentIdx + 1, articles.length - 1);
    if (nextIdx !== currentIdx && nextIdx < articles.length) {
      selectArticle(articles[nextIdx].id);
    }
  } else if (e.key === "k" || e.key === "ArrowUp") {
    e.preventDefault();
    const prevIdx = Math.max(currentIdx - 1, 0);
    if (prevIdx !== currentIdx) {
      selectArticle(articles[prevIdx].id);
    }
  } else if (e.key === "s") {
    e.preventDefault();
    if (currentArticle.value) {
      articlesStore.toggleSaved(currentArticle.value.id, !currentArticle.value.saved);
    }
  } else if (e.key === "m") {
    e.preventDefault();
    if (currentArticle.value) {
      articlesStore.markRead(currentArticle.value.id, !currentArticle.value.read);
    }
  } else if (e.key === "o") {
    e.preventDefault();
    if (currentArticle.value?.link) {
      window.open(currentArticle.value.link, "_blank");
    }
  }
}
</script>

<template>
  <div class="app-layout" tabindex="0" @keydown="handleKeydown">
    <Sidebar
      :collapsed-folders="collapsedFolders"
      :class="{ 'mobile-hidden': isMobile() && mobilePane !== 'sidebar' }"
      @toggle-folder="toggleFolder"
      @select-filter="selectFilter"
    />
    <ArticleListPanel
      :class="{ 'mobile-hidden': isMobile() && mobilePane !== 'list' }"
      :show-back="isMobile() && mobilePane === 'list'"
      @select-article="selectArticle"
      @show-sidebar="showSidebar"
    />
    <ArticleViewPanel
      :class="{ 'mobile-hidden': isMobile() && mobilePane !== 'article' }"
      :show-back="isMobile() && mobilePane === 'article'"
      @back="backToList"
      @next="nextArticle"
    />
  </div>
</template>