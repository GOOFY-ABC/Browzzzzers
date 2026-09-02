import React, { useRef, useEffect, useState } from 'react';
import { BrowserTab, BrowserSettings } from '../types';
import { ShieldCheck, Zap, Globe, RefreshCw, ExternalLink } from 'lucide-react';

interface ViewportProps {
  tab: BrowserTab;
  settings: BrowserSettings;
  zoomLevel: number;
  onPageLoaded: (tabId: string, title: string, favicon: string, finalUrl: string) => void;
  onTitleChanged: (tabId: string, title: string) => void;
  onNavigateInside: (tabId: string, url: string) => void;
  onStartLoading: (tabId: string) => void;
  onUpdateTab?: (tabId: string, updates: Partial<BrowserTab>) => void;
}

export const Viewport: React.FC<ViewportProps> = ({
  tab,
  settings,
  zoomLevel,
  onPageLoaded,
  onTitleChanged,
  onNavigateInside,
  onStartLoading,
  onUpdateTab,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loadProgress, setLoadProgress] = useState(0);
  const currentActiveUrlRef = useRef<string>('');
  const isDirect = tab.engineMode === 'direct';

  // Compute Target URL for iframe
  const computeIframeSrc = (targetUrl: string, direct: boolean) => {
    if (!targetUrl || targetUrl.startsWith('about:')) {
      return 'about:blank';
    }
    if (direct) {
      return targetUrl;
    }
    return `/api/proxy/page?url=${encodeURIComponent(targetUrl)}&blockAds=${settings.enableAdBlock}`;
  };

  // Only update iframe src when tab.url or engineMode changes
  useEffect(() => {
    const key = `${tab.url}::${isDirect ? 'direct' : 'proxy'}`;
    if (tab.url && key !== currentActiveUrlRef.current && iframeRef.current) {
      currentActiveUrlRef.current = key;
      iframeRef.current.src = computeIframeSrc(tab.url, isDirect);
    }
  }, [tab.url, isDirect, settings.enableAdBlock]);

  // Smooth loading progress bar
  useEffect(() => {
    let progressTimer: NodeJS.Timeout;
    if (tab.isLoading) {
      setLoadProgress(15);
      progressTimer = setInterval(() => {
        setLoadProgress((prev) => {
          if (prev >= 85) return prev;
          return prev + Math.floor(Math.random() * 15) + 5;
        });
      }, 200);
    } else {
      setLoadProgress(100);
      const doneTimer = setTimeout(() => setLoadProgress(0), 400);
      return () => clearTimeout(doneTimer);
    }

    return () => {
      if (progressTimer) clearInterval(progressTimer);
    };
  }, [tab.isLoading]);

  // Handle postMessage communication from the proxy bridge script
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'BROWSER_PAGE_LOADED') {
        const loadedUrl = data.url || tab.url;
        currentActiveUrlRef.current = `${loadedUrl}::${isDirect ? 'direct' : 'proxy'}`;
        onPageLoaded(
          tab.id,
          data.title || tab.title || loadedUrl,
          data.favicon || '',
          loadedUrl
        );
      } else if (data.type === 'BROWSER_TITLE_CHANGED') {
        onTitleChanged(tab.id, data.title || tab.url);
      } else if (data.type === 'BROWSER_START_LOADING') {
        onStartLoading(tab.id);
      } else if (data.type === 'BROWSER_POPUP_REQUESTED') {
        onNavigateInside(tab.id, data.url);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [tab.id, tab.url, tab.title, isDirect, onPageLoaded, onTitleChanged, onNavigateInside, onStartLoading]);

  const handleIframeLoad = () => {
    try {
      const iframeDoc = iframeRef.current?.contentDocument;
      if (iframeDoc && iframeDoc.title) {
        onTitleChanged(tab.id, iframeDoc.title);
      }
    } catch {}

    setTimeout(() => {
      onPageLoaded(tab.id, tab.title || tab.url, tab.favicon || '', tab.url);
    }, 250);
  };

  const handleHardReload = () => {
    if (iframeRef.current) {
      onStartLoading(tab.id);
      iframeRef.current.src = computeIframeSrc(tab.url, isDirect);
    }
  };

  const toggleEngineMode = () => {
    if (onUpdateTab) {
      const nextMode = isDirect ? 'proxy' : 'direct';
      onUpdateTab(tab.id, { engineMode: nextMode, isLoading: true });
    }
  };

  return (
    <div className="flex-1 relative w-full h-full bg-slate-900 overflow-hidden flex flex-col">
      {/* Top Loading Progress Bar */}
      {loadProgress > 0 && (
        <div
          className="absolute top-0 left-0 h-0.5 bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-500 z-30 transition-all duration-200 pointer-events-none"
          style={{ width: `${loadProgress}%` }}
        />
      )}

      {/* Main Rendered Iframe - overflow-hidden wrapper ensures native scrolling inside iframe */}
      <div
        className="w-full h-full flex-1 overflow-hidden origin-top-left"
        style={{
          transform: zoomLevel !== 1 ? `scale(${zoomLevel})` : undefined,
          transformOrigin: '0 0',
          width: zoomLevel !== 1 ? `${(100 / zoomLevel).toFixed(2)}%` : '100%',
          height: zoomLevel !== 1 ? `${(100 / zoomLevel).toFixed(2)}%` : '100%',
        }}
      >
        <iframe
          id={`viewport-iframe-${tab.id}`}
          ref={iframeRef}
          src={computeIframeSrc(tab.url, isDirect)}
          onLoad={handleIframeLoad}
          className="w-full h-full border-none bg-white block"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-downloads allow-pointer-lock allow-presentation allow-orientation-lock"
          allow="accelerometer; autoplay; clipboard-read; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen; microphone; camera; geolocation; display-capture; midi"
          title={tab.title || 'App WebView'}
        />
      </div>

      {/* Bottom Subtle WebView Engine Badge & Quick Switcher */}
      {tab.url && !tab.url.startsWith('about:') && (
        <div className="absolute bottom-3 right-4 z-20 flex items-center gap-1.5 bg-slate-900/85 hover:bg-slate-900 backdrop-blur-md px-2.5 py-1 rounded-full border border-slate-700/60 shadow-lg text-[11px] text-slate-300 transition-all">
          <button
            onClick={toggleEngineMode}
            title={isDirect ? "Switch to High-Compatibility Proxy Engine" : "Switch to Direct Unrestricted Native WebView"}
            className="flex items-center gap-1 hover:text-sky-400 transition-colors"
          >
            {isDirect ? <Globe className="w-3 h-3 text-emerald-400" /> : <Zap className="w-3 h-3 text-sky-400" />}
            <span className="font-medium">{isDirect ? 'Direct Native' : 'WebView Engine'}</span>
          </button>
          <span className="text-slate-600">|</span>
          <button
            onClick={handleHardReload}
            title="Hard Reload WebView"
            className="hover:text-white transition-colors"
          >
            <RefreshCw className="w-2.5 h-2.5" />
          </button>
          <a
            href={tab.url}
            target="_blank"
            rel="noreferrer"
            title="Open page in a new browser tab"
            className="hover:text-white transition-colors"
          >
            <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      )}
    </div>
  );
};


