import { Bookmark, BrowserSettings, SearchEngine, UserAgentOption } from '../types';

export const SEARCH_ENGINES: SearchEngine[] = [
  {
    id: 'duckduckgo',
    name: 'DuckDuckGo',
    searchUrl: 'https://duckduckgo.com/html/?q=',
    icon: '🦆',
  },
  {
    id: 'google',
    name: 'Google',
    searchUrl: 'https://www.google.com/search?q=',
    icon: '🔍',
  },
  {
    id: 'bing',
    name: 'Bing',
    searchUrl: 'https://www.bing.com/search?q=',
    icon: '🌐',
  },
  {
    id: 'wikipedia',
    name: 'Wikipedia',
    searchUrl: 'https://en.wikipedia.org/w/index.php?search=',
    icon: '📚',
  },
  {
    id: 'ecosia',
    name: 'Ecosia',
    searchUrl: 'https://www.ecosia.org/search?q=',
    icon: '🌱',
  },
];

export const USER_AGENTS: UserAgentOption[] = [
  {
    id: 'chrome-mac',
    name: 'Chrome on macOS (Default)',
    category: 'Desktop',
    value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  },
  {
    id: 'chrome-win',
    name: 'Chrome on Windows 11',
    category: 'Desktop',
    value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  },
  {
    id: 'safari-mac',
    name: 'Safari on macOS',
    category: 'Desktop',
    value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  },
  {
    id: 'firefox-linux',
    name: 'Firefox on Linux',
    category: 'Desktop',
    value: 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0',
  },
  {
    id: 'iphone-safari',
    name: 'iPhone 15 Pro (Safari)',
    category: 'Mobile',
    value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  },
  {
    id: 'android-chrome',
    name: 'Pixel 8 Pro (Chrome Mobile)',
    category: 'Mobile',
    value: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  },
  {
    id: 'ipad-safari',
    name: 'iPad Pro (Safari)',
    category: 'Tablet',
    value: 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  },
];

export const DEFAULT_BOOKMARKS: Bookmark[] = [
  {
    id: 'bm-1',
    title: 'Wikipedia',
    url: 'https://en.wikipedia.org/wiki/Main_Page',
    favicon: 'https://en.wikipedia.org/static/favicon/wikipedia.ico',
    folder: 'Favorites',
    createdAt: 1700000000000,
  },
  {
    id: 'bm-2',
    title: 'Hacker News',
    url: 'https://news.ycombinator.com',
    favicon: 'https://news.ycombinator.com/favicon.ico',
    folder: 'Tech',
    createdAt: 1700000000001,
  },
  {
    id: 'bm-3',
    title: 'MDN Web Docs',
    url: 'https://developer.mozilla.org/en-US/',
    favicon: 'https://developer.mozilla.org/favicon-48x48.png',
    folder: 'Development',
    createdAt: 1700000000002,
  },
  {
    id: 'bm-4',
    title: 'BBC World News',
    url: 'https://www.bbc.com/news',
    favicon: 'https://www.bbc.com/favicon.ico',
    folder: 'News',
    createdAt: 1700000000003,
  },
  {
    id: 'bm-5',
    title: 'Internet Archive',
    url: 'https://archive.org',
    favicon: 'https://archive.org/favicon.ico',
    folder: 'Favorites',
    createdAt: 1700000000004,
  },
  {
    id: 'bm-6',
    title: 'GitHub Trends',
    url: 'https://github.com/trending',
    favicon: 'https://github.githubassets.com/favicons/favicon.png',
    folder: 'Development',
    createdAt: 1700000000005,
  },
  {
    id: 'bm-7',
    title: 'DuckDuckGo',
    url: 'https://duckduckgo.com/html/',
    favicon: 'https://duckduckgo.com/favicon.ico',
    folder: 'Favorites',
    createdAt: 1700000000006,
  },
  {
    id: 'bm-8',
    title: 'Project Gutenberg',
    url: 'https://www.gutenberg.org',
    favicon: 'https://www.gutenberg.org/gutenberg/favicon.ico',
    folder: 'Books',
    createdAt: 1700000000007,
  }
];

export const SPEED_DIAL_ITEMS = [
  {
    title: 'Wikipedia',
    url: 'https://en.wikipedia.org/wiki/Special:Random',
    desc: 'Free encyclopedia articles',
    icon: '📚',
    bg: 'from-blue-500/10 to-indigo-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400',
  },
  {
    title: 'Hacker News',
    url: 'https://news.ycombinator.com',
    desc: 'Tech & startup community',
    icon: '⚡',
    bg: 'from-amber-500/10 to-orange-500/10 border-amber-500/20 text-orange-600 dark:text-orange-400',
  },
  {
    title: 'MDN Web Docs',
    url: 'https://developer.mozilla.org/en-US/',
    desc: 'Resources for developers',
    icon: '💻',
    bg: 'from-emerald-500/10 to-teal-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400',
  },
  {
    title: 'BBC News',
    url: 'https://www.bbc.com/news',
    desc: 'World news & coverage',
    icon: '🌍',
    bg: 'from-red-500/10 to-rose-500/10 border-red-500/20 text-red-600 dark:text-red-400',
  },
  {
    title: 'Internet Archive',
    url: 'https://archive.org',
    desc: 'Millions of free digital books & media',
    icon: '🏛️',
    bg: 'from-purple-500/10 to-violet-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400',
  },
  {
    title: 'NASA News',
    url: 'https://www.nasa.gov',
    desc: 'Space science & exploration',
    icon: '🚀',
    bg: 'from-sky-500/10 to-cyan-500/10 border-sky-500/20 text-sky-600 dark:text-sky-400',
  },
];

export const DEFAULT_SETTINGS: BrowserSettings = {
  defaultSearchEngine: 'duckduckgo',
  userAgentId: 'chrome-mac',
  customUserAgent: '',
  enableAdBlock: true,
  enableScriptSanitize: true,
  autoHttps: true,
  newTabBackground: 'minimal',
  readerTheme: 'light',
  readerFontSize: 18,
  showBookmarksBar: true,
};
