<script setup lang="ts">
import { ref, computed } from "vue";
import { useFeedsStore } from "../../stores/feeds";

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const feedsStore = useFeedsStore();

const url = ref("");
const selectedFolderId = ref<number | null>(null);
const error = ref("");
const loading = ref(false);

async function submit() {
  if (!url.value.trim()) return;
  error.value = "";
  loading.value = true;
  try {
    await feedsStore.addFeed(url.value.trim(), selectedFolderId.value);
    url.value = "";
    emit("close");
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Failed to add feed";
  } finally {
    loading.value = false;
  }
}

function close() {
  url.value = "";
  error.value = "";
  emit("close");
}
</script>

<template>
  <div v-if="props.show" class="modal-overlay" @click.self="close">
    <div class="modal">
      <h2>Add Feed</h2>
      <div v-if="error" class="error" style="color: #d44; margin-bottom: var(--spacing-sm);">{{ error }}</div>
      <div class="form-group">
        <label for="feed-url">Feed URL</label>
        <input
          id="feed-url"
          type="url"
          v-model="url"
          placeholder="https://example.com/feed.xml"
          @keyup.enter="submit"
          :disabled="loading"
        />
      </div>
      <div class="form-group">
        <label for="folder">Folder (optional)</label>
        <select id="folder" v-model="selectedFolderId" :disabled="loading">
          <option :value="null">None</option>
          <option v-for="folder in feedsStore.folders" :key="folder.id" :value="folder.id">
            {{ folder.name }}
          </option>
        </select>
      </div>
      <div class="actions">
        <button class="btn" @click="close" :disabled="loading">Cancel</button>
        <button class="btn btn-primary" @click="submit" :disabled="loading || !url.trim()">
          {{ loading ? "Adding..." : "Add Feed" }}
        </button>
      </div>
    </div>
  </div>
</template>