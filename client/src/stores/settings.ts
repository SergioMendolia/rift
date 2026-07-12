import { defineStore } from "pinia";
import { ref } from "vue";
import type { Theme, DateFormat, UserSettingsDTO } from "@rift/shared";
import { useAuthStore } from "./auth";

const THEME_KEY = "rift-theme";

export const useSettingsStore = defineStore("settings", () => {
  const theme = ref<Theme>("light");
  const markReadOnOpen = ref(true);
  const dateFormat = ref<DateFormat>("relative");
  const loaded = ref(false);

  async function load() {
    const auth = useAuthStore();
    const res = await fetch("/api/settings", { headers: auth.authHeaders() });
    if (res.ok) {
      const data: UserSettingsDTO = await res.json();
      theme.value = data.theme;
      markReadOnOpen.value = data.markReadOnOpen;
      dateFormat.value = data.dateFormat;
      applyTheme(data.theme);
    }
    loaded.value = true;
  }

  async function update(changes: Partial<UserSettingsDTO>) {
    const auth = useAuthStore();
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...auth.authHeaders() },
      body: JSON.stringify(changes),
    });
    if (res.ok) {
      if (changes.theme !== undefined) {
        theme.value = changes.theme;
        applyTheme(changes.theme);
      }
      if (changes.markReadOnOpen !== undefined) {
        markReadOnOpen.value = changes.markReadOnOpen;
      }
      if (changes.dateFormat !== undefined) {
        dateFormat.value = changes.dateFormat;
      }
    }
  }

  function applyTheme(t: Theme) {
    document.documentElement.dataset.theme = t;
    localStorage.setItem(THEME_KEY, t);

    const existing = document.querySelector('link[data-custom-theme]');
    if (existing) existing.remove();

    if (t === "custom") {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "/api/theme/custom.css";
      link.setAttribute("data-custom-theme", "true");
      document.head.appendChild(link);
    }
  }

  return {
    theme,
    markReadOnOpen,
    dateFormat,
    loaded,
    load,
    update,
    applyTheme,
  };
});