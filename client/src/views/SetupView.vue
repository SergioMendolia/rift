<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";

const auth = useAuthStore();
const router = useRouter();

const email = ref("");
const password = ref("");
const displayName = ref("");
const error = ref("");

async function handleSubmit() {
  error.value = "";
  try {
    await auth.setup(email.value, password.value, displayName.value);
    router.push("/");
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Setup failed";
  }
}
</script>

<template>
  <div class="login-view">
    <div class="login-card">
      <h1>Welcome to Rift</h1>
      <p style="color: var(--text-muted); margin-bottom: var(--spacing-md); text-align: center;">
        Create your admin account to get started.
      </p>
      <form @submit.prevent="handleSubmit">
        <div v-if="error" class="error">{{ error }}</div>
        <div class="form-group">
          <label for="displayName">Display Name</label>
          <input id="displayName" type="text" v-model="displayName" required />
        </div>
        <div class="form-group">
          <label for="email">Email</label>
          <input id="email" type="email" v-model="email" required autocomplete="email" />
        </div>
        <div class="form-group">
          <label for="password">Password</label>
          <input id="password" type="password" v-model="password" required autocomplete="new-password" />
        </div>
        <button type="submit" class="btn btn-primary">Create Admin Account</button>
      </form>
    </div>
  </div>
</template>