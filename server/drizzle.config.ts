import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/schema/index.ts",
  out: "./src/db/migrations",
  dbCredentials: {
    url: process.env.DB_PATH ?? "./data/rift.db",
  },
});