import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { db, schema } from "../db/connection";
import { requireAuth } from "../middleware";
import { subscribeToFeed } from "../services/feed-service";
import { XMLParser, XMLBuilder } from "fast-xml-parser";

export const opmlRoutes = new Hono();

opmlRoutes.use("*", async (c, next) => {
  const user = requireAuth(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  await next();
});

opmlRoutes.post("/import", async (c) => {
  const user = requireAuth(c)!;
  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return c.json({ error: "No file provided" }, 400);

  const text = await file.text();
  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(text);

  const outlines = parsed?.opml?.body?.outline;
  if (!outlines) return c.json({ error: "Invalid OPML format" }, 400);

  const outlinesArray = Array.isArray(outlines) ? outlines : [outlines];
  const folders: Record<string, string[]> = {};
  const feeds: string[] = [];

  function processOutline(outline: any, folderName?: string) {
    if (outline["@_xmlUrl"]) {
      const url = outline["@_xmlUrl"];
      if (folderName) {
        if (!folders[folderName]) folders[folderName] = [];
        folders[folderName].push(url);
      } else {
        feeds.push(url);
      }
    }
    if (outline.outline) {
      const children = Array.isArray(outline.outline) ? outline.outline : [outline.outline];
      const newFolder = outline["@_text"] ?? outline["@_title"] ?? folderName;
      for (const child of children) {
        processOutline(child, newFolder);
      }
    }
  }

  for (const o of outlinesArray) {
    processOutline(o);
  }

  const folderIds: Record<string, number> = {};
  for (const folderName of Object.keys(folders)) {
    const result = await db
      .insert(schema.folders)
      .values({ userId: user.id, name: folderName, sortOrder: 0 })
      .returning();
    folderIds[folderName] = result[0]!.id;
  }

  let imported = 0;
  for (const url of feeds) {
    try {
      await subscribeToFeed(url, user.id, null);
      imported++;
    } catch (e) {
      console.error(`Failed to import feed ${url}:`, e);
    }
  }
  for (const [folderName, urls] of Object.entries(folders)) {
    const folderId = folderIds[folderName]!;
    for (const url of urls) {
      try {
        await subscribeToFeed(url, user.id, folderId);
        imported++;
      } catch (e) {
        console.error(`Failed to import feed ${url}:`, e);
      }
    }
  }

  return c.json({ imported });
});

opmlRoutes.get("/export", async (c) => {
  const user = requireAuth(c)!;

  const folders = await db
    .select()
    .from(schema.folders)
    .where(eq(schema.folders.userId, user.id))
    .all();

  const subs = await db
    .select()
    .from(schema.subscriptions)
    .where(eq(schema.subscriptions.userId, user.id))
    .all();

  const feeds = await db.select().from(schema.feeds).all();
  const feedMap = new Map(feeds.map((f) => [f.id, f]));

  const byFolder: Record<number | "none", typeof subs> = { none: [] };
  for (const sub of subs) {
    const key = sub.folderId ?? "none";
    if (!byFolder[key]) byFolder[key] = [];
    byFolder[key].push(sub);
  }

  const opml = {
    opml: {
      head: { title: "Rift Subscriptions" },
      body: {
        outline: [
          ...(byFolder.none as typeof subs).map((sub) => {
            const feed = feedMap.get(sub.feedId)!;
            return {
              "@_type": "rss",
              "@_text": sub.displayName ?? feed.title,
              "@_title": feed.title,
              "@_xmlUrl": feed.feedUrl,
              "@_htmlUrl": feed.siteUrl ?? "",
            };
          }),
          ...folders.map((folder) => ({
            "@_type": "folder",
            "@_text": folder.name,
            "@_title": folder.name,
            outline: (byFolder[folder.id] ?? []).map((sub) => {
              const feed = feedMap.get(sub.feedId)!;
              return {
                "@_type": "rss",
                "@_text": sub.displayName ?? feed.title,
                "@_title": feed.title,
                "@_xmlUrl": feed.feedUrl,
                "@_htmlUrl": feed.siteUrl ?? "",
              };
            }),
          })),
        ],
      },
    },
  };

  const builder = new XMLBuilder({ ignoreAttributes: false, format: true });
  const xml = builder.build(opml);

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Content-Disposition": 'attachment; filename="rift-subscriptions.opml"',
    },
  });
});