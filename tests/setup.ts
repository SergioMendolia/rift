import { vi, beforeEach } from "vitest";

// `bun:sqlite` is mocked per-test via vi.mock("../src/db/connection", ...).

// Stub the `Bun` global used by auth.routes.ts, users.routes.ts, cron.ts,
// theme.routes.ts. Re-apply before each test so it survives vi.resetModules()
// and module reloads.
const stubBun = () => {
  vi.stubGlobal("Bun", {
    password: {
      hash: vi.fn(async (plain: string) => `hash:${plain}`),
      verify: vi.fn(async (plain: string, hash: string) => hash === `hash:${plain}`),
    },
    file: vi.fn((path: string) => ({
      exists: async () => false,
      text: async () => "",
    })),
    cron: vi.fn(),
  });
};

stubBun();
beforeEach(stubBun);