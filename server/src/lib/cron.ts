import { eq } from "drizzle-orm";
import { db, schema } from "../db/connection";
import { env } from "../env";
import { refreshFeed } from "../services/feed-service";

export function registerCronJobs() {
  Bun.cron(env.pollCron, async () => {
    console.log(`[cron] Polling feeds at ${new Date().toISOString()}`);
    const feeds = await db.select({ id: schema.feeds.id }).from(schema.feeds).all();
    const feedIds = feeds.map((f) => f.id);

    const concurrencyLimit = 10;
    for (let i = 0; i < feedIds.length; i += concurrencyLimit) {
      const batch = feedIds.slice(i, i + concurrencyLimit);
      await Promise.allSettled(batch.map((id) => refreshFeed(id)));
    }
    console.log(`[cron] Polling complete. Processed ${feedIds.length} feeds.`);
  });

  console.log(`[cron] Registered feed polling with schedule: ${env.pollCron}`);
}