import { db, schema } from "../db/connection";
import { env } from "../env";
import { refreshFeed } from "../services/feed-service";

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
}