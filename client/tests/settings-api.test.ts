import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  setActivePinia(createPinia());
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

function jsonResponse(body: any, ok = true, status = 200) {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) };
}

async function setupAuth() {
  const { useAuthStore } = await import("../src/stores/auth");
  const auth = useAuthStore();
  auth.token = "tok";
  auth.user = { id: 1, email: "a@b.com", displayName: "A", isAdmin: true };
  return auth;
}

describe("useSettingsStore", () => {
  it("load fetches and applies theme", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ theme: "dark", markReadOnOpen: false }));
    const auth = await setupAuth();
    const { useSettingsStore } = await import("../src/stores/settings");
    const settings = useSettingsStore();
    await settings.load();
    expect(settings.theme).toBe("dark");
    expect(settings.markReadOnOpen).toBe(false);
    expect(settings.loaded).toBe(true);
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("rift-theme")).toBe("dark");
  });

  it("update sets theme and applies it", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true }));
    const auth = await setupAuth();
    const { useSettingsStore } = await import("../src/stores/settings");
    const settings = useSettingsStore();
    await settings.update({ theme: "sepia" });
    expect(settings.theme).toBe("sepia");
    expect(document.documentElement.dataset.theme).toBe("sepia");
  });

  it("update sets markReadOnOpen", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true }));
    const auth = await setupAuth();
    const { useSettingsStore } = await import("../src/stores/settings");
    const settings = useSettingsStore();
    await settings.update({ markReadOnOpen: false });
    expect(settings.markReadOnOpen).toBe(false);
  });

  it("applyTheme custom adds a stylesheet link", async () => {
    const auth = await setupAuth();
    const { useSettingsStore } = await import("../src/stores/settings");
    const settings = useSettingsStore();
    settings.applyTheme("custom");
    expect(document.documentElement.dataset.theme).toBe("custom");
    const link = document.querySelector('link[data-custom-theme="true"]') as HTMLLinkElement;
    expect(link).not.toBeNull();
    expect(link.href).toContain("/api/theme/custom.css");
  });

  it("applyTheme non-custom removes existing custom link", async () => {
    const auth = await setupAuth();
    const { useSettingsStore } = await import("../src/stores/settings");
    const settings = useSettingsStore();
    settings.applyTheme("custom");
    expect(document.querySelector('link[data-custom-theme]')).not.toBeNull();
    settings.applyTheme("light");
    expect(document.querySelector('link[data-custom-theme]')).toBeNull();
  });
});

describe("useApi composable", () => {
  it("returns parsed json on success", async () => {
    const auth = await setupAuth();
    const { useApi } = await import("../src/composables/useApi");
    const api = useApi();
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    const result = await api.get("/api/x");
    expect(result).toEqual({ ok: true });
  });

  it("throws on error response", async () => {
    const auth = await setupAuth();
    const { useApi } = await import("../src/composables/useApi");
    const api = useApi();
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "fail" }, false, 400));
    await expect(api.get("/api/x")).rejects.toThrow("fail");
  });

  it("logs out on 401", async () => {
    const { useAuthStore } = await import("../src/stores/auth");
    const auth = useAuthStore();
    auth.token = "tok";
    auth.user = { id: 1, email: "a@b.com", displayName: "A", isAdmin: false };
    const { useApi } = await import("../src/composables/useApi");
    const api = useApi();
    fetchMock.mockResolvedValueOnce(jsonResponse({}, false, 401));
    await expect(api.get("/api/x")).rejects.toThrow("Unauthorized");
    expect(auth.token).toBeNull();
  });

  it("post sends JSON body with Content-Type", async () => {
    const auth = await setupAuth();
    const { useApi } = await import("../src/composables/useApi");
    const api = useApi();
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await api.post("/api/x", { a: 1 });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
  });

  it("put sends JSON body", async () => {
    const auth = await setupAuth();
    const { useApi } = await import("../src/composables/useApi");
    const api = useApi();
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true }));
    await api.put("/api/x", { a: 1 });
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("PUT");
  });

  it("del sends DELETE", async () => {
    const auth = await setupAuth();
    const { useApi } = await import("../src/composables/useApi");
    const api = useApi();
    fetchMock.mockResolvedValueOnce(jsonResponse({ success: true }));
    await api.del("/api/x");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("DELETE");
  });

  it("returns null on 204", async () => {
    const auth = await setupAuth();
    const { useApi } = await import("../src/composables/useApi");
    const api = useApi();
    fetchMock.mockResolvedValueOnce({ ok: true, status: 204, json: async () => ({}), text: async () => "" });
    const result = await api.get("/api/x");
    expect(result).toBeNull();
  });

  it("includes auth header in requests", async () => {
    const auth = await setupAuth();
    const { useApi } = await import("../src/composables/useApi");
    const api = useApi();
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await api.get("/api/x");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer tok");
  });
});