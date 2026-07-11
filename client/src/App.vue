<script setup lang="ts">
import { onMounted } from "vue";
import { useAuthStore } from "./stores/auth";
import { useSettingsStore } from "./stores/settings";

const auth = useAuthStore();
const settings = useSettingsStore();

onMounted(async () => {
  await auth.checkStatus();
  if (auth.isLoggedIn) {
    await settings.load();
  }
});
</script>

<template>
  <router-view />
</template>