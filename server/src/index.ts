import { Hono } from "hono";
import { logger } from "hono/logger";
import { serveStatic } from "hono/bun";
import { resolve } from "path";
import { env } from "./env";
import { authMiddleware, errorHandler } from "./middleware";
import { authRoutes } from "./routes/auth.routes";
import { userRoutes } from "./routes/users.routes";
import { settingsRoutes } from "./routes/settings.routes";
import { folderRoutes } from "./routes/folders.routes";
import { feedRoutes } from "./routes/feeds.routes";
import { articleRoutes } from "./routes/articles.routes";
import { tagRoutes } from "./routes/tags.routes";

import { themeRoutes } from "./routes/theme.routes";
import { registerCronJobs } from "./lib/cron";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { db } from "./db/connection";

const clientDist = resolve(import.meta.dir, "../../client/dist");
const clientPublic = resolve(import.meta.dir, "../../client/public");

const app = new Hono();

app.use("*", logger());
app.use("*", errorHandler);
app.use("/api/*", authMiddleware);

app.route("/api/auth", authRoutes);
app.route("/api/users", userRoutes);
app.route("/api/settings", settingsRoutes);
app.route("/api/folders", folderRoutes);
app.route("/api/feeds", feedRoutes);
app.route("/api/articles", articleRoutes);
app.route("/api/tags", tagRoutes);

app.route("/api/theme", themeRoutes);

app.use("/assets/*", serveStatic({ root: clientDist }));
app.use("/icons/*", serveStatic({ root: clientPublic }));
app.use("/manifest.json", serveStatic({ path: resolve(clientPublic, "manifest.json") }));
app.use("/manifest.webmanifest", serveStatic({ path: resolve(clientDist, "manifest.webmanifest") }));
app.use("/sw.js", serveStatic({ path: resolve(clientDist, "sw.js") }));
app.use("/workbox-*.js", serveStatic({ root: clientDist }));
app.use("/registerSW.js", serveStatic({ root: clientDist }));

app.get("/favicon.ico", (c) => {
  const file = Bun.file(resolve(clientPublic, "favicon.ico"));
  if (file.size > 0) return c.body(file);
  return c.body("Not found", 404);
});

const indexHtml = resolve(clientDist, "index.html");

app.get("*", (c) => {
  return c.body(Bun.file(indexHtml));
});

registerCronJobs();

const migrationsFolder = resolve(import.meta.dir, "db/migrations");
migrate(db, { migrationsFolder });

export default {
  port: env.port,
  fetch: app.fetch,
};

console.log(`Rift server running on http://localhost:${env.port}`);