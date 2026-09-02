import { SEARCH_ENGINES } from './constants';

export function normalizeUrl(input: string, searchEngineId = 'duckduckgo'): string {
  const trimmed = input.trim();
  if (!trimmed) return '';

  // Special internal URLs
  if (trimmed === 'about:blank' || trimmed === 'about:newtab' || trimmed === 'about:history' || trimmed === 'about:bookmarks' || trimmed === 'about:settings') {
    return trimmed;
  }

  // Check if it's already a full protocol URL
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  // Check if it looks like a valid domain / IP (e.g., example.com, en.wikipedia.org, sub.domain.co.uk, localhost:8080)
  const isDomainPattern = /^(?!-)[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+(:[0-9]+)?(\/.*)?$/i;
  const isIpPattern = /^([0-9]{1,3}\.){3}[0-9]{1,3}(:[0-9]+)?(\/.*)?$/;

  if (isDomainPattern.test(trimmed) || isIpPattern.test(trimmed)) {
    return `https://${trimmed}`;
  }

  // Otherwise, treat as a search query
  const engine = SEARCH_ENGINES.find((e) => e.id === searchEngineId) || SEARCH_ENGINES[0];
  return `${engine.searchUrl}${encodeURIComponent(trimmed)}`;
}

export function getDomainFromUrl(url: string): string {
  try {
    if (!url || url.startsWith('about:')) return url || 'New Tab';
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function getFaviconUrl(url: string): string {
  try {
    if (!url || url.startsWith('about:')) return '';
    const parsed = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=64`;
  } catch {
    return '';
  }
}

export function isValidHttpUrl(string: string): boolean {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
