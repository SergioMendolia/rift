<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useFeedsStore } from "../../stores/feeds";
import { useArticlesStore, type ArticleFilter } from "../../stores/articles";
import { useAuthStore } from "../../stores/auth";
import { filterPath } from "../../composables/useNav";
import type { FeedDTO } from "@rift/shared";
import AddFeedDialog from "../feed/AddFeedDialog.vue";
import EditFeedDialog from "../feed/EditFeedDialog.vue";

const props = defineProps<{
  collapsedFolders: Set<number>;
}>();

const emit = defineEmits<{
  toggleFolder: [id: number];
}>();

const feedsStore = useFeedsStore();
const articlesStore = useArticlesStore();
const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const currentFilter = computed(() => articlesStore.currentFilter);

const showAddFeed = ref(false);
const showAddFolder = ref(false);
const editingFeed = ref<FeedDTO | null>(null);
const newFolderName = ref("");
const folderError = ref("");
const renamingFolderId = ref<number | null>(null);
const renameFolderName = ref("");

function isActive(filter: ArticleFilter): boolean {
  return JSON.stringify(filter) === JSON.stringify(currentFilter.value);
}

function feedVisible(feed: FeedDTO): boolean {
  return !articlesStore.hideRead || feed.unreadCount > 0;
}

function folderFeeds(folderId: number | null): FeedDTO[] {
  return (feedsStore.feedsByFolder.get(folderId) ?? []).filter(feedVisible);
}

function folderHasVisibleFeeds(folderId: number): boolean {
  return folderFeeds(folderId).length > 0;
}

function goSettings() {
  router.push("/settings");
}

function goFilter(filter: ArticleFilter) {
  router.push(filterPath(filter));
}

function logout() {
  auth.logout();
  router.push("/login");
}

async function createFolder() {
  if (!newFolderName.value.trim()) return;
  folderError.value = "";
  try {
    await feedsStore.addFolder(newFolderName.value.trim());
    newFolderName.value = "";
    showAddFolder.value = false;
  } catch (e) {
    folderError.value = e instanceof Error ? e.message : "Failed to create folder";
  }
}

function editFeed(feed: FeedDTO, e: Event) {
  e.stopPropagation();
  editingFeed.value = feed;
}

async function deleteFeed(feed: FeedDTO, e: Event) {
  e.stopPropagation();
  if (!confirm(`Unsubscribe from "${feed.displayName ?? feed.title}"?`)) return;
  await feedsStore.removeFeed(feed.id);
}

function startRenameFolder(folderId: number, name: string, e: Event) {
  e.stopPropagation();
  renamingFolderId.value = folderId;
  renameFolderName.value = name;
}

async function submitRenameFolder(e?: Event) {
  e?.preventDefault();
  if (renamingFolderId.value === null || !renameFolderName.value.trim()) return;
  try {
    await feedsStore.updateFolder(renamingFolderId.value, renameFolderName.value.trim());
    renamingFolderId.value = null;
    renameFolderName.value = "";
  } catch (err) {
    folderError.value = err instanceof Error ? err.message : "Failed to rename folder";
    setTimeout(() => { folderError.value = ""; }, 5000);
  }
}

async function deleteFolder(folderId: number, name: string, e: Event) {
  e.stopPropagation();
  if (!confirm(`Delete folder "${name}"? Feeds inside will be moved to the root.`)) return;
  await feedsStore.removeFolder(folderId);
}
</script>

