import { useAuthStore } from "../stores/auth";

export function useApi() {
  const auth = useAuthStore();

  async function request<T>(
    url: string,
    options: RequestInit = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      ...auth.authHeaders(),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers as Record<string, string>),
    };

    const res = await fetch(url, { ...options, headers });

    if (res.status === 401) {
      auth.logout();
      throw new Error("Unauthorized");
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Request failed" }));
      throw new Error(data.error ?? "Request failed");
    }

    if (res.status === 204) return null as T;
    return res.json() as Promise<T>;
  }

  return {
    get: <T>(url: string) => request<T>(url, { method: "GET" }),
    post: <T>(url: string, body?: unknown) =>
      request<T>(url, {
        method: "POST",
        body: body ? JSON.stringify(body) : undefined,
      }),
    put: <T>(url: string, body?: unknown) =>
      request<T>(url, {
        method: "PUT",
        body: body ? JSON.stringify(body) : undefined,
      }),
    del: <T>(url: string) => request<T>(url, { method: "DELETE" }),
  };
}