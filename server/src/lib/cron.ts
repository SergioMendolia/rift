import { db, schema } from "../db/connection";
import { env } from "../env";
import { refreshFeed } from "../services/feed-service";
import { lt, and, eq, sql } from "drizzle-orm";

function hostnameOf(feedUrl: string | null): string | null {
  try {
    return feedUrl ? new URL(feedUrl).hostname : null;
  } catch {
    return null;
  }
}

export function registerCronJobs() {
  Bun.cron(env.pollCron, async () => {
    console.log(`[cron] Polling feeds at ${new Date().toISOString()}`);
    const feeds = await db
      .select({ id: schema.feeds.id, feedUrl: schema.feeds.feedUrl })
      .from(schema.feeds)
      .all();

    const byHost = new Map<string, number[]>();
    const noHost: number[] = [];
    for (const f of feeds) {
      const host = hostnameOf(f.feedUrl);
      if (host) {
        if (!byHost.has(host)) byHost.set(host, []);
        byHost.get(host)!.push(f.id);
      } else {
        noHost.push(f.id);
      }
    }

    const perHostDelayMs = 1500;
    const runSequentially = async (ids: number[]) => {
      for (const id of ids) {
        await refreshFeed(id).catch((err) => {
          console.error(`[cron] Feed ${id} failed:`, err);
        });
        await new Promise((r) => setTimeout(r, perHostDelayMs));
      }
    };

    const tasks = [...byHost.values()].map((ids) => runSequentially(ids));
    if (noHost.length > 0) {
      tasks.push(runSequentially(noHost));
    }
    await Promise.allSettled(tasks);

    console.log(`[cron] Polling complete. Processed ${feeds.length} feeds.`);
  });

  console.log(`[cron] Registered feed polling with schedule: ${env.pollCron}`);

  Bun.cron(env.cleanupCron, async () => {
    console.log(`[cron] Cleaning up old articles at ${new Date().toISOString()}`);
    try {
      await cleanupOldArticles();
    } catch (err) {
      console.error(`[cron] Article cleanup failed:`, err);
    }
  });

  console.log(`[cron] Registered article cleanup with schedule: ${env.cleanupCron}`);
}

/**
 * Delete articles older than 1 year that are not saved by any user.
 * SQLite cascades will remove the corresponding user_articles rows.
 */
export async function cleanupOldArticles(): Promise<number> {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const cutoff = oneYearAgo.toISOString();

  const stale = await db
    .select({ id: schema.articles.id })
    .from(schema.articles)
    .where(lt(schema.articles.publishedAt, cutoff))
    .all();

  if (stale.length === 0) return 0;

  const ids = stale.map((r) => r.id);

  const saved = await db
    .select({ articleId: schema.userArticles.articleId })
    .from(schema.userArticles)
    .where(eq(schema.userArticles.saved, true))
    .all();
  const savedSet = new Set(saved.map((r) => r.articleId));

  const toDelete = ids.filter((id) => !savedSet.has(id));
  if (toDelete.length === 0) return 0;

  const BATCH = 500;
  let deleted = 0;
  for (let i = 0; i < toDelete.length; i += BATCH) {
    const batch = toDelete.slice(i, i + BATCH);
    await db
      .delete(schema.articles)
      .where(
        sql`${schema.articles.id} IN (${sql.join(batch.map((id) => sql`${id}`), sql`,`)})`,
      );
    deleted += batch.length;
  }

  console.log(`[cleanup] Deleted ${deleted} articles older than ${cutoff}`);
  return deleted;
}