<template>
  <aside class="sidebar">
    <div class="sidebar-header">
      <h1>Rift</h1>
      <div style="display: flex; gap: 2px;">
        <button
          class="btn btn-ghost btn-icon"
          :class="{ 'btn-primary': !articlesStore.hideRead }"
          :title="articlesStore.hideRead ? 'Showing unread only — click to show all' : 'Showing all — click to hide read'"
          @click="articlesStore.setHideRead(!articlesStore.hideRead)"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
        <button class="btn btn-ghost btn-icon" @click="goSettings" title="Settings">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>
    </div>

    <AddFeedDialog :show="showAddFeed" @close="showAddFeed = false" />
    <EditFeedDialog :show="!!editingFeed" :feed="editingFeed" @close="editingFeed = null" />

    <div class="sidebar-content">
      <div class="sidebar-section">
        <div
          class="sidebar-item"
          :class="{ active: isActive({ type: 'all' }) }"
          @click="goFilter({ type: 'all' })"
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
          @click="goFilter({ type: 'saved' })"
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
        <div class="sidebar-section-title" style="display: flex; align-items: center; justify-content: space-between;">
          <span>Feeds</span>
          <div style="display: flex; gap: 2px;">
            <button class="btn btn-ghost btn-icon" @click.stop="showAddFeed = true" title="Add feed" style="padding: 2px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
            <button class="btn btn-ghost btn-icon" @click.stop="showAddFolder = !showAddFolder" title="New folder" style="padding: 2px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            </button>
          </div>
        </div>
        <div v-if="showAddFolder" style="padding: var(--spacing-xs) var(--spacing-md) var(--spacing-sm);">
          <div v-if="folderError" style="color: #d44; font-size: var(--font-size-sm); margin-bottom: var(--spacing-xs);">{{ folderError }}</div>
          <div style="display: flex; gap: var(--spacing-xs);">
            <input
              type="text"
              v-model="newFolderName"
              placeholder="Folder name"
              @keyup.enter="createFolder"
              style="flex: 1; font-size: var(--font-size-sm); padding: var(--spacing-xs) var(--spacing-sm);"
            />
            <button class="btn btn-primary" @click="createFolder" :disabled="!newFolderName.trim()" style="padding: var(--spacing-xs) var(--spacing-sm); font-size: var(--font-size-sm);">Add</button>
          </div>
        </div>
        <template v-for="folder in feedsStore.folders" :key="folder.id">
          <div
            v-if="renamingFolderId === folder.id && folderHasVisibleFeeds(folder.id)"
            class="sidebar-folder"
            @click.stop
          >
            <span class="folder-icon" style="visibility: hidden;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 10l5 5 5-5z" />
              </svg>
            </span>
            <form @submit.prevent="submitRenameFolder" style="flex: 1; display: flex; gap: var(--spacing-xs);">
              <input
                type="text"
                v-model="renameFolderName"
                @keyup.escape="renamingFolderId = null"
                style="flex: 1; font-size: var(--font-size-sm); padding: var(--spacing-xs) var(--spacing-sm);"
                autofocus
              />
              <button type="submit" class="btn btn-primary" style="padding: var(--spacing-xs) var(--spacing-sm); font-size: var(--font-size-sm);">OK</button>
            </form>
          </div>
          <div
            v-else-if="folderHasVisibleFeeds(folder.id)"
            class="sidebar-folder"
            :class="{ collapsed: props.collapsedFolders.has(folder.id), active: isActive({ type: 'folder', folderId: folder.id }) }"
          >
            <span class="folder-icon" @click.stop="emit('toggleFolder', folder.id)" style="cursor: pointer;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M7 10l5 5 5-5z" />
              </svg>
            </span>
            <span class="label" @click="goFilter({ type: 'folder', folderId: folder.id })">{{ folder.name }}</span>
            <span class="feed-actions">
              <button class="btn btn-ghost feed-action-btn" title="Rename folder" @click="startRenameFolder(folder.id, folder.name, $event)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" />
                </svg>
              </button>
              <button class="btn btn-ghost feed-action-btn" title="Delete folder" @click="deleteFolder(folder.id, folder.name, $event)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </span>
          </div>
          <div
            class="sidebar-feeds"
            :class="{ collapsed: props.collapsedFolders.has(folder.id) }"
          >
            <template
              v-for="feed in folderFeeds(folder.id)"
              :key="feed.id"
            >
              <div
                class="sidebar-feed"
                :class="{ active: isActive({ type: 'feed', feedId: feed.id }) }"
                @click="goFilter({ type: 'feed', feedId: feed.id })"
              >
                <img
                  v-if="feed.faviconUrl"
                  :src="feed.faviconUrl"
                  alt=""
                  class="favicon"
                />
                <span v-else class="favicon" style="background: var(--border);"></span>
                <span class="label">{{ feed.displayName ?? feed.title }}</span>
                <span class="feed-actions">
                  <button class="btn btn-ghost feed-action-btn" title="Edit feed" @click="editFeed(feed, $event)">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" />
                    </svg>
                  </button>
                  <button class="btn btn-ghost feed-action-btn" title="Unsubscribe" @click="deleteFeed(feed, $event)">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </span>
                <span class="count">{{ feed.unreadCount || '' }}</span>
              </div>
            </template>
          </div>
        </template>

        <template
          v-for="feed in folderFeeds(null)"
          :key="feed.id"
        >
          <div
            class="sidebar-feed"
            :class="{ active: isActive({ type: 'feed', feedId: feed.id }) }"
            style="padding-left: var(--spacing-md);"
            @click="goFilter({ type: 'feed', feedId: feed.id })"
          >
            <img
              v-if="feed.faviconUrl"
              :src="feed.faviconUrl"
              alt=""
              class="favicon"
            />
            <span v-else class="favicon" style="background: var(--border);"></span>
            <span class="label">{{ feed.displayName ?? feed.title }}</span>
            <span class="feed-actions">
              <button class="btn btn-ghost feed-action-btn" title="Edit feed" @click="editFeed(feed, $event)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" />
                </svg>
              </button>
              <button class="btn btn-ghost feed-action-btn" title="Unsubscribe" @click="deleteFeed(feed, $event)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            </span>
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