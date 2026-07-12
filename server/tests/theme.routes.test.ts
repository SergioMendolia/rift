import { describe, it, expect, vi, beforeEach } from "vitest";

let themeRoutes: any;

beforeEach(async () => {
  vi.resetModules();
  (globalThis as any).Bun.file.mockReset();
  themeRoutes = (await import("../src/routes/theme.routes")).themeRoutes;
});

describe("themeRoutes", () => {
  it("GET /custom.css returns placeholder when no custom theme exists", async () => {
    (globalThis as any).Bun.file.mockReturnValueOnce({
      exists: async () => false,
    });
    const res = await themeRoutes.request("http://localhost/custom.css");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/css");
    expect(await res.text()).toBe("/* No custom theme found */");
  });

  it("GET /custom.css returns the file when it exists", async () => {
    const file = { exists: async () => true };
    (globalThis as any).Bun.file.mockReturnValueOnce(file);
    const res = await themeRoutes.request("http://localhost/custom.css");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/css");
    expect(res.body).toBeDefined();
  });

  it("GET /custom.css returns error placeholder on exception", async () => {
    (globalThis as any).Bun.file.mockImplementationOnce(() => {
      throw new Error("fs error");
    });
    const res = await themeRoutes.request("http://localhost/custom.css");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("/* Error loading custom theme */");
  });
});