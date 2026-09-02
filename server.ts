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
function getBrowserHeaders(targetUrl: string, customUserAgent?: string): Record<string, string> {
  const ua = customUserAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
  const cookieHeader = cookieJar.getCookieHeader(targetUrl);

  const headers: Record<string, string> = {
    'User-Agent': ua,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Sec-CH-UA': '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
    'Sec-CH-UA-Mobile': '?0',
    'Sec-CH-UA-Platform': '"macOS"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'Cache-Control': 'max-age=0',
  };

  if (cookieHeader) {
    headers['Cookie'] = cookieHeader;
  }

  try {
    const parsed = new URL(targetUrl);
    headers['Host'] = parsed.host;
    headers['Referer'] = `${parsed.protocol}//${parsed.host}/`;
  } catch {}

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
  } = {},
  maxRedirects = 10
): Promise<{ response: Response; finalUrl: string; redirectChain: string[] }> {
  let currentUrl = initialUrl;
  let currentMethod = (options.method || 'GET').toUpperCase();
  let currentBody = options.body;
  const redirectChain: string[] = [initialUrl];

  for (let i = 0; i < maxRedirects; i++) {
    const headers = {
      ...getBrowserHeaders(currentUrl, options.userAgent),
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
    // In standard fetch, getSetCookie() returns all set-cookie headers
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

        // 302 / 303 redirects typically convert POST into GET
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
// 4. HTML Proxy with Form POST, Redirects, Cookies & Anti-Detection
// -------------------------------------------------------------
app.all('/api/proxy/page', async (req, res) => {
  const targetUrl = (req.query.url || req.body.__proxy_target_url) as string;
  const userAgent = (req.query.userAgent as string) || (req.body.__proxy_user_agent as string) || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
  const blockAds = req.query.blockAds === 'true' || req.body.__proxy_block_ads === 'true';

  if (!targetUrl) {
    return res.status(400).send('<h1>400 Bad Request</h1><p>Missing URL parameter.</p>');
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

  try {
    // Prepare request method & body (supports Form POST submissions)
    const method = req.method;
    let body: any = undefined;
    const reqHeaders: Record<string, string> = {};

    if (method === 'POST') {
      const contentType = req.headers['content-type'] || '';
      if (contentType.includes('application/x-www-form-urlencoded')) {
        // Exclude internal proxy fields
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

    let html = await response.text();
    const root = parse(html);

    // Ensure <head> exists
    let head = root.querySelector('head');
    if (!head) {
      const bodyEl = root.querySelector('body');
      if (bodyEl) {
        bodyEl.insertAdjacentHTML('beforebegin', '<head></head>');
        head = root.querySelector('head');
      }
    }

    if (head) {
      head.querySelectorAll('base').forEach((b) => b.remove());
    }

    // Rewrite anchor links
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

    // Rewrite forms (support both GET and POST submissions via proxy)
    root.querySelectorAll('form').forEach((el) => {
      const action = el.getAttribute('action') || '';
      try {
        const absolute = new URL(action, finalUrl).toString();
        el.setAttribute('action', `/api/proxy/page`);
        el.setAttribute('data-original-action', absolute);
        
        // Inject hidden proxy target URL
        el.insertAdjacentHTML('afterbegin', `
          <input type="hidden" name="__proxy_target_url" value="${encodeURIComponent(absolute)}" />
          <input type="hidden" name="__proxy_user_agent" value="${userAgent}" />
          <input type="hidden" name="__proxy_block_ads" value="${blockAds ? 'true' : 'false'}" />
        `);
      } catch {}
    });

    // Rewrite stylesheets and links
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

    // Rewrite scripts
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

    // Rewrite images, videos, audio, source, iframe
    root.querySelectorAll('img, video, audio, source, iframe').forEach((el) => {
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

    // Detect if this page is a Google login or OAuth authentication endpoint
    const isGoogleAuthPage = finalUrl.includes('accounts.google.com') || finalUrl.includes('google.com/signin');

    // Injected Client-Side Bridge Script
    const bridgeScript = `
      <script id="__browser_proxy_bridge__">
        (function() {
          const CURRENT_URL = ${JSON.stringify(finalUrl)};
          const IS_GOOGLE_AUTH = ${isGoogleAuthPage ? 'true' : 'false'};

          // Notify parent of successful page load & authentication detection
          try {
            window.parent.postMessage({
              type: 'BROWSER_PAGE_LOADED',
              url: CURRENT_URL,
              title: document.title || CURRENT_URL,
              favicon: (document.querySelector("link[rel*='icon']") || {}).href || '',
              isAuthPage: IS_GOOGLE_AUTH || CURRENT_URL.includes('login') || CURRENT_URL.includes('signin') || CURRENT_URL.includes('oauth')
            }, '*');
          } catch(e) {}

          // Intercept OAuth and Popup window.open calls
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

          // Observe title changes
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

          // Intercept dynamic clicks
          document.addEventListener('click', function(e) {
            const anchor = e.target.closest('a');
            if (anchor && anchor.href) {
              const href = anchor.getAttribute('data-original-href') || anchor.href;
              if (href && !href.startsWith('javascript:') && !href.startsWith('mailto:') && !href.startsWith('#')) {
                window.parent.postMessage({
                  type: 'BROWSER_LINK_CLICKED',
                  url: href
                }, '*');
              }
            }
          }, true);

          // Handle form submissions dynamically
          document.addEventListener('submit', function(e) {
            const form = e.target;
            const originalAction = form.getAttribute('data-original-action') || form.action;
            if (originalAction && !form.querySelector('input[name="__proxy_target_url"]')) {
              const hidden = document.createElement('input');
              hidden.type = 'hidden';
              hidden.name = '__proxy_target_url';
              hidden.value = originalAction;
              form.appendChild(hidden);
            }
          }, true);

          // Listen for parent messages
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
    `;

    if (head) {
      head.insertAdjacentHTML('beforeend', bridgeScript);
    } else {
      root.insertAdjacentHTML('beforeend', bridgeScript);
    }

    // Send the rewritten HTML
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.removeHeader('X-Frame-Options');
    res.removeHeader('Content-Security-Policy');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(root.toString());
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
// 5. Asset Proxy (CSS, JS, Fonts, Images, Media)
// -------------------------------------------------------------
app.get('/api/proxy/asset', async (req, res) => {
  const targetUrl = req.query.url as string;
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

    const response = await fetch(targetUrl, {
      headers,
    });

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');

    // If CSS, rewrite url(...) definitions inside the stylesheet
    if (contentType.includes('text/css')) {
      let cssText = await response.text();
      cssText = cssText.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (match, quote, url) => {
        if (url.startsWith('data:') || url.startsWith('#')) return match;
        try {
          const absolute = new URL(url, targetUrl).toString();
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
