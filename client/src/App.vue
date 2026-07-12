<script setup lang="ts">
import { onMounted, watch } from "vue";
import { useAuthStore } from "./stores/auth";
import { useSettingsStore } from "./stores/settings";
import { useFeedsStore } from "./stores/feeds";
import { useUnreadBadge } from "./composables/useUnreadBadge";

const auth = useAuthStore();
const settings = useSettingsStore();
const feeds = useFeedsStore();

const stopBadge = useUnreadBadge();

onMounted(async () => {
  await auth.checkStatus();
  if (auth.isLoggedIn) {
    await settings.load();
    await feeds.fetchFeeds();
  }
});

watch(
  () => auth.isLoggedIn,
  (loggedIn) => {
    if (!loggedIn) {
      stopBadge();
    }
  },
);
</script>

<template>
  <router-view />
</template>