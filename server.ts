import express from 'express';
import path from 'path';
import { parse } from 'node-html-parser';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Lazy initialization of Gemini API
let genAiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!genAiClient && process.env.GEMINI_API_KEY) {
    genAiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return genAiClient;
}

// -------------------------------------------------------------
// Persistent In-Memory Cookie Jar for Proxy Sessions
// -------------------------------------------------------------
export interface StoredCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
  createdAt: number;
}

class CookieJar {
  private cookies: Map<string, StoredCookie> = new Map();

  private makeKey(domain: string, path: string, name: string): string {
    const cleanDomain = domain.toLowerCase().replace(/^\./, '');
    const cleanPath = path || '/';
    return `${cleanDomain}:${cleanPath}:${name}`;
  }

  public setCookie(cookie: Partial<StoredCookie> & { name: string; value: string; domain: string }): void {
    const domain = cookie.domain.toLowerCase().replace(/^\./, '');
    const path = cookie.path || '/';
    const key = this.makeKey(domain, path, cookie.name);
    
    this.cookies.set(key, {
      name: cookie.name,
      value: cookie.value,
      domain,
      path,
      expires: cookie.expires,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
      createdAt: Date.now(),
    });
  }

  public setCookiesFromHeader(setCookieHeader: string | string[] | null | undefined, requestUrl: string): void {
    if (!setCookieHeader) return;
    const headersList = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
    
    let reqHost = '';
    try {
      reqHost = new URL(requestUrl).hostname.toLowerCase();
    } catch {
      return;
    }

    for (const rawHeader of headersList) {
      if (!rawHeader) continue;
      // Handle potential comma-separated cookies (careful with expires date commas)
      const parts = rawHeader.split(';').map((p) => p.trim());
      if (parts.length === 0) continue;

      const firstPart = parts[0];
      const eqIdx = firstPart.indexOf('=');
      if (eqIdx === -1) continue;

      const name = firstPart.substring(0, eqIdx).trim();
      const value = firstPart.substring(eqIdx + 1).trim();
      if (!name) continue;

      let domain = reqHost;
      let path = '/';
      let expires: number | undefined;
      let httpOnly = false;
      let secure = false;
      let sameSite = 'Lax';

      for (let i = 1; i < parts.length; i++) {
        const attr = parts[i];
        const aEq = attr.indexOf('=');
        const attrName = (aEq === -1 ? attr : attr.substring(0, aEq)).trim().toLowerCase();
        const attrVal = aEq === -1 ? '' : attr.substring(aEq + 1).trim();

        if (attrName === 'domain' && attrVal) {
          domain = attrVal.toLowerCase().replace(/^\./, '');
        } else if (attrName === 'path' && attrVal) {
          path = attrVal;
        } else if (attrName === 'httponly') {
          httpOnly = true;
        } else if (attrName === 'secure') {
          secure = true;
        } else if (attrName === 'samesite') {
          sameSite = attrVal || 'Lax';
        } else if (attrName === 'max-age' && attrVal) {
          const maxAgeSec = parseInt(attrVal, 10);
          if (!isNaN(maxAgeSec)) {
            expires = Date.now() + maxAgeSec * 1000;
          }
        } else if (attrName === 'expires' && attrVal) {
          const expTime = Date.parse(attrVal);
          if (!isNaN(expTime)) {
            expires = expTime;
          }
        }
      }

      this.setCookie({
        name,
        value,
        domain,
        path,
        expires,
        httpOnly,
        secure,
        sameSite,
      });
    }
  }

  public getCookieHeader(targetUrl: string): string {
    try {
      const parsed = new URL(targetUrl);
      const host = parsed.hostname.toLowerCase();
      const reqPath = parsed.pathname || '/';
      const now = Date.now();

      const matched: string[] = [];

      for (const cookie of this.cookies.values()) {
        // Check expiration
        if (cookie.expires && cookie.expires < now) {
          continue;
        }

        // Check domain match (e.g. google.com matches accounts.google.com)
        const cDomain = cookie.domain.toLowerCase();
        const isDomainMatch = host === cDomain || host.endsWith('.' + cDomain);
        if (!isDomainMatch) continue;

        // Check path match
        if (!reqPath.startsWith(cookie.path)) continue;

        matched.push(`${cookie.name}=${cookie.value}`);
      }

      return matched.join('; ');
    } catch {
      return '';
    }
  }

  public getCookiesForDomain(domainFilter?: string): StoredCookie[] {
    const list: StoredCookie[] = [];
    const now = Date.now();
    const filter = domainFilter ? domainFilter.toLowerCase().replace(/^\./, '') : '';

    for (const cookie of this.cookies.values()) {
      if (cookie.expires && cookie.expires < now) continue;
      if (filter) {
        const cDomain = cookie.domain.toLowerCase();
        if (cDomain !== filter && !cDomain.endsWith('.' + filter) && !filter.endsWith('.' + cDomain)) {
          continue;
        }
      }
      list.push(cookie);
    }
    return list;
  }

  public deleteCookie(domain: string, name: string): void {
    const cleanDomain = domain.toLowerCase().replace(/^\./, '');
    for (const [key, cookie] of this.cookies.entries()) {
      if (cookie.domain.toLowerCase() === cleanDomain && cookie.name === name) {
        this.cookies.delete(key);
      }
    }
  }

  public clear(domainFilter?: string): void {
    if (!domainFilter) {
      this.cookies.clear();
      return;
    }
    const filter = domainFilter.toLowerCase().replace(/^\./, '');
    for (const [key, cookie] of this.cookies.entries()) {
      if (cookie.domain.toLowerCase().includes(filter)) {
        this.cookies.delete(key);
      }
    }
  }
}

const cookieJar = new CookieJar();

// Initialize default consent cookies to prevent Google/YouTube blocking and consent redirects
cookieJar.setCookiesFromHeader([
  'SOCS=CAESEwgDEgk2ODEwNjM1NzQaAmVuIAEaBgiA_LyaBg; Domain=.youtube.com; Path=/',
  'CONSENT=YES+cb.20240101-00-p0.en+FX+999; Domain=.youtube.com; Path=/',
  'PREF=f6=400&f5=30000; Domain=.youtube.com; Path=/',
  'SOCS=CAESEwgDEgk2ODEwNjM1NzQaAmVuIAEaBgiA_LyaBg; Domain=.google.com; Path=/',
  'CONSENT=YES+cb.20240101-00-p0.en+FX+999; Domain=.google.com; Path=/',
], 'https://www.youtube.com/');

// SSRF Protection: block loopback and private IP addresses
function isSafeUrl(targetUrl: string): { safe: boolean; reason?: string } {
  try {
    const parsed = new URL(targetUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { safe: false, reason: 'Only HTTP and HTTPS protocols are supported.' };
    }

    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host === '169.254.169.254' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host) ||
      host.endsWith('.local') ||
      host.endsWith('.internal')
    ) {
      return { safe: false, reason: 'Access to private or local network addresses is restricted.' };
    }

    return { safe: true };
  } catch {
    return { safe: false, reason: 'Invalid URL format' };
  }
}

