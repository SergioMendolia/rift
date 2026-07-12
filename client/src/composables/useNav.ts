import type { ArticleFilter } from "../stores/articles";

export function filterFromRoute(
  name: string,
  params: Record<string, string>,
): ArticleFilter {
  if (name.includes("saved")) return { type: "saved" };
  if (name.includes("feed")) return { type: "feed", feedId: Number(params.feedId) };
  if (name.includes("folder")) return { type: "folder", folderId: Number(params.folderId) };
  return { type: "all" };
}

export function filterPath(filter: ArticleFilter): string {
  switch (filter.type) {
    case "saved":
      return "/saved";
    case "feed":
      return `/feed/${filter.feedId}`;
    case "folder":
      return `/folder/${filter.folderId}`;
    default:
      return "/all";
  }
}

export function filterArticlePath(filter: ArticleFilter, articleId: number): string {
  return `${filterPath(filter)}/article/${articleId}`;
}

export function articleIdFromRoute(params: Record<string, string>): number | null {
  const raw = params.articleId;
  if (!raw) return null;
  const id = Number(raw);
  return Number.isFinite(id) ? id : null;
}