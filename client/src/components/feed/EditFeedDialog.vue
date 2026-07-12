<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useFeedsStore } from "../../stores/feeds";
import type { FeedDTO } from "@rift/shared";

const props = defineProps<{
  show: boolean;
  feed: FeedDTO | null;
}>();

const emit = defineEmits<{
  close: [];
}>();

const feedsStore = useFeedsStore();

const displayName = ref("");
const folderId = ref<number | null>(null);
const error = ref("");
const loading = ref(false);

const feedTitle = computed(() => props.feed?.displayName ?? props.feed?.title ?? "Feed");

watch(() => props.show, (show) => {
  if (show && props.feed) {
    displayName.value = props.feed.displayName ?? "";
    folderId.value = props.feed.folderId;
    error.value = "";
  }
});

async function submit() {
  if (!props.feed) return;
  error.value = "";
  loading.value = true;
  try {
    await feedsStore.updateFeed(props.feed.id, {
      displayName: displayName.value.trim() || null,
      folderId: folderId.value,
    });
    emit("close");
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to update feed";
  } finally {
    loading.value = false;
  }
}

function close() {
  error.value = "";
  emit("close");
}
</script>

<template>
  <div v-if="props.show && props.feed" class="modal-overlay" @click.self="close">
    <div class="modal">
      <h2>Edit Feed</h2>
      <p style="color: var(--text-muted); font-size: var(--font-size-sm); margin-bottom: var(--spacing-md);">
        {{ feedTitle }}
      </p>
      <div v-if="error" class="error" style="color: #d44; margin-bottom: var(--spacing-sm);">{{ error }}</div>
      <div class="form-group">
        <label for="display-name">Display Name</label>
        <input
          id="display-name"
          type="text"
          v-model="displayName"
          :placeholder="props.feed.title"
          @keyup.enter="submit"
          :disabled="loading"
        />
      </div>
      <div class="form-group">
        <label for="folder">Folder</label>
        <select id="folder" v-model="folderId" :disabled="loading">
          <option :value="null">None</option>
          <option v-for="folder in feedsStore.folders" :key="folder.id" :value="folder.id">
            {{ folder.name }}
          </option>
        </select>
      </div>
      <div class="actions">
        <button class="btn" @click="close" :disabled="loading">Cancel</button>
        <button class="btn btn-primary" @click="submit" :disabled="loading">Save</button>
      </div>
    </div>
  </div>
</template>