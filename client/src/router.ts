import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import { useAuthStore } from "./stores/auth";

const routes: RouteRecordRaw[] = [
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
    path: "/all",
    name: "reader-all",
    component: () => import("./views/ReaderView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/all/article/:articleId",
    name: "reader-all-article",
    component: () => import("./views/ReaderView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/saved",
    name: "reader-saved",
    component: () => import("./views/ReaderView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/saved/article/:articleId",
    name: "reader-saved-article",
    component: () => import("./views/ReaderView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/feed/:feedId",
    name: "reader-feed",
    component: () => import("./views/ReaderView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/feed/:feedId/article/:articleId",
    name: "reader-feed-article",
    component: () => import("./views/ReaderView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/folder/:folderId",
    name: "reader-folder",
    component: () => import("./views/ReaderView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/folder/:folderId/article/:articleId",
    name: "reader-folder-article",
    component: () => import("./views/ReaderView.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/",
    redirect: { name: "reader-all" },
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
      return { name: "reader-all" };
    }
    return true;
  }

  if (to.meta.requiresAuth && !auth.user) {
    return { name: "login" };
  }

  return true;
});