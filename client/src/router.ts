import { createRouter, createWebHistory } from "vue-router";
import { useAuthStore } from "./stores/auth";

const routes = [
  {
    path: "/login",
    name: "login",
    component: () => import("./views/LoginView.vue"),
    meta: { public: true },
  },
  {
    path: "/setup",
    name: "setup",
    component: () => import("./views/SetupView.vue"),
    meta: { public: true },
  },
  {
    path: "/",
    name: "reader",
    component: () => import("./views/ReaderView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/settings",
    name: "settings",
    component: () => import("./views/SettingsView.vue"),
    meta: { requiresAuth: true },
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();

  if (!auth.checked) {
    await auth.checkStatus();
  }

  if (to.meta.public) {
    if (to.name === "login" && auth.needsSetup) {
      return { name: "setup" };
    }
    if (to.name === "setup" && !auth.needsSetup) {
      return { name: "login" };
    }
    if (to.name === "login" && auth.user) {
      return { name: "reader" };
    }
    return true;
  }

  if (to.meta.requiresAuth && !auth.user) {
    return { name: "login" };
  }

  return true;
});