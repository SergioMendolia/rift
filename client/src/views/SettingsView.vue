<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useSettingsStore } from "../stores/settings";
import { useAuthStore } from "../stores/auth";
import type { UserDTO, Theme } from "@rift/shared";
import { useApi } from "../composables/useApi";

const settingsStore = useSettingsStore();
const auth = useAuthStore();
const router = useRouter();
const api = useApi();

const users = ref<UserDTO[]>([]);
const showAddUser = ref(false);
const newUser = ref({ email: "", password: "", displayName: "" });
const addUserError = ref("");

onMounted(async () => {
  await settingsStore.load();
  if (auth.isAdmin) {
    await loadUsers();
  }
});

async function loadUsers() {
  try {
    users.value = await api.get<UserDTO[]>("/api/users");
  } catch {
    users.value = [];
  }
}

async function setTheme(theme: Theme) {
  await settingsStore.update({ theme });
}

async function toggleMarkReadOnOpen() {
  await settingsStore.update({ markReadOnOpen: !settingsStore.markReadOnOpen });
}

async function createUser() {
  addUserError.value = "";
  try {
    await api.post("/api/users", newUser.value);
    newUser.value = { email: "", password: "", displayName: "" };
    showAddUser.value = false;
    await loadUsers();
  } catch (e) {
    addUserError.value = e instanceof Error ? e.message : "Failed to create user";
  }
}

async function deleteUser(id: number) {
  try {
    await api.del(`/api/users/${id}`);
    await loadUsers();
  } catch {
  }
}

function back() {
  router.push("/");
}

const themes: Theme[] = ["light", "dark", "sepia", "custom"];
</script>

<template>
  <div class="settings-view">
    <div class="settings-header">
      <div style="display: flex; align-items: center; gap: var(--spacing-md);">
        <button class="btn btn-ghost" @click="back">Back</button>
        <h1>Settings</h1>
      </div>
    </div>
    <div class="settings-content">
      <div class="settings-section">
        <h2>Appearance</h2>
        <div class="settings-row">
          <div>
            <label>Theme</label>
            <div class="hint">Choose a built-in theme or use a custom CSS file</div>
          </div>
          <div class="theme-options">
            <button
              v-for="t in themes"
              :key="t"
              class="theme-option"
              :class="{ active: settingsStore.theme === t }"
              @click="setTheme(t)"
            >
              {{ t.charAt(0).toUpperCase() + t.slice(1) }}
            </button>
          </div>
        </div>
        <div v-if="settingsStore.theme === 'custom'" class="hint" style="margin-top: var(--spacing-sm);">
          Place your custom CSS at <code>{{ '/app/data/themes/custom.css' }}</code> in your container.
        </div>
      </div>

      <div class="settings-section">
        <h2>Reading</h2>
        <div class="settings-row">
          <div>
            <label>Auto-mark as read</label>
            <div class="hint">Automatically mark articles as read when you open them</div>
          </div>
          <button
            class="btn"
            :class="{ 'btn-primary': settingsStore.markReadOnOpen }"
            @click="toggleMarkReadOnOpen"
          >
            {{ settingsStore.markReadOnOpen ? "On" : "Off" }}
          </button>
        </div>
      </div>

      <div v-if="auth.isAdmin" class="settings-section">
        <h2>User Management</h2>
        <div class="user-list">
          <div v-for="user in users" :key="user.id" class="user-row">
            <div class="user-info">
              <span class="user-email">{{ user.email }}</span>
              <span class="user-name">{{ user.displayName }}{{ user.isAdmin ? ' (Admin)' : '' }}</span>
            </div>
            <button
              v-if="!user.isAdmin"
              class="btn btn-ghost"
              @click="deleteUser(user.id)"
            >
              Delete
            </button>
          </div>
        </div>
        <button
          class="btn"
          style="margin-top: var(--spacing-md);"
          @click="showAddUser = !showAddUser"
        >
          Add User
        </button>

        <div v-if="showAddUser" class="modal" style="margin-top: var(--spacing-md);">
          <h2>Create New User</h2>
          <div v-if="addUserError" class="error" style="color: #d44; margin-bottom: var(--spacing-sm);">{{ addUserError }}</div>
          <div class="form-group">
            <label>Display Name</label>
            <input type="text" v-model="newUser.displayName" required />
          </div>
          <div class="form-group">
            <label>Email</label>
            <input type="email" v-model="newUser.email" required />
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" v-model="newUser.password" required />
          </div>
          <div class="actions">
            <button class="btn" @click="showAddUser = false">Cancel</button>
            <button class="btn btn-primary" @click="createUser">Create</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>