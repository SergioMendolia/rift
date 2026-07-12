import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// fetch is global in node 18+
const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

// Mock the db connection so bun:sqlite is never imported.
vi.mock("../src/db/connection", () => ({
  db: {
    query: {
      feeds: { findFirst: vi.fn() },
      subscriptions: { findFirst: vi.fn() },
      articles: { findFirst: vi.fn() },
      userArticles: { findFirst: vi.fn() },
    },
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
  schema: {
    feeds: { id: "feeds.id", url: "feeds.url" },
    subscriptions: { id: "subscriptions.id", userId: "subscriptions.user_id", feedId: "subscriptions.feed_id" },
    articles: { id: "articles.id", feedId: "articles.feed_id", guid: "articles.guid" },
    userArticles: { userId: "user_articles.user_id", articleId: "user_articles.article_id" },
  },
}));

function mockResponse(body: string, headers: Record<string, string> = {}, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Map(Object.entries(headers)) as any,
    text: () => Promise.resolve(body),
  };
}

async function importService() {
  return await import("../src/services/feed-service");
}

describe("discoverFeedUrl", () => {
  let discover: (url: string) => Promise<string>;

  beforeEach(async () => {
    vi.resetModules();
    fetchMock.mockReset();
    const svc = await importService();
    discover = svc.discoverFeedUrl;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the url as-is when response is already an RSS feed (xml content-type)", async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse('<?xml version="1.0"?><rss></rss>', {
        "content-type": "application/rss+xml",
      }),
    );

    await expect(discover("https://blog.example.com/feed.xml")).resolves.toBe(
      "https://blog.example.com/feed.xml",
    );
  });

  it("returns the url when body starts with <?xml regardless of content-type", async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse('<?xml version="1.0"?>\n<feed></feed>', {
        "content-type": "text/html",
      }),
    );

    await expect(discover("https://example.com/atom")).resolves.toBe(
      "https://example.com/atom",
    );
  });

  it("discovers an rss+xml <link> tag in an HTML page", async () => {
    const html = `<!DOCTYPE html><html><head>
      <link rel="alternate" type="application/rss+xml" href="/feed.xml" title="RSS" />
    </head><body>hi</body></html>`;

    fetchMock.mockResolvedValueOnce(mockResponse(html, { "content-type": "text/html" }));

    await expect(discover("https://example.com/")).resolves.toBe(
      "https://example.com/feed.xml",
    );
  });

  it("discovers an atom+xml <link> tag and resolves relative URLs against the page url", async () => {
    const html = `<html><head>
      <link rel="alternate" type="application/atom+xml" href="/blog/atom" />
    </head></html>`;
    fetchMock.mockResolvedValueOnce(mockResponse(html, { "content-type": "text/html" }));

    await expect(discover("https://example.com/blog/")).resolves.toBe(
      "https://example.com/blog/atom",
    );
  });

  it("handles absolute hrefs in the link tag", async () => {
    const html = `<head><link rel="alternate" type="application/rss+xml" href="https://feeds.example.com/full.xml" /></head>`;
    fetchMock.mockResolvedValueOnce(mockResponse(html, { "content-type": "text/html" }));

    await expect(discover("https://example.com")).resolves.toBe(
      "https://feeds.example.com/full.xml",
    );
  });

  it("ignores <link> tags that are not feed alternates", async () => {
    const html = `<head>
      <link rel="stylesheet" href="/style.css" />
      <link rel="alternate" type="text/html" href="/print" />
      <link rel="alternate" type="application/rss+xml" href="/index.xml" />
    </head>`;
    fetchMock.mockResolvedValueOnce(mockResponse(html, { "content-type": "text/html" }));

    await expect(discover("https://example.com")).resolves.toBe(
      "https://example.com/index.xml",
    );
  });

  it("falls back to probing common feed paths when no link tag is found", async () => {
    // page response: plain html with no feed links
    fetchMock.mockResolvedValueOnce(
      mockResponse("<html><body>no links</body></html>", { "content-type": "text/html" }),
    );
    // first probe /feed -> not xml
    fetchMock.mockResolvedValueOnce(mockResponse("ok", { "content-type": "text/html" }));
    // second probe /rss -> not xml
    fetchMock.mockResolvedValueOnce(mockResponse("ok", { "content-type": "text/html" }));
    // /rss.xml -> xml
    fetchMock.mockResolvedValueOnce(
      mockResponse('<?xml version="1.0"?><rss/>', { "content-type": "application/rss+xml" }),
    );

    await expect(discover("https://example.com")).resolves.toBe(
      "https://example.com/rss.xml",
    );
  });

  it("throws when the page responds with an error status", async () => {
    fetchMock.mockResolvedValueOnce(mockResponse("not found", {}, 404));

    await expect(discover("https://example.com")).rejects.toThrow("HTTP 404");
  });

  it("throws when no feed can be found anywhere", async () => {
    // page html, all probes return non-xml
    fetchMock.mockResolvedValueOnce(
      mockResponse("<html>nothing</html>", { "content-type": "text/html" }),
    );
    for (let i = 0; i < 6; i++) {
      fetchMock.mockResolvedValueOnce(mockResponse("ok", { "content-type": "text/html" }));
    }

    await expect(discover("https://example.com")).rejects.toThrow(
      "Could not find an RSS feed",
    );
  });

  it("rewrites a reddit subreddit URL to /.rss", async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse('<?xml version="1.0"?><rss></rss>', {
        "content-type": "application/rss+xml",
      }),
    );

    await expect(discover("https://www.reddit.com/r/selfhosted")).resolves.toBe(
      "https://www.reddit.com/r/selfhosted/.rss",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://www.reddit.com/r/selfhosted/.rss",
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it("does not double-append .rss to a reddit URL that already has it", async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse('<?xml version="1.0"?><rss></rss>', {
        "content-type": "application/rss+xml",
      }),
    );

    await expect(
      discover("https://www.reddit.com/r/selfhosted/.rss"),
    ).resolves.toBe("https://www.reddit.com/r/selfhosted/.rss");
  });

  it("preserves reddit search query string when rewriting", async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse('<?xml version="1.0"?><rss></rss>', {
        "content-type": "application/rss+xml",
      }),
    );

    await expect(
      discover("https://www.reddit.com/r/selfhosted/search?q=pihole&restrict_sr=1"),
    ).resolves.toBe(
      "https://www.reddit.com/r/selfhosted/search.rss?q=pihole&restrict_sr=1",
    );
  });
});