import { vi } from "vitest";
import { Hono } from "hono";
import type { UserDTO } from "@rift/shared";

/** A chainable mock that returns itself for any property access until a terminal call. */
function chainableMock() {
  const allQ: any[] = [];
  const getQ: any[] = [];
  const returningQ: any[] = [];

  const target: any = {
    all: vi.fn(() => (allQ.length ? allQ.shift() : [])),
    get: vi.fn(() => (getQ.length ? getQ.shift() : undefined)),
    returning: vi.fn(() => (returningQ.length ? returningQ.shift() : [])),
    then: undefined,
    _allQ: allQ,
    _getQ: getQ,
    _returningQ: returningQ,
  };

  const proxy = new Proxy(target, {
    get(t, prop) {
      if (prop in t) return t[prop];
      return vi.fn(() => proxy);
    },
  });
  return proxy;
}

export function makeMockDb() {
  const chain = chainableMock();

  const db: any = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({ returning: vi.fn(() => chain._returningQ.length ? chain._returningQ.shift() : []) })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn(() => ({})) })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({ returning: vi.fn(() => chain._returningQ.length ? chain._returningQ.shift() : []) })),
    })),
    query: {
      users: { findFirst: vi.fn(() => chain._getQ.length ? chain._getQ.shift() : undefined) },
      userSettings: { findFirst: vi.fn(() => chain._getQ.length ? chain._getQ.shift() : undefined) },
      folders: { findFirst: vi.fn(() => chain._getQ.length ? chain._getQ.shift() : undefined) },
      feeds: { findFirst: vi.fn(() => chain._getQ.length ? chain._getQ.shift() : undefined) },
      subscriptions: { findFirst: vi.fn(() => chain._getQ.length ? chain._getQ.shift() : undefined) },
      articles: { findFirst: vi.fn(() => chain._getQ.length ? chain._getQ.shift() : undefined) },
      userArticles: { findFirst: vi.fn(() => chain._getQ.length ? chain._getQ.shift() : undefined) },
    },
  };

  db._queueAll = (...vals: any[]) => { chain._allQ.push(...vals); };
  db._queueGet = (...vals: any[]) => { chain._getQ.push(...vals); };
  db._queueReturning = (...vals: any[]) => { chain._returningQ.push(...vals); };
  db._reset = () => {
    chain._allQ.length = 0;
    chain._getQ.length = 0;
    chain._returningQ.length = 0;
    for (const t of Object.values(db.query) as any[]) {
      for (const k of Object.keys(t)) if (typeof t[k] === "function") t[k].mockClear?.();
    }
    db.select.mockClear();
    db.insert.mockClear();
    db.update.mockClear();
    db.delete.mockClear();
  };

  const schema = {
    users: { id: "users.id", email: "users.email" },
    userSettings: { userId: "user_settings.user_id" },
    folders: { id: "folders.id", userId: "folders.user_id" },
    feeds: { id: "feeds.id", url: "feeds.url" },
    subscriptions: {
      id: "subscriptions.id",
      userId: "subscriptions.user_id",
      feedId: "subscriptions.feed_id",
    },
    articles: { id: "articles.id", feedId: "articles.feed_id" },
    userArticles: { userId: "user_articles.user_id", articleId: "user_articles.article_id" },
  };

  return { db, schema };
}

export function appWithUser(routes: Hono, user: UserDTO | null, mountPath = "/"): Hono {
  const app = new Hono();
  app.use("*", async (c, next) => {
    c.set("user", user);
    await next();
  });
  app.route(mountPath, routes);
  return app;
}

export async function request(
  app: Hono,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; data: any }> {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }
  const res = await app.request(`http://localhost${path}`, init);
  const text = await res.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { status: res.status, data };
}