import { describe, it, expect, vi, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  setActivePinia(createPinia());
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  localStorage.clear();
});

function jsonResponse(body: any, ok = true, status = 200) {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) };
}

describe("useAuthStore", () => {
  it("checks status and sets needsSetup when no users", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ needsSetup: true }));
    const { useAuthStore } = await import("../src/stores/auth");
    const auth = useAuthStore();
    await auth.checkStatus();
    expect(auth.needsSetup).toBe(true);
    expect(auth.checked).toBe(true);
  });

  it("login sets token and user on success", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ token: "tok", user: { id: 1, email: "a@b.com", displayName: "A", isAdmin: true } }),
    );
    const { useAuthStore } = await import("../src/stores/auth");
    const auth = useAuthStore();
    await auth.login("a@b.com", "pw");
    expect(auth.token).toBe("tok");
    expect(auth.user?.email).toBe("a@b.com");
    expect(auth.isLoggedIn).toBe(true);
    expect(localStorage.getItem("rift-token")).toBe("tok");
  });

  it("login throws on error response", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "Invalid credentials" }, false, 401));
    const { useAuthStore } = await import("../src/stores/auth");
    const auth = useAuthStore();
    await expect(auth.login("a@b.com", "wrong")).rejects.toThrow("Invalid credentials");
    expect(auth.token).toBeNull();
  });

  it("logout clears token and user", async () => {
    const { useAuthStore } = await import("../src/stores/auth");
    const auth = useAuthStore();
    auth.token = "tok";
    auth.user = { id: 1, email: "a@b.com", displayName: "A", isAdmin: false };
    localStorage.setItem("rift-token", "tok");
    auth.logout();
    expect(auth.token).toBeNull();
    expect(auth.user).toBeNull();
    expect(auth.isLoggedIn).toBe(false);
    expect(localStorage.getItem("rift-token")).toBeNull();
  });

  it("setup sets token and user", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ token: "tok", user: { id: 1, email: "a@b.com", displayName: "A", isAdmin: true } }),
    );
    const { useAuthStore } = await import("../src/stores/auth");
    const auth = useAuthStore();
    await auth.setup("a@b.com", "pw", "A");
    expect(auth.token).toBe("tok");
    expect(auth.needsSetup).toBe(false);
    expect(auth.user?.isAdmin).toBe(true);
  });

  it("setup throws on error", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "Setup already complete" }, false, 400));
    const { useAuthStore } = await import("../src/stores/auth");
    const auth = useAuthStore();
    await expect(auth.setup("a@b.com", "pw", "A")).rejects.toThrow("Setup already complete");
  });

  it("authHeaders includes Bearer token when present", async () => {
    const { useAuthStore } = await import("../src/stores/auth");
    const auth = useAuthStore();
    auth.token = "abc";
    expect(auth.authHeaders()).toEqual({ Authorization: "Bearer abc" });
  });

  it("authHeaders is empty when no token", async () => {
    const { useAuthStore } = await import("../src/stores/auth");
    const auth = useAuthStore();
    auth.token = null;
    expect(auth.authHeaders()).toEqual({});
  });

  it("fetchMe logs out on 401", async () => {
    const { useAuthStore } = await import("../src/stores/auth");
    const auth = useAuthStore();
    auth.token = "tok";
    auth.user = { id: 1, email: "a@b.com", displayName: "A", isAdmin: false };
    fetchMock.mockResolvedValueOnce(jsonResponse({}, false, 401));
    await auth.fetchMe();
    expect(auth.token).toBeNull();
    expect(auth.user).toBeNull();
  });

  it("isAdmin reflects user.isAdmin", async () => {
    const { useAuthStore } = await import("../src/stores/auth");
    const auth = useAuthStore();
    auth.user = { id: 1, email: "a", displayName: "b", isAdmin: true };
    expect(auth.isAdmin).toBe(true);
    auth.user = { id: 2, email: "a", displayName: "b", isAdmin: false };
    expect(auth.isAdmin).toBe(false);
  });
});