// Common ad/tracker domain patterns to filter when ad blocking is active
const AD_PATTERNS = [
  'google-analytics.com',
  'googletagmanager.com',
  'doubleclick.net',
  'adservice.google.com',
  'analytics.twitter.com',
  'connect.facebook.net',
  'scorecardresearch.com',
  'quantserve.com',
  'outbrain.com',
  'taboola.com',
  'adroll.com',
];

function isAdDomain(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return AD_PATTERNS.some((pattern) => host.includes(pattern));
  } catch {
    return false;
  }
}

// Generate realistic browser headers for anti-detection / Google compliance
function getBrowserHeaders(targetUrl: string, customUserAgent?: string, isAsset = false): Record<string, string> {
  const ua = customUserAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  const cookieHeader = cookieJar.getCookieHeader(targetUrl);
  let origin = '';
  try {
    origin = new URL(targetUrl).origin;
  } catch {}

  if (isAsset) {
    const headers: Record<string, string> = {
      'User-Agent': ua,
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Sec-CH-UA': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
      'Sec-CH-UA-Mobile': '?0',
      'Sec-CH-UA-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'same-origin',
    };
    if (origin) {
      headers['Referer'] = `${origin}/`;
      headers['Origin'] = origin;
    }
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }
    return headers;
  }

  const headers: Record<string, string> = {
    'User-Agent': ua,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'en-US,en;q=0.9',
    'Sec-CH-UA': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    'Sec-CH-UA-Mobile': '?0',
    'Sec-CH-UA-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
  };

  if (cookieHeader) {
    headers['Cookie'] = cookieHeader;
  }

  return headers;
}

// Fetch with automatic redirect following & continuous CookieJar capture
async function fetchWithRedirects(
  initialUrl: string,
  options: {
    method?: string;
    body?: any;
    headers?: Record<string, string>;
    userAgent?: string;
    isAsset?: boolean;
  } = {},
  maxRedirects = 10
): Promise<{ response: Response; finalUrl: string; redirectChain: string[] }> {
  let currentUrl = initialUrl;
  let currentMethod = (options.method || 'GET').toUpperCase();
  let currentBody = options.body;
  const redirectChain: string[] = [initialUrl];

  for (let i = 0; i < maxRedirects; i++) {
    const headers = {
      ...getBrowserHeaders(currentUrl, options.userAgent, options.isAsset),
      ...(options.headers || {}),
    };

    // If method was converted to GET on redirect, strip body and content headers
    const requestInit: RequestInit = {
      method: currentMethod,
      headers,
      redirect: 'manual',
    };

    if (currentMethod !== 'GET' && currentMethod !== 'HEAD' && currentBody) {
      requestInit.body = currentBody;
    }

    const res = await fetch(currentUrl, requestInit);

    // Capture Set-Cookie headers from this hop
    if (typeof (res.headers as any).getSetCookie === 'function') {
      const setCookies = (res.headers as any).getSetCookie();
      cookieJar.setCookiesFromHeader(setCookies, currentUrl);
    } else {
      const rawSetCookie = res.headers.get('set-cookie');
      if (rawSetCookie) {
        cookieJar.setCookiesFromHeader(rawSetCookie, currentUrl);
      }
    }

    // Check for HTTP Redirect
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const location = res.headers.get('location');
      if (location) {
        const nextUrl = new URL(location, currentUrl).toString();
        redirectChain.push(nextUrl);
        currentUrl = nextUrl;

        // 302 / 303 redirects convert POST into GET
        if (res.status === 303 || res.status === 302) {
          currentMethod = 'GET';
          currentBody = undefined;
        }
        continue;
      }
    }

    return { response: res, finalUrl: currentUrl, redirectChain };
  }

  throw new Error(`Exceeded maximum redirects (${maxRedirects})`);
}

// -------------------------------------------------------------
// 1. Health check
// -------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// -------------------------------------------------------------
// 2. Cookie Management Endpoints (View, Add, Import, Delete)
// -------------------------------------------------------------
app.get('/api/cookies', (req, res) => {
  const domain = req.query.domain as string;
  const cookies = cookieJar.getCookiesForDomain(domain);
  res.json({ cookies, count: cookies.length });
});

