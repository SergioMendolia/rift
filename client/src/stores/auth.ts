import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { UserDTO } from "@rift/shared";

const TOKEN_KEY = "rift-token";

export const useAuthStore = defineStore("auth", () => {
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY));
  const user = ref<UserDTO | null>(null);
  const checked = ref(false);
  const needsSetup = ref(false);

  const isLoggedIn = computed(() => !!token.value && !!user.value);
  const isAdmin = computed(() => user.value?.isAdmin ?? false);

  async function checkStatus() {
    try {
      const res = await fetch("/api/auth/status");
      const data = await res.json();
      needsSetup.value = data.needsSetup;
    } catch {
      needsSetup.value = false;
    }

    if (token.value) {
      await fetchMe();
    }

    checked.value = true;
  }

  async function fetchMe() {
    const res = await fetch("/api/auth/me", {
      headers: authHeaders(),
    });
    if (res.ok) {
      user.value = await res.json();
    } else {
      logout();
    }
  }

  async function login(email: string, password: string): Promise<void> {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? "Login failed");
    }

    const data = await res.json();
    token.value = data.token;
    user.value = data.user;
    localStorage.setItem(TOKEN_KEY, data.token);
  }

  async function setup(email: string, password: string, displayName: string): Promise<void> {
    const res = await fetch("/api/auth/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, displayName }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? "Setup failed");
    }

    const data = await res.json();
    token.value = data.token;
    user.value = data.user;
    localStorage.setItem(TOKEN_KEY, data.token);
    needsSetup.value = false;
  }

  function logout() {
    token.value = null;
    user.value = null;
    localStorage.removeItem(TOKEN_KEY);
  }

  function authHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (token.value) {
      headers["Authorization"] = `Bearer ${token.value}`;
    }
    return headers;
  }

  return {
    token,
    user,
    checked,
    needsSetup,
    isLoggedIn,
    isAdmin,
    checkStatus,
    fetchMe,
    login,
    setup,
    logout,
    authHeaders,
  };
});