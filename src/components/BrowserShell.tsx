import React, { useState, useEffect, useCallback } from 'react';
import { TabBar } from './TabBar';
import { AddressBar } from './AddressBar';
import { BookmarksBar } from './BookmarksBar';
import { NewTabPage } from './NewTabPage';
import { Viewport } from './Viewport';
import { ReaderMode } from './ReaderMode';
import { SourceViewer } from './SourceViewer';
import { DevTools } from './DevTools';
import { AIAssistant } from './AIAssistant';
import { HistoryModal } from './HistoryModal';
import { BookmarksModal } from './BookmarksModal';
import { SettingsModal } from './SettingsModal';
import { AuthAssistantModal } from './AuthAssistantModal';
import { BrowserTab, Bookmark, HistoryEntry, BrowserSettings } from '../types';
import { DEFAULT_BOOKMARKS, DEFAULT_SETTINGS } from '../lib/constants';
import { getDomainFromUrl, getFaviconUrl, normalizeUrl } from '../lib/urlHelper';

export const BrowserShell: React.FC = () => {
  // Settings
  const [settings, setSettings] = useState<BrowserSettings>(() => {
    const saved = localStorage.getItem('browser_settings');
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  });

  // Tabs state
  const [tabs, setTabs] = useState<BrowserTab[]>(() => [
    {
      id: 'tab-initial-1',
      url: 'about:newtab',
      inputUrl: '',
      title: 'New Tab',
      favicon: '',
      isLoading: false,
      canGoBack: false,
      canGoForward: false,
      historyStack: ['about:newtab'],
      historyIndex: 0,
      isPinned: false,
      isMuted: false,
      viewMode: 'browser',
    },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('tab-initial-1');

  // Bookmarks
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => {
    const saved = localStorage.getItem('browser_bookmarks');
    return saved ? JSON.parse(saved) : DEFAULT_BOOKMARKS;
  });

  // History
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    const saved = localStorage.getItem('browser_history');
    return saved ? JSON.parse(saved) : [];
  });

  // UI Modals & Panes
  const [isDevToolsOpen, setIsDevToolsOpen] = useState(false);
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isBookmarksOpen, setIsBookmarksOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAuthAssistantOpen, setIsAuthAssistantOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('browser_settings', JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem('browser_bookmarks', JSON.stringify(bookmarks));
  }, [bookmarks]);

  useEffect(() => {
    localStorage.setItem('browser_history', JSON.stringify(history));
  }, [history]);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  // Helper to update active tab
  const updateTab = useCallback((tabId: string, updates: Partial<BrowserTab>) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, ...updates } : t))
    );
  }, []);

  // -------------------------------------------------------------
  // Navigation Engine
  // -------------------------------------------------------------
  const navigateTab = useCallback((targetUrl: string, tabId: string = activeTabId) => {
    const currentTab = tabs.find((t) => t.id === tabId);
    if (!currentTab) return;

    const normalized = normalizeUrl(targetUrl, settings.defaultSearchEngine);

    // New history stack
    const newHistory = currentTab.historyStack.slice(0, currentTab.historyIndex + 1);
    newHistory.push(normalized);

    setTabs((prev) =>
      prev.map((t) => {
        if (t.id === tabId) {
          return {
            ...t,
            url: normalized,
            inputUrl: normalized.startsWith('about:') ? '' : normalized,
            title: normalized.startsWith('about:') ? 'New Tab' : getDomainFromUrl(normalized),
            favicon: getFaviconUrl(normalized),
            isLoading: !normalized.startsWith('about:'),
            historyStack: newHistory,
            historyIndex: newHistory.length - 1,
            canGoBack: newHistory.length > 1,
            canGoForward: false,
            viewMode: 'browser',
          };
        }
        return t;
      })
    );

    // Record to history if not internal & not incognito
    if (!normalized.startsWith('about:') && !currentTab.isIncognito) {
      setHistory((prev) => [
        {
          id: `hist-${Date.now()}`,
          url: normalized,
          title: getDomainFromUrl(normalized),
          favicon: getFaviconUrl(normalized),
          visitedAt: Date.now(),
        },
        ...prev.slice(0, 199),
      ]);
    }
  }, [activeTabId, tabs, settings.defaultSearchEngine]);

  // Back / Forward / Reload / Stop / Home
  const handleBack = () => {
    if (activeTab.historyIndex > 0) {
      const newIndex = activeTab.historyIndex - 1;
      const prevUrl = activeTab.historyStack[newIndex];
      updateTab(activeTab.id, {
        url: prevUrl,
        inputUrl: prevUrl.startsWith('about:') ? '' : prevUrl,
        historyIndex: newIndex,
        canGoBack: newIndex > 0,
        canGoForward: true,
        isLoading: !prevUrl.startsWith('about:'),
      });
    }
  };

  const handleForward = () => {
    if (activeTab.historyIndex < activeTab.historyStack.length - 1) {
      const newIndex = activeTab.historyIndex + 1;
      const nextUrl = activeTab.historyStack[newIndex];
      updateTab(activeTab.id, {
        url: nextUrl,
        inputUrl: nextUrl.startsWith('about:') ? '' : nextUrl,
        historyIndex: newIndex,
        canGoBack: true,
        canGoForward: newIndex < activeTab.historyStack.length - 1,
        isLoading: !nextUrl.startsWith('about:'),
      });
    }
  };

  const handleReload = () => {
    if (activeTab.url.startsWith('about:')) return;
    updateTab(activeTab.id, { isLoading: true });
    // Toggle URL slightly or re-trigger
    const curr = activeTab.url;
    setTimeout(() => {
      updateTab(activeTab.id, { url: curr, isLoading: true });
    }, 50);
  };

  const handleStop = () => {
    updateTab(activeTab.id, { isLoading: false });
  };

  const handleHome = () => {
    navigateTab('about:newtab');
  };

  // -------------------------------------------------------------
  // Tab Management
  // -------------------------------------------------------------
  const handleNewTab = (initialUrl = 'about:newtab', isIncognito = false) => {
    const newId = `tab-${Date.now()}`;
    const newTab: BrowserTab = {
      id: newId,
      url: initialUrl,
      inputUrl: initialUrl.startsWith('about:') ? '' : initialUrl,
      title: initialUrl.startsWith('about:') ? 'New Tab' : getDomainFromUrl(initialUrl),
      favicon: getFaviconUrl(initialUrl),
      isLoading: !initialUrl.startsWith('about:'),
      canGoBack: false,
      canGoForward: false,
      historyStack: [initialUrl],
      historyIndex: 0,
      isPinned: false,
      isMuted: false,
      isIncognito,
      viewMode: 'browser',
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
  };

  const handleCloseTab = (id: string) => {
    if (tabs.length === 1) {
      // Don't close last tab, just reset to new tab
      updateTab(id, {
        url: 'about:newtab',
        title: 'New Tab',
        favicon: '',
        isLoading: false,
        historyStack: ['about:newtab'],
        historyIndex: 0,
        canGoBack: false,
        canGoForward: false,
        viewMode: 'browser',
      });
      return;
    }

    const idx = tabs.findIndex((t) => t.id === id);
    const newTabs = tabs.filter((t) => t.id !== id);
    setTabs(newTabs);

    if (activeTabId === id) {
      const nextActive = newTabs[Math.max(0, idx - 1)];
      setActiveTabId(nextActive.id);
    }
  };

  const handleDuplicateTab = (id: string) => {
    const target = tabs.find((t) => t.id === id);
    if (!target) return;
    const newId = `tab-${Date.now()}`;
    const duplicate: BrowserTab = {
      ...target,
      id: newId,
    };
    setTabs((prev) => [...prev, duplicate]);
    setActiveTabId(newId);
  };

  const handleTogglePinTab = (id: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isPinned: !t.isPinned } : t))
    );
  };

  const handleToggleMuteTab = (id: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isMuted: !t.isMuted } : t))
    );
  };

  const handleCloseOtherTabs = (id: string) => {
    setTabs((prev) => prev.filter((t) => t.id === id || t.isPinned));
    setActiveTabId(id);
  };

  // -------------------------------------------------------------
  // Bookmarks
  // -------------------------------------------------------------
  const isBookmarked = bookmarks.some((b) => b.url === activeTab.url);

  const handleToggleBookmark = () => {
    if (isBookmarked) {
      setBookmarks((prev) => prev.filter((b) => b.url !== activeTab.url));
    } else {
      setBookmarks((prev) => [
        {
          id: `bm-${Date.now()}`,
          title: activeTab.title || activeTab.url,
          url: activeTab.url,
          favicon: activeTab.favicon,
          folder: 'Favorites',
          createdAt: Date.now(),
        },
        ...prev,
      ]);
    }
  };

  // -------------------------------------------------------------
  // View Modes & DevTools
  // -------------------------------------------------------------
  const handleToggleReader = () => {
    updateTab(activeTab.id, {
      viewMode: activeTab.viewMode === 'reader' ? 'browser' : 'reader',
    });
  };

  const handleToggleSource = () => {
    updateTab(activeTab.id, {
      viewMode: activeTab.viewMode === 'source' ? 'browser' : 'source',
    });
  };

  // -------------------------------------------------------------
  // Keyboard Shortcuts
  // -------------------------------------------------------------
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 't') {
        e.preventDefault();
        handleNewTab();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'w') {
        e.preventDefault();
        handleCloseTab(activeTabId);
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'r') {
        e.preventDefault();
        handleReload();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'h') {
        e.preventDefault();
        setIsHistoryOpen(true);
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault();
        handleToggleBookmark();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTabId, activeTab]);

  // Page Load Callbacks from Iframe Bridge
  const handlePageLoaded = (tabId: string, title: string, favicon: string, finalUrl: string) => {
    updateTab(tabId, {
      title: title || getDomainFromUrl(finalUrl),
      favicon: favicon || getFaviconUrl(finalUrl),
      url: finalUrl,
      inputUrl: finalUrl.startsWith('about:') ? '' : finalUrl,
      isLoading: false,
    });
  };

  const handleTitleChanged = (tabId: string, title: string) => {
    updateTab(tabId, { title });
  };

  const handleNavigateInside = (tabId: string, url: string) => {
    navigateTab(url, tabId);
  };

  return (
    <div
      id="browser-root-window"
      className="flex flex-col w-full h-screen bg-slate-950 text-slate-100 overflow-hidden font-sans select-none"
    >
      {/* 1. Chrome Tab Bar */}
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={setActiveTabId}
        onCloseTab={handleCloseTab}
        onNewTab={() => handleNewTab()}
        onDuplicateTab={handleDuplicateTab}
        onTogglePinTab={handleTogglePinTab}
        onToggleMuteTab={handleToggleMuteTab}
        onCloseOtherTabs={handleCloseOtherTabs}
      />

      {/* 2. Omnibox / Address Toolbar */}
      <AddressBar
        activeTab={activeTab}
        onNavigate={(url) => navigateTab(url)}
        onBack={handleBack}
        onForward={handleForward}
        onReload={handleReload}
        onStop={handleStop}
        onHome={handleHome}
        isBookmarked={isBookmarked}
        onToggleBookmark={handleToggleBookmark}
        onToggleReader={handleToggleReader}
        onToggleSource={handleToggleSource}
        onToggleAi={() => setIsAiOpen(!isAiOpen)}
        isAiOpen={isAiOpen}
        onToggleDevTools={() => setIsDevToolsOpen(!isDevToolsOpen)}
        isDevToolsOpen={isDevToolsOpen}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenBookmarks={() => setIsBookmarksOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAuthAssistant={() => setIsAuthAssistantOpen(true)}
        onNewIncognitoTab={() => handleNewTab('about:newtab', true)}
        searchEngineId={settings.defaultSearchEngine}
        isAdBlockEnabled={settings.enableAdBlock}
        zoomLevel={zoomLevel}
        onZoomChange={(delta) => setZoomLevel((z) => Math.max(0.5, Math.min(2.0, Number((z + delta).toFixed(1)))))}
      />

      {/* 3. Bookmarks Bar */}
      {settings.showBookmarksBar && (
        <BookmarksBar
          bookmarks={bookmarks}
          onNavigate={(url) => navigateTab(url)}
          onOpenBookmarksManager={() => setIsBookmarksOpen(true)}
        />
      )}

      {/* 4. Main Body: Web Viewport + AI Assistant Sidebar */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Web Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden relative bg-slate-900">
          {activeTab.url === 'about:newtab' ? (
            <NewTabPage
              onNavigate={(url) => navigateTab(url)}
              searchEngineId={settings.defaultSearchEngine}
              onSearchEngineChange={(id) => setSettings((s) => ({ ...s, defaultSearchEngine: id }))}
            />
          ) : activeTab.viewMode === 'reader' ? (
            <ReaderMode
              url={activeTab.url}
              onClose={() => updateTab(activeTab.id, { viewMode: 'browser' })}
              onOpenAi={() => setIsAiOpen(true)}
            />
          ) : activeTab.viewMode === 'source' ? (
            <SourceViewer
              url={activeTab.url}
              onClose={() => updateTab(activeTab.id, { viewMode: 'browser' })}
            />
          ) : (
            <Viewport
              key={activeTab.id}
              tab={activeTab}
              settings={settings}
              zoomLevel={zoomLevel}
              onPageLoaded={handlePageLoaded}
              onTitleChanged={handleTitleChanged}
              onNavigateInside={handleNavigateInside}
              onStartLoading={(id) => updateTab(id, { isLoading: true })}
              onUpdateTab={updateTab}
            />
          )}

          {/* DevTools Drawer */}
          <DevTools
            url={activeTab.url}
            isOpen={isDevToolsOpen}
            onClose={() => setIsDevToolsOpen(false)}
          />
        </div>

        {/* Gemini AI Copilot Sidebar */}
        <AIAssistant
          url={activeTab.url}
          title={activeTab.title}
          isOpen={isAiOpen}
          onClose={() => setIsAiOpen(false)}
        />
      </div>

      {/* Modals */}
      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onNavigate={(url) => navigateTab(url)}
        onClearHistory={() => setHistory([])}
        onDeleteItem={(id) => setHistory((prev) => prev.filter((h) => h.id !== id))}
      />

      <BookmarksModal
        isOpen={isBookmarksOpen}
        onClose={() => setIsBookmarksOpen(false)}
        bookmarks={bookmarks}
        onNavigate={(url) => navigateTab(url)}
        onAddBookmark={(bm) =>
          setBookmarks((prev) => [
            { ...bm, id: `bm-${Date.now()}`, createdAt: Date.now() },
            ...prev,
          ])
        }
        onDeleteBookmark={(id) => setBookmarks((prev) => prev.filter((b) => b.id !== id))}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={(newS) => setSettings((prev) => ({ ...prev, ...newS }))}
        onClearAllData={() => {
          setHistory([]);
          setBookmarks(DEFAULT_BOOKMARKS);
          setSettings(DEFAULT_SETTINGS);
          localStorage.removeItem('browser_scratchpad_notes');
        }}
      />

      <AuthAssistantModal
        isOpen={isAuthAssistantOpen}
        onClose={() => setIsAuthAssistantOpen(false)}
        currentUrl={activeTab.url}
        onNavigate={(url) => navigateTab(url)}
        onReload={handleReload}
      />
    </div>
  );
};