app.post('/api/cookies', (req, res) => {
  const { cookies, cookie, rawCookieString, domain } = req.body;

  if (rawCookieString && domain) {
    // Parse raw "name=val; name2=val2" string
    const pairs = rawCookieString.split(';');
    for (const pair of pairs) {
      const eq = pair.indexOf('=');
      if (eq > 0) {
        const name = pair.substring(0, eq).trim();
        const value = pair.substring(eq + 1).trim();
        if (name) {
          cookieJar.setCookie({ name, value, domain: domain.replace(/^https?:\/\//, '').split('/')[0] });
        }
      }
    }
    return res.json({ success: true, message: 'Raw cookies parsed and stored' });
  }

  if (Array.isArray(cookies)) {
    for (const c of cookies) {
      if (c.name && c.domain) {
        cookieJar.setCookie(c);
      }
    }
    return res.json({ success: true, count: cookies.length });
  }

  if (cookie && cookie.name && cookie.domain) {
    cookieJar.setCookie(cookie);
    return res.json({ success: true, cookie });
  }

  res.status(400).json({ error: 'Invalid cookie payload' });
});

app.delete('/api/cookies', (req, res) => {
  const domain = (req.query.domain || req.body.domain) as string;
  const name = (req.query.name || req.body.name) as string;

  if (domain && name) {
    cookieJar.deleteCookie(domain, name);
    return res.json({ success: true, message: `Deleted ${name} for ${domain}` });
  }

  if (domain) {
    cookieJar.clear(domain);
    return res.json({ success: true, message: `Cleared all cookies for ${domain}` });
  }

  cookieJar.clear();
  res.json({ success: true, message: 'Cleared all browser proxy cookies' });
});

// -------------------------------------------------------------
// 3. Fetch Raw / DevTools Metadata / Reader Source
// -------------------------------------------------------------
app.get('/api/fetch', async (req, res) => {
  const targetUrl = req.query.url as string;
  const userAgent = (req.query.userAgent as string) || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

  if (!targetUrl) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  const check = isSafeUrl(targetUrl);
  if (!check.safe) {
    return res.status(403).json({ error: check.reason });
  }

  const startTime = Date.now();
  try {
    const { response, finalUrl } = await fetchWithRedirects(targetUrl, { userAgent });
    const elapsed = Date.now() - startTime;
    const contentType = response.headers.get('content-type') || 'text/html';
    const text = await response.text();

    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((val, key) => {
      responseHeaders[key] = val;
    });

    // Parse meta info
    const root = parse(text);
    const title = root.querySelector('title')?.text.trim() || targetUrl;
    const description = root.querySelector('meta[name="description"]')?.getAttribute('content') ||
      root.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
    const favicon = root.querySelector('link[rel="icon"]')?.getAttribute('href') ||
      root.querySelector('link[rel="shortcut icon"]')?.getAttribute('href') || '';
    const ogImage = root.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';

    let resolvedFavicon = favicon;
    if (favicon) {
      try {
        resolvedFavicon = new URL(favicon, finalUrl).toString();
      } catch {
        resolvedFavicon = '';
      }
    }

    // Extract text for reader mode
    const readerRoot = parse(text);
    readerRoot.querySelectorAll('script, style, noscript, nav, header, footer, iframe, form, svg').forEach((el) => el.remove());
    const mainContent = readerRoot.querySelector('article') ||
      readerRoot.querySelector('main') ||
      readerRoot.querySelector('.post-content') ||
      readerRoot.querySelector('.article-content') ||
      readerRoot.querySelector('#content') ||
      readerRoot.querySelector('body') ||
      readerRoot;

    const rawText = mainContent.text.replace(/\s+/g, ' ').trim();
    const wordCount = rawText ? rawText.split(/\s+/).length : 0;
    const readingTime = Math.max(1, Math.ceil(wordCount / 200));

    res.json({
      url: finalUrl,
      finalUrl,
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      contentType,
      size: `${(Buffer.byteLength(text, 'utf8') / 1024).toFixed(1)} KB`,
      timeMs: elapsed,
      title,
      description,
      favicon: resolvedFavicon,
      ogImage,
      rawHtml: text,
      reader: {
        title,
        content: mainContent.innerHTML,
        textContent: rawText,
        wordCount,
        readingTimeMinutes: readingTime,
      },
    });
  } catch (err: any) {
    res.status(502).json({
      error: `Failed to fetch page: ${err.message}`,
      timeMs: Date.now() - startTime,
    });
  }
});

// -------------------------------------------------------------
// Comprehensive HTML Rewriter & Bridge Injector
// -------------------------------------------------------------
function rewriteHtmlPage(html: string, finalUrl: string, blockAds: boolean, userAgent: string): string {
  const root = parse(html);

  // 1. Strip CSP, X-Frame-Options and Frame-busting meta headers
  root.querySelectorAll('meta[http-equiv="Content-Security-Policy" i], meta[http-equiv="content-security-policy" i], meta[http-equiv="X-Frame-Options" i], meta[http-equiv="x-frame-options" i], meta[http-equiv="Cross-Origin-Opener-Policy" i], meta[http-equiv="Cross-Origin-Embedder-Policy" i]').forEach((el) => el.remove());

  // 2. Ensure <head> exists
  let head = root.querySelector('head');
  if (!head) {
    const bodyEl = root.querySelector('body');
    if (bodyEl) {
      bodyEl.insertAdjacentHTML('beforebegin', '<head></head>');
      head = root.querySelector('head');
    }
  }

  // NOTE: We deliberately DO NOT inject <base href="..."> here, as <base> overrides relative API routes like /api/proxy/...
  if (head) {
    head.querySelectorAll('base').forEach((b) => b.remove());
  }

  // 3. Rewrite anchor links
  root.querySelectorAll('a').forEach((el) => {
    const href = el.getAttribute('href');
    if (href && !href.startsWith('#') && !href.startsWith('javascript:') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
      try {
        const absolute = new URL(href, finalUrl).toString();
        el.setAttribute('href', `/api/proxy/page?url=${encodeURIComponent(absolute)}&blockAds=${blockAds}`);
        el.setAttribute('target', '_self');
        el.setAttribute('data-original-href', absolute);
      } catch {}
    }
  });

  // 4. Rewrite forms (supports POST & GET)
  root.querySelectorAll('form').forEach((el) => {
    const action = el.getAttribute('action') || '';
    try {
      const absolute = new URL(action, finalUrl).toString();
      el.setAttribute('action', `/api/proxy/page`);
      el.setAttribute('data-original-action', absolute);
      
      el.insertAdjacentHTML('afterbegin', `
        <input type="hidden" name="__proxy_target_url" value="${encodeURIComponent(absolute)}" />
        <input type="hidden" name="__proxy_user_agent" value="${userAgent}" />
        <input type="hidden" name="__proxy_block_ads" value="${blockAds ? 'true' : 'false'}" />
      `);
    } catch {}
  });

  // 5. Rewrite stylesheets
  root.querySelectorAll('link').forEach((el) => {
    const href = el.getAttribute('href');
    if (href) {
      if (blockAds && isAdDomain(href)) {
        el.remove();
        return;
      }
      try {
        const absolute = new URL(href, finalUrl).toString();
        el.setAttribute('href', `/api/proxy/asset?url=${encodeURIComponent(absolute)}`);
      } catch {}
    }
  });

  // 6. Rewrite scripts
  root.querySelectorAll('script').forEach((el) => {
    const src = el.getAttribute('src');
    if (src) {
      if (blockAds && isAdDomain(src)) {
        el.remove();
        return;
      }
      try {
        const absolute = new URL(src, finalUrl).toString();
        el.setAttribute('src', `/api/proxy/asset?url=${encodeURIComponent(absolute)}`);
      } catch {}
    }
  });

  // 7. Rewrite IFRAMES to /api/proxy/page (CRUCIAL: Prevents recursive browser-in-browser inception!)
  root.querySelectorAll('iframe, frame').forEach((el) => {
    const src = el.getAttribute('src');
    if (src && !src.startsWith('javascript:') && !src.startsWith('about:')) {
      if (blockAds && isAdDomain(src)) {
        el.remove();
        return;
      }
      try {
        const absolute = new URL(src, finalUrl).toString();
        el.setAttribute('src', `/api/proxy/page?url=${encodeURIComponent(absolute)}&blockAds=${blockAds}`);
      } catch {}
    }
  });

  // 8. Rewrite media and images
  root.querySelectorAll('img, video, audio, source, track, embed, object').forEach((el) => {
    const src = el.getAttribute('src');
    if (src && !src.startsWith('data:') && !src.startsWith('blob:')) {
      if (blockAds && isAdDomain(src)) {
        el.remove();
        return;
      }
      try {
        const absolute = new URL(src, finalUrl).toString();
        el.setAttribute('src', `/api/proxy/asset?url=${encodeURIComponent(absolute)}`);
      } catch {}
    }
    const srcset = el.getAttribute('srcset');
    if (srcset) {
      try {
        const newSrcset = srcset.split(',').map((part) => {
          const [url, size] = part.trim().split(/\s+/);
          if (!url) return part;
          const absolute = new URL(url, finalUrl).toString();
          return `${`/api/proxy/asset?url=${encodeURIComponent(absolute)}`} ${size || ''}`.trim();
        }).join(', ');
        el.setAttribute('srcset', newSrcset);
      } catch {}
    }
  });

  const isGoogleAuthPage = finalUrl.includes('accounts.google.com') || finalUrl.includes('google.com/signin');

  // 9. Client-Side Proxy Bridge Script
  const bridgeScript = `
    <script id="__browser_proxy_bridge__">
      (function() {
        const CURRENT_URL = ${JSON.stringify(finalUrl)};
        const IS_GOOGLE_AUTH = ${isGoogleAuthPage ? 'true' : 'false'};

        // 1. Guard window.top and window.parent against frame-busting / browser inception
        try {
          Object.defineProperty(window, 'top', { get: function() { return window.self; }, configurable: true });
          Object.defineProperty(window, 'parent', { get: function() { return window.self; }, configurable: true });
        } catch(e) {}

        // 2. Safe ServiceWorker stub (Prevents modern SPAs like Neal.fun from crashing if SW fails in sandbox)
        if ('serviceWorker' in navigator) {
          try {
            const fakeReg = {
              scope: location.href,
              installing: null,
              waiting: null,
              active: null,
              navigationPreload: {
                enable: function() { return Promise.resolve(); },
                disable: function() { return Promise.resolve(); },
                setHeaderValue: function() { return Promise.resolve(); },
                getState: function() { return Promise.resolve({}); }
              },
              pushManager: {
                getSubscription: function() { return Promise.resolve(null); },
                subscribe: function() { return Promise.reject(new Error('Push not supported')); },
                permissionState: function() { return Promise.resolve('denied'); }
              },
              sync: { register: function() { return Promise.resolve(); } },
              periodicSync: { register: function() { return Promise.resolve(); } },
              update: function() { return Promise.resolve(); },
              unregister: function() { return Promise.resolve(true); },
              addEventListener: function() {},
              removeEventListener: function() {},
              dispatchEvent: function() { return true; }
            };
            navigator.serviceWorker.register = function() { return Promise.resolve(fakeReg); };
            navigator.serviceWorker.getRegistration = function() { return Promise.resolve(fakeReg); };
            navigator.serviceWorker.getRegistrations = function() { return Promise.resolve([fakeReg]); };
            navigator.serviceWorker.ready = Promise.resolve(fakeReg);
            try {
              Object.defineProperty(navigator.serviceWorker, 'controller', { get: function() { return null; }, configurable: true });
            } catch(e) {}
          } catch(e) {}
        }

        // 3. Intercept window.fetch for relative SPA requests & CORS assets (Neal.fun, YouTube, Next.js)
        const origFetch = window.fetch;
        window.fetch = function(input, init) {
          try {
            let url = typeof input === 'string' ? input : (input instanceof Request ? input.url : String(input));
            if (url && !url.startsWith('data:') && !url.startsWith('blob:') && !url.startsWith('/api/proxy/')) {
              const resolved = new URL(url, CURRENT_URL).toString();
              const proxiedUrl = '/api/proxy/asset?url=' + encodeURIComponent(resolved);
              if (typeof input === 'string') {
                input = proxiedUrl;
              } else if (input instanceof Request) {
                input = new Request(proxiedUrl, init || input);
              }
            }
          } catch(e) {}
          return origFetch.call(this, input, init);
        };

        // 4. Intercept XMLHttpRequest.prototype.open
        const origXhrOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url, ...rest) {
          try {
            if (typeof url === 'string' && !url.startsWith('data:') && !url.startsWith('blob:') && !url.startsWith('/api/proxy/')) {
              const resolved = new URL(url, CURRENT_URL).toString();
              url = '/api/proxy/asset?url=' + encodeURIComponent(resolved);
            }
          } catch(e) {}
          return origXhrOpen.call(this, method, url, ...rest);
        };

        // 5. Notify parent of successful page load
        function notifyParentLoaded(newUrl, newTitle) {
          try {
            window.parent.postMessage({
              type: 'BROWSER_PAGE_LOADED',
              url: newUrl || CURRENT_URL,
              title: newTitle || document.title || CURRENT_URL,
              favicon: (document.querySelector("link[rel*='icon']") || {}).href || '',
              isAuthPage: IS_GOOGLE_AUTH || (newUrl || CURRENT_URL).includes('login') || (newUrl || CURRENT_URL).includes('signin') || (newUrl || CURRENT_URL).includes('oauth')
            }, '*');
          } catch(e) {}
        }

        // Send initial load notification
        if (document.readyState === 'complete') {
          notifyParentLoaded(CURRENT_URL, document.title);
        } else {
          window.addEventListener('DOMContentLoaded', function() {
            notifyParentLoaded(CURRENT_URL, document.title);
          });
          window.addEventListener('load', function() {
            notifyParentLoaded(CURRENT_URL, document.title);
          });
        }

        // 6. Intercept SPA URL changes via history.pushState & replaceState
        const origPushState = history.pushState;
        history.pushState = function(state, unused, url) {
          const res = origPushState.apply(this, arguments);
          if (url) {
            try {
              const fullUrl = new URL(url, CURRENT_URL).toString();
              notifyParentLoaded(fullUrl, document.title);
            } catch(e) {}
          }
          return res;
        };

        const origReplaceState = history.replaceState;
        history.replaceState = function(state, unused, url) {
          const res = origReplaceState.apply(this, arguments);
          if (url) {
            try {
              const fullUrl = new URL(url, CURRENT_URL).toString();
              notifyParentLoaded(fullUrl, document.title);
            } catch(e) {}
          }
          return res;
        };

        // 7. Intercept window.open for popups
        const originalOpen = window.open;
        window.open = function(url, target, features) {
          try {
            const fullUrl = new URL(url, CURRENT_URL).toString();
            window.parent.postMessage({
              type: 'BROWSER_POPUP_REQUESTED',
              url: fullUrl,
              target: target || '_blank'
            }, '*');
            return null;
          } catch(e) {
            return originalOpen.apply(this, arguments);
          }
        };

        // 8. Observe title changes
        try {
          const titleEl = document.querySelector('title');
          if (titleEl) {
            const observer = new MutationObserver(function() {
              window.parent.postMessage({
                type: 'BROWSER_TITLE_CHANGED',
                title: document.title,
                url: CURRENT_URL
              }, '*');
            });
            observer.observe(titleEl, { childList: true, characterData: true, subtree: true });
          }
        } catch(e) {}

        // 9. Passive click listener for loading state (non-capturing so drag/drop & chess pieces are never blocked)
        document.addEventListener('click', function(e) {
          const anchor = e.target && e.target.closest ? e.target.closest('a') : null;
          if (anchor && anchor.href) {
            const href = anchor.getAttribute('href') || '';
            if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
              try {
                window.parent.postMessage({ type: 'BROWSER_START_LOADING' }, '*');
              } catch(e) {}
            }
          }
        }, false);

        // 10. Non-capturing form submission
        document.addEventListener('submit', function(e) {
          const form = e.target;
          if (!form) return;
          const originalAction = form.getAttribute('data-original-action') || form.action;
          if (originalAction && !form.querySelector('input[name="__proxy_target_url"]')) {
            const hidden = document.createElement('input');
            hidden.type = 'hidden';
            hidden.name = '__proxy_target_url';
            hidden.value = originalAction;
            form.appendChild(hidden);
          }
          try {
            window.parent.postMessage({ type: 'BROWSER_START_LOADING' }, '*');
          } catch(e) {}
        }, false);

        // 11. Listen for parent messages (Dark mode)
        window.addEventListener('message', function(event) {
          if (event.data && event.data.type === 'BROWSER_INJECT_DARK_THEME') {
            const style = document.createElement('style');
            style.id = '__browser_dark_override__';
            style.textContent = 'html { filter: invert(90%) hue-rotate(180deg) !important; background: #121212 !important; } img, video, canvas, iframe { filter: invert(100%) hue-rotate(180deg) !important; }';
            document.head.appendChild(style);
          }
        });
      })();
    </script>
    <style id="__webview_scrolling_fix__">
      html, body {
        min-height: 100% !important;
        width: 100% !important;
        -webkit-overflow-scrolling: touch !important;
        touch-action: pan-x pan-y !important;
      }
    </style>
  `;

  if (head) {
    head.insertAdjacentHTML('beforeend', bridgeScript);
  } else {
    root.insertAdjacentHTML('beforeend', bridgeScript);
  }

  return root.toString();
}

// Global variable tracking the most recently active proxied origin for referer-less asset fallbacks
let lastActiveProxiedOrigin = 'https://google.com';

// -------------------------------------------------------------
// Dedicated Full YouTube WebView App Experience Generator
// -------------------------------------------------------------
function renderYouTubeWebView(targetUrl: string): string {
  let videoId = '';
  let searchQuery = '';

  try {
    const parsed = new URL(targetUrl);
    if (parsed.searchParams.get('v')) {
      videoId = parsed.searchParams.get('v')!;
    } else if (parsed.searchParams.get('search_query')) {
      searchQuery = parsed.searchParams.get('search_query')!;
    } else if (parsed.searchParams.get('q')) {
      searchQuery = parsed.searchParams.get('q')!;
    }
  } catch {}

  if (!videoId) {
    const m = targetUrl.match(/(?:youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/);
    if (m) videoId = m[1];
  }

  // Curated Popular Videos for categories & default feed
  const curatedVideos = [
    { id: 'jfKfPfyJRdk', title: 'lofi hip hop radio 📚 beats to relax/study to', channel: 'Lofi Girl', views: '65K watching', time: 'LIVE', duration: 'LIVE', thumb: 'https://i.ytimg.com/vi/jfKfPfyJRdk/hqdefault.jpg', category: 'Music' },
    { id: '1-xGerv5FOk', title: 'Kurzgesagt – What If We Detonated All Nuclear Bombs at Once?', channel: 'Kurzgesagt – In a Nutshell', views: '28M views', time: '2 years ago', duration: '11:04', thumb: 'https://i.ytimg.com/vi/1-xGerv5FOk/hqdefault.jpg', category: 'Science' },
    { id: 'DPnqb74Smug', title: 'GothamChess: Magnus Carlsen Does The Impossible Again', channel: 'GothamChess', views: '1.4M views', time: '3 days ago', duration: '14:22', thumb: 'https://i.ytimg.com/vi/DPnqb74Smug/hqdefault.jpg', category: 'Chess' },
    { id: 'dQw4w9WgXcQ', title: 'Rick Astley - Never Gonna Give You Up (Official Music Video)', channel: 'Rick Astley', views: '1.5B views', time: '14 years ago', duration: '3:33', thumb: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg', category: 'Music' },
    { id: 'yX8yrOFlfWA', title: 'Building a Full Stack App in 10 Minutes with AI', channel: 'Fireship', views: '950K views', time: '2 weeks ago', duration: '8:45', thumb: 'https://i.ytimg.com/vi/yX8yrOFlfWA/hqdefault.jpg', category: 'Coding' },
    { id: 'd0NHOpeczUU', title: 'Neal.fun Infinite Craft World Record Discovery', channel: 'Aliensrock', views: '820K views', time: '1 month ago', duration: '22:15', thumb: 'https://i.ytimg.com/vi/d0NHOpeczUU/hqdefault.jpg', category: 'Gaming' },
    { id: '4xDzrJKXOOY', title: 'Earth from Space: 4K Ultra HD Relaxing Video with Ambient Music', channel: 'NASA Space & Science', views: '4.2M views', time: '1 year ago', duration: '1:00:00', thumb: 'https://i.ytimg.com/vi/4xDzrJKXOOY/hqdefault.jpg', category: 'Science' },
    { id: 'k85mRPqvMbE', title: 'Learn TypeScript in 50 Minutes - Full Crash Course', channel: 'freeCodeCamp.org', views: '1.1M views', time: '8 months ago', duration: '51:10', thumb: 'https://i.ytimg.com/vi/k85mRPqvMbE/hqdefault.jpg', category: 'Coding' },
  ];

  const initialVideo = videoId ? curatedVideos.find(v => v.id === videoId) || {
    id: videoId,
    title: 'YouTube Video Player',
    channel: 'YouTube Video',
    views: 'HD Streaming',
    time: 'Now Playing',
    duration: 'HD',
    thumb: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    category: 'All'
  } : null;

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${initialVideo ? initialVideo.title : (searchQuery ? `${searchQuery} - YouTube Search` : 'YouTube WebView')}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            background-color: #0f0f0f;
            color: #f1f1f1;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            display: flex;
            flex-direction: column;
            min-height: 100vh;
            overflow-x: hidden;
            -webkit-font-smoothing: antialiased;
          }
          header {
            position: sticky;
            top: 0;
            z-index: 50;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 18px;
            background: rgba(15, 15, 15, 0.96);
            backdrop-filter: blur(12px);
            border-bottom: 1px solid #272727;
            gap: 12px;
          }
          .logo {
            display: flex;
            align-items: center;
            gap: 8px;
            color: #fff;
            font-weight: 700;
            font-size: 17px;
            text-decoration: none;
            letter-spacing: -0.3px;
            flex-shrink: 0;
          }
          .logo svg { width: 28px; height: 28px; fill: #ff0000; }
          .logo-badge {
            font-size: 10px;
            background: #272727;
            color: #38bdf8;
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: 600;
            margin-left: 4px;
          }
          .search-form {
            display: flex;
            align-items: center;
            max-width: 540px;
            width: 100%;
            flex: 1;
            margin: 0 12px;
          }
          .search-form input {
            flex: 1;
            padding: 9px 16px;
            background: #121212;
            border: 1px solid #303030;
            border-radius: 24px 0 0 24px;
            color: #fff;
            outline: none;
            font-size: 14px;
            transition: border-color 0.15s ease;
          }
          .search-form input:focus { border-color: #3ea6ff; }
          .search-form button {
            background: #222;
            border: 1px solid #303030;
            border-left: none;
            border-radius: 0 24px 24px 0;
            padding: 9px 20px;
            color: #aaa;
            cursor: pointer;
            font-size: 14px;
          }
          .search-form button:hover { background: #333; color: #fff; }
          .chips-bar {
            display: flex;
            gap: 8px;
            padding: 10px 18px;
            background: #0f0f0f;
            overflow-x: auto;
            border-bottom: 1px solid #202020;
            white-space: nowrap;
            scrollbar-width: none;
          }
          .chips-bar::-webkit-scrollbar { display: none; }
          .chip {
            padding: 6px 14px;
            border-radius: 8px;
            background: #272727;
            color: #f1f1f1;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            border: none;
            transition: all 0.15s ease;
          }
          .chip:hover, .chip.active {
            background: #f1f1f1;
            color: #0f0f0f;
          }
          .main-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            padding: 18px;
            max-width: 1400px;
            width: 100%;
            margin: 0 auto;
          }
          .player-section {
            width: 100%;
            background: #000;
            border-radius: 12px;
            overflow: hidden;
            margin-bottom: 24px;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
          }
          .player-wrapper {
            position: relative;
            padding-bottom: 56.25%; /* 16:9 ratio */
            height: 0;
            overflow: hidden;
          }
          .player-wrapper iframe {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            border: 0;
          }
          .player-details {
            padding: 16px 20px;
            background: #181818;
            border-top: 1px solid #272727;
          }
          .player-title {
            font-size: 19px;
            font-weight: 600;
            color: #fff;
            margin-bottom: 8px;
            line-height: 1.3;
          }
          .player-meta {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 12px;
            color: #aaa;
            font-size: 13px;
          }
          .channel-info {
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .channel-avatar {
            width: 38px;
            height: 38px;
            border-radius: 50%;
            background: #333;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            color: #38bdf8;
          }
          .action-btn {
            background: #272727;
            color: #fff;
            border: none;
            padding: 7px 16px;
            border-radius: 18px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 6px;
          }
          .action-btn:hover { background: #383838; }
          .section-title {
            font-size: 18px;
            font-weight: 600;
            margin-bottom: 16px;
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .video-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
            gap: 20px 16px;
          }
          .video-card {
            cursor: pointer;
            text-decoration: none;
            color: inherit;
            display: flex;
            flex-direction: column;
            border-radius: 10px;
            overflow: hidden;
            transition: transform 0.15s ease, opacity 0.15s ease;
          }
          .video-card:hover { transform: translateY(-2px); }
          .video-thumb-container {
            position: relative;
            width: 100%;
            padding-bottom: 56.25%;
            background: #202020;
            border-radius: 10px;
            overflow: hidden;
          }
          .video-thumb {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .video-duration {
            position: absolute;
            bottom: 6px;
            right: 6px;
            background: rgba(0, 0, 0, 0.85);
            color: #fff;
            font-size: 11px;
            font-weight: 600;
            padding: 2px 5px;
            border-radius: 4px;
          }
          .video-info {
            padding: 10px 2px 0 2px;
          }
          .video-title {
            font-size: 14px;
            font-weight: 600;
            line-height: 1.35;
            color: #f1f1f1;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            margin-bottom: 4px;
          }
          .video-channel {
            font-size: 12px;
            color: #aaa;
            margin-bottom: 2px;
          }
          .video-stats {
            font-size: 12px;
            color: #888;
          }
        </style>
      </head>
      <body>
        <header>
          <a href="/api/proxy/page?url=https%3A%2F%2Fwww.youtube.com" class="logo">
            <svg viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
            <span>YouTube</span>
            <span class="logo-badge">WebView</span>
          </a>
          <form class="search-form" onsubmit="handleSearchSubmit(event)">
            <input type="text" id="yt-search-input" value="${searchQuery}" placeholder="Search YouTube or paste URL..." />
            <button type="submit">🔍</button>
          </form>
          <a href="${targetUrl}" target="_blank" class="action-btn">↗ External</a>
        </header>

        <div class="chips-bar">
          <button class="chip active" onclick="filterCategory('All', this)">All</button>
          <button class="chip" onclick="filterCategory('Music', this)">Music</button>
          <button class="chip" onclick="filterCategory('Gaming', this)">Gaming</button>
          <button class="chip" onclick="filterCategory('Science', this)">Science</button>
          <button class="chip" onclick="filterCategory('Chess', this)">Chess</button>
          <button class="chip" onclick="filterCategory('Coding', this)">Coding</button>
        </div>

        <div class="main-content">
          ${initialVideo ? `
            <div class="player-section">
              <div class="player-wrapper">
                <iframe
                  id="active-player"
                  src="https://www.youtube-nocookie.com/embed/${initialVideo.id}?autoplay=1&enablejsapi=1&rel=0&modestbranding=1"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                  allowfullscreen
                ></iframe>
              </div>
              <div class="player-details">
                <div class="player-title">${initialVideo.title}</div>
                <div class="player-meta">
                  <div class="channel-info">
                    <div class="channel-avatar">${initialVideo.channel.slice(0, 1)}</div>
                    <div>
                      <div style="font-weight:600;color:#fff;">${initialVideo.channel}</div>
                      <div>${initialVideo.views} • ${initialVideo.time}</div>
                    </div>
                  </div>
                  <div style="display:flex;gap:8px;">
                    <button class="action-btn" onclick="navigator.clipboard.writeText('https://www.youtube.com/watch?v=${initialVideo.id}')">📋 Copy Link</button>
                    <a href="https://www.youtube.com/watch?v=${initialVideo.id}" target="_blank" class="action-btn">Open in YouTube ↗</a>
                  </div>
                </div>
              </div>
            </div>
          ` : ''}

          <div class="section-title">
            <span>${searchQuery ? `Search Results for "${searchQuery}"` : (initialVideo ? 'Recommended Videos' : 'Trending on YouTube')}</span>
          </div>

          <div class="video-grid" id="video-grid">
            ${curatedVideos.map((video) => `
              <div class="video-card" data-category="${video.category}" onclick="playVideo('${video.id}', '${encodeURIComponent(video.title)}')">
                <div class="video-thumb-container">
                  <img class="video-thumb" src="${video.thumb}" alt="${video.title}" loading="lazy" />
                  <div class="video-duration">${video.duration}</div>
                </div>
                <div class="video-info">
                  <div class="video-title">${video.title}</div>
                  <div class="video-channel">${video.channel}</div>
                  <div class="video-stats">${video.views} • ${video.time}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <script>
          const TARGET_URL = ${JSON.stringify(targetUrl)};
          const CURRENT_VIDEO_ID = ${JSON.stringify(videoId || '')};

          function playVideo(id, title) {
            const newUrl = 'https://www.youtube.com/watch?v=' + id;
            location.href = '/api/proxy/page?url=' + encodeURIComponent(newUrl);
          }

          function handleSearchSubmit(e) {
            e.preventDefault();
            const q = document.getElementById('yt-search-input').value.trim();
            if (!q) return;
            if (q.startsWith('http://') || q.startsWith('https://')) {
              location.href = '/api/proxy/page?url=' + encodeURIComponent(q);
            } else {
              location.href = '/api/proxy/page?url=' + encodeURIComponent('https://www.youtube.com/results?search_query=' + encodeURIComponent(q));
            }
          }

          function filterCategory(cat, el) {
            document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            if (el) el.classList.add('active');
            const cards = document.querySelectorAll('.video-card');
            cards.forEach(card => {
              if (cat === 'All' || card.getAttribute('data-category') === cat) {
                card.style.display = 'flex';
              } else {
                card.style.display = 'none';
              }
            });
          }

          try {
            window.parent.postMessage({
              type: 'BROWSER_PAGE_LOADED',
              url: TARGET_URL,
              title: ${JSON.stringify(initialVideo ? initialVideo.title : 'YouTube')},
              favicon: 'https://www.youtube.com/favicon.ico'
            }, '*');
          } catch(e) {}
        </script>
      </body>
    </html>
  `;
}

// -------------------------------------------------------------
// 4. HTML Proxy with Form POST, Redirects, Cookies & Anti-Detection
// -------------------------------------------------------------
app.all('/api/proxy/page', async (req, res) => {
  let targetUrl = (req.query.url || req.body?.__proxy_target_url) as string;
  const userAgent = (req.query.userAgent as string) || (req.body?.__proxy_user_agent as string) || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  const blockAds = req.query.blockAds === 'true' || req.body?.__proxy_block_ads === 'true';

  if (!targetUrl) {
    return res.status(400).send('<h1>400 Bad Request</h1><p>Missing URL parameter.</p>');
  }

  // Ensure scheme
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = 'https://' + targetUrl;
  }

  const check = isSafeUrl(targetUrl);
  if (!check.safe) {
    return res.status(403).send(`
      <!DOCTYPE html>
      <html>
        <head><title>Access Blocked</title><style>body{font-family:sans-serif;padding:40px;text-align:center;background:#0f172a;color:#f8fafc;}</style></head>
        <body>
          <h2>🛡️ Security Restriction</h2>
          <p>${check.reason}</p>
        </body>
      </html>
    `);
  }

  // Track active proxied origin for referer-less asset fallbacks
  try {
    lastActiveProxiedOrigin = targetUrl;
  } catch {}

  // YouTube Intelligent WebView Interception
  if (targetUrl.includes('youtube.com') || targetUrl.includes('youtu.be')) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.removeHeader('X-Frame-Options');
    res.removeHeader('Content-Security-Policy');
    res.removeHeader('Cross-Origin-Embedder-Policy');
    res.removeHeader('Cross-Origin-Opener-Policy');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.send(renderYouTubeWebView(targetUrl));
  }

  try {
    // Prepare request method & body (supports Form POST submissions)
    const method = req.method;
    let body: any = undefined;
    const reqHeaders: Record<string, string> = {};

    if (method === 'POST' && req.body) {
      const contentType = req.headers['content-type'] || '';
      if (contentType.includes('application/x-www-form-urlencoded')) {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(req.body)) {
          if (!key.startsWith('__proxy_')) {
            params.append(key, String(value));
          }
        }
        body = params.toString();
        reqHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
      } else if (contentType.includes('application/json')) {
        body = JSON.stringify(req.body);
        reqHeaders['Content-Type'] = 'application/json';
      }
    }

    const { response, finalUrl } = await fetchWithRedirects(targetUrl, {
      method,
      body,
      headers: reqHeaders,
      userAgent,
    });

    const contentType = response.headers.get('content-type') || 'text/html';

    // If it's not HTML, stream as raw asset
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      const buffer = await response.arrayBuffer();
      res.setHeader('Content-Type', contentType);
      return res.send(Buffer.from(buffer));
    }

    const rawHtml = await response.text();
    const rewrittenHtml = rewriteHtmlPage(rawHtml, finalUrl, blockAds, userAgent);

    // Send the rewritten HTML
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.removeHeader('X-Frame-Options');
    res.removeHeader('Content-Security-Policy');
    res.removeHeader('Cross-Origin-Embedder-Policy');
    res.removeHeader('Cross-Origin-Opener-Policy');
    res.removeHeader('Cross-Origin-Resource-Policy');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(rewrittenHtml);
  } catch (err: any) {
    res.status(502).send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Browser Error - Connection Failed</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 80vh; margin: 0; }
            .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; max-width: 580px; width: 100%; padding: 32px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3); }
            h2 { margin-top: 0; color: #f43f5e; font-size: 20px; }
            p { color: #94a3b8; font-size: 14px; line-height: 1.6; }
            .url { background: #0f172a; padding: 10px 14px; border-radius: 6px; font-family: monospace; font-size: 13px; color: #38bdf8; word-break: break-all; margin: 16px 0; border: 1px solid #334155; }
            .btn { display: inline-block; background: #3b82f6; color: white; padding: 8px 18px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500; cursor: pointer; border: none; margin-right: 8px; }
            .btn:hover { background: #2563eb; }
            .btn-sec { background: #334155; color: #e2e8f0; }
            .btn-sec:hover { background: #475569; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>⚠️ Unable to connect to website</h2>
            <p>The browser proxy encountered an issue trying to reach the destination server:</p>
            <div class="url">${targetUrl}</div>
            <p><strong>Error:</strong> ${err.message || 'Host unreachable or request timed out.'}</p>
            <div style="margin-top: 20px;">
              <button class="btn" onclick="location.reload()">Try Again</button>
              <button class="btn btn-sec" onclick="history.back()">Go Back</button>
            </div>
          </div>
        </body>
      </html>
    `);
  }
});

// -------------------------------------------------------------
// 5. Asset Proxy (CSS, JS, Fonts, Images, Media, Sub-HTML, API Calls)
// -------------------------------------------------------------
app.all('/api/proxy/asset', async (req, res) => {
  const targetUrl = (req.query.url || req.body?.__proxy_target_url) as string;
  if (!targetUrl) {
    return res.status(400).send('Missing URL');
  }

  const check = isSafeUrl(targetUrl);
  if (!check.safe) {
    return res.status(403).send('Forbidden');
  }

  try {
    const headers = getBrowserHeaders(targetUrl);
    headers['Accept'] = '*/*';

    let body: any = undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    const { response, finalUrl } = await fetchWithRedirects(targetUrl, {
      method: req.method,
      body,
      headers,
      isAsset: true,
    });

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.removeHeader('X-Frame-Options');
    res.removeHeader('Content-Security-Policy');
    res.removeHeader('Cross-Origin-Embedder-Policy');
    res.removeHeader('Cross-Origin-Opener-Policy');
    res.setHeader('Cache-Control', 'public, max-age=86400');

    // If it's HTML, rewrite it
    if (contentType.includes('text/html') || contentType.includes('application/xhtml+xml')) {
      const rawHtml = await response.text();
      const rewritten = rewriteHtmlPage(rawHtml, finalUrl, false, headers['User-Agent']);
      return res.send(rewritten);
    }

    // If CSS, rewrite url(...) definitions inside the stylesheet
    if (contentType.includes('text/css')) {
      let cssText = await response.text();
      cssText = cssText.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (match, quote, url) => {
        if (url.startsWith('data:') || url.startsWith('#') || url.startsWith('blob:')) return match;
        try {
          const absolute = new URL(url, finalUrl).toString();
          return `url("/api/proxy/asset?url=${encodeURIComponent(absolute)}")`;
        } catch {
          return match;
        }
      });
      return res.send(cssText);
    }

    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err: any) {
    res.status(502).send(`Asset fetch error: ${err.message}`);
  }
});

// -------------------------------------------------------------
// 6. Gemini AI Page Assistant (Summarize, Q&A, Insights)
// -------------------------------------------------------------
app.post('/api/ai/analyze', async (req, res) => {
  const { url, title, content, mode, question, language } = req.body;

  const ai = getGeminiClient();
  if (!ai) {
    return res.status(503).json({
      error: 'GEMINI_API_KEY is not configured. Please add it to your environment.',
    });
  }

  try {
    const cleanContent = (content || '').slice(0, 15000);

    let systemInstruction = 'You are an intelligent web browser AI copilot. Provide concise, clear, and helpful analysis of the user-provided webpage content. Format responses in clean Markdown.';
    let prompt = '';

    switch (mode) {
      case 'summarize':
        prompt = `Please provide a structured summary of the webpage "${title}" (${url}).
Structure:
- **Core Summary**: 2-3 sentences capturing the main purpose/story.
- **Key Takeaways**: 4-5 bullet points of crucial insights.
- **Audience/Takeaway**: Who is this for and why it matters.

Page Content:
${cleanContent}`;
        break;

      case 'explain':
        prompt = `Explain the main topic and concepts of the webpage "${title}" in simple, intuitive terms as if explaining to a curious learner. Use analogies if helpful.

Page Content:
${cleanContent}`;
        break;

      case 'translate':
        prompt = `Translate the core summary and main text of the webpage "${title}" into ${language || 'Spanish'}. Maintain clear formatting and readability.

Page Content:
${cleanContent}`;
        break;

      case 'chat':
        prompt = `The user is browsing the webpage "${title}" (${url}) and asked: "${question}".
Answer the question accurately based on the page content below, or using your general knowledge if needed.

Page Content:
${cleanContent}`;
        break;

      case 'key_facts':
        prompt = `Extract all key statistics, dates, facts, quotes, and verifiable claims from this webpage: "${title}".

Page Content:
${cleanContent}`;
        break;

      default:
        prompt = `Analyze this webpage content and summarize key highlights:
${cleanContent}`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.3,
      },
    });

    res.json({
      result: response.text || 'No response generated.',
    });
  } catch (err: any) {
    res.status(500).json({ error: `AI analysis failed: ${err.message}` });
  }
});

// -------------------------------------------------------------
// 7. Catch-All Referer Proxy: Routes relative requests from proxied pages (SPAs, Next.js chunks, Neal.fun, YouTube sub-requests)
// -------------------------------------------------------------
app.use(async (req, res, next) => {
  // Ignore API endpoints, Vite internal paths, root, and app entry points
  if (
    req.path.startsWith('/api/') ||
    req.path.startsWith('/src/') ||
    req.path.startsWith('/@') ||
    req.path.startsWith('/node_modules/') ||
    req.path === '/' ||
    req.path === '/index.html' ||
    req.path === '/favicon.ico'
  ) {
    return next();
  }

  // Check if this request originated from a proxied page iframe
  const referer = (req.headers['referer'] as string) || '';
  let targetOriginUrl = '';

  if (referer.includes('/api/proxy/page')) {
    try {
      const refUrl = new URL(referer, `http://localhost:${PORT}`);
      const pageUrl = refUrl.searchParams.get('url');
      if (pageUrl) {
        targetOriginUrl = pageUrl;
      }
    } catch {}
  } else if (referer.includes('/api/proxy/asset')) {
    try {
      const refUrl = new URL(referer, `http://localhost:${PORT}`);
      const assetUrl = refUrl.searchParams.get('url');
      if (assetUrl) {
        targetOriginUrl = assetUrl;
      }
    } catch {}
  }

  // Fallback to the most recently active proxied origin
  if (!targetOriginUrl && lastActiveProxiedOrigin) {
    targetOriginUrl = lastActiveProxiedOrigin;
  }

  if (!targetOriginUrl) {
    return next();
  }

  try {
    const fullTargetUrl = new URL(req.originalUrl, targetOriginUrl).toString();
    const check = isSafeUrl(fullTargetUrl);
    if (!check.safe) {
      return res.status(403).send('Forbidden');
    }

    let body: any = undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    const { response, finalUrl } = await fetchWithRedirects(fullTargetUrl, {
      method: req.method,
      body,
      userAgent: req.headers['user-agent'] as string,
      isAsset: true,
    });

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.removeHeader('X-Frame-Options');
    res.removeHeader('Content-Security-Policy');
    res.removeHeader('Cross-Origin-Embedder-Policy');
    res.removeHeader('Cross-Origin-Opener-Policy');
    res.removeHeader('Cross-Origin-Resource-Policy');

    // If HTML, rewrite it with the proxy rewriter
    if (contentType.includes('text/html') || contentType.includes('application/xhtml+xml')) {
      const rawHtml = await response.text();
      const rewritten = rewriteHtmlPage(rawHtml, finalUrl, false, req.headers['user-agent'] as string);
      return res.send(rewritten);
    }

    // If CSS, rewrite url(...) definitions
    if (contentType.includes('text/css')) {
      let cssText = await response.text();
      cssText = cssText.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (match, quote, url) => {
        if (url.startsWith('data:') || url.startsWith('#') || url.startsWith('blob:')) return match;
        try {
          const absolute = new URL(url, finalUrl).toString();
          return `url("/api/proxy/asset?url=${encodeURIComponent(absolute)}")`;
        } catch {
          return match;
        }
      });
      return res.send(cssText);
    }

    const buffer = await response.arrayBuffer();
    return res.send(Buffer.from(buffer));
  } catch (err: any) {
    return res.status(502).send(`Proxy fetch error: ${err.message}`);
  }
});

// -------------------------------------------------------------
// Vite integration for Development & Production
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Browser-in-Browser server running on http://localhost:${PORT}`);
  });
}

startServer();
