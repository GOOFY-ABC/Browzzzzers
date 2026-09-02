import React, { useRef, useEffect, useState } from 'react';
import { BrowserTab, BrowserSettings } from '../types';

interface ViewportProps {
  tab: BrowserTab;
  settings: BrowserSettings;
  zoomLevel: number;
  onPageLoaded: (tabId: string, title: string, favicon: string, finalUrl: string) => void;
  onTitleChanged: (tabId: string, title: string) => void;
  onNavigateInside: (tabId: string, url: string) => void;
  onStartLoading: (tabId: string) => void;
}

export const Viewport: React.FC<ViewportProps> = ({
  tab,
  settings,
  zoomLevel,
  onPageLoaded,
  onTitleChanged,
  onNavigateInside,
  onStartLoading,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loadProgress, setLoadProgress] = useState(0);

  // Compute Proxy URL
  const proxyUrl = tab.url && !tab.url.startsWith('about:')
    ? `/api/proxy/page?url=${encodeURIComponent(tab.url)}&blockAds=${settings.enableAdBlock}`
    : 'about:blank';

  // Fake smooth loading progress bar
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
        onPageLoaded(
          tab.id,
          data.title || tab.url,
          data.favicon || '',
          data.url || tab.url
        );
      } else if (data.type === 'BROWSER_TITLE_CHANGED') {
        onTitleChanged(tab.id, data.title || tab.url);
      } else if (data.type === 'BROWSER_LINK_CLICKED') {
        onNavigateInside(tab.id, data.url);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [tab.id, tab.url, onPageLoaded, onTitleChanged, onNavigateInside]);

  const handleIframeLoad = () => {
    // If we haven't received custom bridge postMessage, still complete the loading
    try {
      const iframeDoc = iframeRef.current?.contentDocument;
      if (iframeDoc && iframeDoc.title) {
        onTitleChanged(tab.id, iframeDoc.title);
      }
    } catch {}
    // Delay slightly to ensure smooth loading transition
    setTimeout(() => {
      onPageLoaded(tab.id, tab.title || tab.url, tab.favicon || '', tab.url);
    }, 200);
  };

  return (
    <div className="flex-1 relative w-full h-full bg-slate-900 overflow-hidden flex flex-col">
      {/* Top Loading Progress Bar */}
      {loadProgress > 0 && (
        <div
          className="absolute top-0 left-0 h-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 z-30 transition-all duration-200"
          style={{ width: `${loadProgress}%` }}
        />
      )}

      {/* Main Rendered Iframe */}
      <div
        className="w-full h-full flex-1 overflow-auto origin-top-left"
        style={{
          transform: zoomLevel !== 1 ? `scale(${zoomLevel})` : undefined,
          width: zoomLevel !== 1 ? `${(100 / zoomLevel).toFixed(2)}%` : '100%',
          height: zoomLevel !== 1 ? `${(100 / zoomLevel).toFixed(2)}%` : '100%',
        }}
      >
        <iframe
          id={`viewport-iframe-${tab.id}`}
          ref={iframeRef}
          src={proxyUrl}
          onLoad={handleIframeLoad}
          className="w-full h-full border-none bg-white"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
          title={tab.title || 'Web Viewport'}
        />
      </div>
    </div>
  );
};
