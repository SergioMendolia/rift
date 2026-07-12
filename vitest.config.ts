import { defineConfig } from "vitest/config";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const sharedAlias = {
  "@rift/shared": resolve(__dirname, "packages/shared/src/index.ts"),
};

const serverModules = resolve(__dirname, "server/node_modules");

const serverDeps = [
  "hono",
  "hono/jwt",
  "hono/logger",
  "hono/bun",
  "drizzle-orm",
  "drizzle-orm/bun-sqlite/migrator",
  "drizzle-orm/sqlite-core",
  "rss-parser",
  "zod",
];

const allAliases = [
  { find: "@rift/shared", replacement: sharedAlias["@rift/shared"] },
  ...serverDeps.map((dep) => ({
    find: new RegExp(`^${dep.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\/|$)`),
    replacement: require.resolve(dep, { paths: [serverModules] }),
  })),
];

export default defineConfig({
  test: {
    alias: allAliases,
    projects: [
      {
        test: {
          name: "server",
          root: resolve(__dirname, "server"),
          environment: "node",
          globals: true,
          setupFiles: [resolve(__dirname, "tests/setup.ts")],
          include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
          server: { deps: { inline: ["drizzle-orm", "hono", "rss-parser", "zod"] } },
        },
      },
      {
        test: {
          name: "client",
          root: resolve(__dirname, "client"),
          environment: "happy-dom",
          globals: true,
          setupFiles: [resolve(__dirname, "tests/client-setup.ts")],
          include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
        },
      },
    ],
  },
});