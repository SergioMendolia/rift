<script setup lang="ts">
import { onMounted, ref, computed } from "vue";
import { useRouter } from "vue-router";
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
const router = useRouter();

const collapsedFolders = ref<Set<number>>(new Set());

const currentArticle = computed(() => articlesStore.currentArticle);

onMounted(async () => {
  await feedsStore.fetchFeeds();
  await feedsStore.fetchFolders();
  await articlesStore.loadArticles(true);
});

function selectFilter(filter: ArticleFilter) {
  articlesStore.setFilter(filter);
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
}

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
      @toggle-folder="toggleFolder"
      @select-filter="selectFilter"
    />
    <ArticleListPanel @select-article="selectArticle" />
    <ArticleViewPanel />
  </div>
</template>