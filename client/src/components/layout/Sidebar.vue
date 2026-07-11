<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useFeedsStore } from "../../stores/feeds";
import { useArticlesStore, type ArticleFilter } from "../../stores/articles";
import { useAuthStore } from "../../stores/auth";

const props = defineProps<{
  collapsedFolders: Set<number>;
}>();

const emit = defineEmits<{
  toggleFolder: [id: number];
  selectFilter: [filter: ArticleFilter];
}>();

const feedsStore = useFeedsStore();
const articlesStore = useArticlesStore();
const auth = useAuthStore();
const router = useRouter();

const currentFilter = computed(() => articlesStore.currentFilter);

function isActive(filter: ArticleFilter): boolean {
  return JSON.stringify(filter) === JSON.stringify(currentFilter.value);
}

function goSettings() {
  router.push("/settings");
}

function logout() {
  auth.logout();
  router.push("/login");
}
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <h1>Rift</h1>
      <button class="btn btn-ghost btn-icon" @click="goSettings" title="Settings">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>
    </div>

    <div class="sidebar-content">
      <div class="sidebar-section">
        <div
          class="sidebar-item"
          :class="{ active: isActive({ type: 'all' }) }"
          @click="emit('selectFilter', { type: 'all' })"
        >
          <span class="icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 4h16v16H4z" />
            </svg>
          </span>
          <span class="label">All Items</span>
          <span class="count">{{ feedsStore.totalUnread }}</span>
        </div>
        <div
          class="sidebar-item"
          :class="{ active: isActive({ type: 'saved' }) }"
          @click="emit('selectFilter', { type: 'saved' })"
        >
          <span class="icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          </span>
          <span class="label">Saved</span>
        </div>
      </div>

      <div class="sidebar-section">
        <div class="sidebar-section-title">Folders</div>
        <template v-for="folder in feedsStore.folders" :key="folder.id">
          <div
            class="sidebar-folder"
            :class="{ collapsed: props.collapsedFolders.has(folder.id) }"
            @click="emit('toggleFolder', folder.id)"
          >
            <span class="folder-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 10l5 5 5-5z" />
              </svg>
            </span>
            <span class="label">{{ folder.name }}</span>
          </div>
          <div
            class="sidebar-feeds"
            :class="{ collapsed: props.collapsedFolders.has(folder.id) }"
          >
            <template
              v-for="feed in feedsStore.feedsByFolder.get(folder.id) ?? []"
              :key="feed.id"
            >
              <div
                class="sidebar-feed"
                :class="{ active: isActive({ type: 'feed', feedId: feed.id }) }"
                @click="emit('selectFilter', { type: 'feed', feedId: feed.id })"
              >
                <img
                  v-if="feed.faviconUrl"
                  :src="feed.faviconUrl"
                  alt=""
                  class="favicon"
                />
                <span v-else class="favicon" style="background: var(--border);"></span>
                <span class="label">{{ feed.displayName ?? feed.title }}</span>
                <span class="count">{{ feed.unreadCount || '' }}</span>
              </div>
            </template>
          </div>
        </template>

        <div v-if="feedsStore.feedsByFolder.get(null)?.length" class="sidebar-section-title" style="margin-top: var(--spacing-md);">
          Unfiled
        </div>
        <template
          v-for="feed in feedsStore.feedsByFolder.get(null) ?? []"
          :key="feed.id"
        >
          <div
            class="sidebar-feed"
            :class="{ active: isActive({ type: 'feed', feedId: feed.id }) }"
            style="padding-left: var(--spacing-md);"
            @click="emit('selectFilter', { type: 'feed', feedId: feed.id })"
          >
            <img
              v-if="feed.faviconUrl"
              :src="feed.faviconUrl"
              alt=""
              class="favicon"
            />
            <span v-else class="favicon" style="background: var(--border);"></span>
            <span class="label">{{ feed.displayName ?? feed.title }}</span>
            <span class="count">{{ feed.unreadCount || '' }}</span>
          </div>
        </template>
      </div>
    </div>

    <div class="sidebar-footer">
      <button class="btn btn-ghost" style="font-size: var(--font-size-sm);" @click="logout">
        Sign Out
      </button>
    </div>
  </aside>
</template>