export interface BrowserTab {
  id: string;
  url: string;
  inputUrl: string;
  title: string;
  favicon?: string;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  historyStack: string[];
  historyIndex: number;
  isPinned: boolean;
  isMuted: boolean;
  isIncognito?: boolean;
  viewMode: 'browser' | 'reader' | 'source';
}

export interface Bookmark {
  id: string;
  title: string;
  url: string;
  favicon?: string;
  folder?: string;
  createdAt: number;
}

export interface HistoryEntry {
  id: string;
  title: string;
  url: string;
  favicon?: string;
  visitedAt: number;
}

export interface SearchEngine {
  id: string;
  name: string;
  searchUrl: string;
  icon: string;
}

export interface UserAgentOption {
  id: string;
  name: string;
  category: 'Desktop' | 'Mobile' | 'Tablet' | 'Bot';
  value: string;
}

export interface BrowserSettings {
  defaultSearchEngine: string;
  userAgentId: string;
  customUserAgent: string;
  enableAdBlock: boolean;
  enableScriptSanitize: boolean;
  autoHttps: boolean;
  newTabBackground: 'minimal' | 'gradient' | 'warm';
  readerTheme: 'light' | 'dark' | 'sepia';
  readerFontSize: number;
  showBookmarksBar: boolean;
}

export interface NetworkLogItem {
  id: string;
  url: string;
  method: string;
  status: number;
  statusText: string;
  contentType: string;
  size: string;
  timeMs: number;
  timestamp: number;
  headers: Record<string, string>;
}

export interface PageMetadata {
  title: string;
  description?: string;
  favicon?: string;
  ogImage?: string;
  siteName?: string;
  author?: string;
  canonicalUrl?: string;
  status: number;
}

export interface ReaderContent {
  title: string;
  byline?: string;
  siteName?: string;
  content: string;
  textContent: string;
  readingTimeMinutes: number;
  wordCount: number;
  publishedTime?: string;
}
