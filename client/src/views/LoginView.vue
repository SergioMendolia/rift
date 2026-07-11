<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";

const auth = useAuthStore();
const router = useRouter();

const email = ref("");
const password = ref("");
const error = ref("");

async function handleSubmit() {
  error.value = "";
  try {
    await auth.login(email.value, password.value);
    router.push("/");
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Login failed";
  }
}
</script>

<template>
  <div class="login-view">
    <div class="login-card">
      <h1>Rift</h1>
      <form @submit.prevent="handleSubmit">
        <div v-if="error" class="error">{{ error }}</div>
        <div class="form-group">
          <label for="email">Email</label>
          <input id="email" type="email" v-model="email" required autocomplete="email" />
        </div>
        <div class="form-group">
          <label for="password">Password</label>
          <input id="password" type="password" v-model="password" required autocomplete="current-password" />
        </div>
        <button type="submit" class="btn btn-primary">Sign In</button>
      </form>
    </div>
  </div>
</template>