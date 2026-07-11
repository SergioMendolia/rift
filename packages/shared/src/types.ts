export type Theme = "light" | "dark" | "sepia" | "custom";

export interface UserDTO {
  id: number;
  email: string;
  displayName: string;
  isAdmin: boolean;
}

export interface UserSettingsDTO {
  theme: Theme;
  markReadOnOpen: boolean;
}

export interface FolderDTO {
  id: number;
  name: string;
  sortOrder: number;
}

export interface FeedDTO {
  id: number;
  title: string;
  feedUrl: string;
  siteUrl: string | null;
  faviconUrl: string | null;
  lastFetchedAt: string | null;
  lastError: string | null;
  subscriptionId: number;
  folderId: number | null;
  displayName: string | null;
  unreadCount: number;
}

export interface ArticleDTO {
  id: number;
  feedId: number;
  feedTitle: string;
  guid: string;
  title: string;
  link: string;
  author: string | null;
  summary: string | null;
  content: string | null;
  publishedAt: string;
  read: boolean;
  saved: boolean;
  tags: TagDTO[];
}

export interface TagDTO {
  id: number;
  name: string;
  color: string | null;
}

export interface ArticleListResponse {
  articles: ArticleDTO[];
  nextCursor: number | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: UserDTO;
}

export interface SetupRequest {
  email: string;
  password: string;
  displayName: string;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  displayName: string;
}

export interface UpdateArticleRequest {
  read?: boolean;
  saved?: boolean;
}

export interface CreateFeedRequest {
  url: string;
  folderId?: number | null;
}

export interface CreateFolderRequest {
  name: string;
}

export interface UpdateSettingsRequest {
  theme?: Theme;
  markReadOnOpen?: boolean;
}