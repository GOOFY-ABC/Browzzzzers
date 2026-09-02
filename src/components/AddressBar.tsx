import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  RotateCw,
  X,
  Home,
  Lock,
  LockOpen,
  Star,
  BookOpen,
  Code2,
  Sparkles,
  Shield,
  MoreVertical,
  Sliders,
  History,
  Bookmark as BookmarkIcon,
  Terminal,
  Maximize2,
  ZoomIn,
  ZoomOut,
  HelpCircle,
  Search,
  Key,
} from 'lucide-react';
import { SEARCH_ENGINES } from '../lib/constants';
import { normalizeUrl } from '../lib/urlHelper';
import { SecurityPopover } from './SecurityPopover';
import { BrowserTab } from '../types';

interface AddressBarProps {
  activeTab: BrowserTab;
  onNavigate: (url: string) => void;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
  onStop: () => void;
  onHome: () => void;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  onToggleReader: () => void;
  onToggleSource: () => void;
  onToggleAi: () => void;
  isAiOpen: boolean;
  onToggleDevTools: () => void;
  isDevToolsOpen: boolean;
  onOpenHistory: () => void;
  onOpenBookmarks: () => void;
  onOpenSettings: () => void;
  onOpenAuthAssistant: () => void;
  onNewIncognitoTab: () => void;
  searchEngineId: string;
  isAdBlockEnabled: boolean;
  zoomLevel: number;
  onZoomChange: (delta: number) => void;
}

export const AddressBar: React.FC<AddressBarProps> = ({
  activeTab,
  onNavigate,
  onBack,
  onForward,
  onReload,
  onStop,
  onHome,
  isBookmarked,
  onToggleBookmark,
  onToggleReader,
  onToggleSource,
  onToggleAi,
  isAiOpen,
  onToggleDevTools,
  isDevToolsOpen,
  onOpenHistory,
  onOpenBookmarks,
  onOpenSettings,
  onOpenAuthAssistant,
  onNewIncognitoTab,
  searchEngineId,
  isAdBlockEnabled,
  zoomLevel,
  onZoomChange,
}) => {
  const [inputValue, setInputValue] = useState(activeTab.url);
  const [isFocused, setIsFocused] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync input value when activeTab.url changes, if not currently editing
  useEffect(() => {
    if (!isFocused) {
      setInputValue(activeTab.url.startsWith('about:') ? '' : activeTab.url);
    }
  }, [activeTab.url, isFocused]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    const resolved = normalizeUrl(inputValue, searchEngineId);
    onNavigate(resolved);
    if (inputRef.current) {
      inputRef.current.blur();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setInputValue(activeTab.url.startsWith('about:') ? '' : activeTab.url);
      if (inputRef.current) inputRef.current.blur();
    }
  };

  const currentEngine = SEARCH_ENGINES.find((s) => s.id === searchEngineId) || SEARCH_ENGINES[0];
  const isHttps = activeTab.url.startsWith('https://');
  const isInternal = activeTab.url.startsWith('about:');

  return (
    <div
      id="browser-address-bar"
      className="flex items-center gap-2 bg-slate-800 px-3 py-1.5 border-b border-slate-700/80 text-slate-200 select-none relative"
    >
      {/* Navigation Buttons: Back, Forward, Reload/Stop, Home */}
      <div className="flex items-center gap-0.5">
        <button
          id="btn-nav-back"
          onClick={onBack}
          disabled={!activeTab.canGoBack}
          className="p-1.5 rounded-md hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent text-slate-300 transition-colors"
          title="Click to go back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <button
          id="btn-nav-forward"
          onClick={onForward}
          disabled={!activeTab.canGoForward}
          className="p-1.5 rounded-md hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-transparent text-slate-300 transition-colors"
          title="Click to go forward"
        >
          <ArrowRight className="w-4 h-4" />
        </button>

        {activeTab.isLoading ? (
          <button
            id="btn-nav-stop"
            onClick={onStop}
            className="p-1.5 rounded-md hover:bg-slate-700 text-slate-300 transition-colors"
            title="Stop loading page"
          >
            <X className="w-4 h-4" />
          </button>
        ) : (
          <button
            id="btn-nav-reload"
            onClick={onReload}
            className="p-1.5 rounded-md hover:bg-slate-700 text-slate-300 transition-colors"
            title="Reload this page"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        )}

        <button
          id="btn-nav-home"
          onClick={onHome}
          className="p-1.5 rounded-md hover:bg-slate-700 text-slate-300 transition-colors"
          title="Open New Tab home"
        >
          <Home className="w-4 h-4" />
        </button>
      </div>

      {/* Omnibox / URL Input */}
      <form onSubmit={handleSubmit} className="flex-1 relative flex items-center">
        <div
          className={`flex items-center w-full bg-slate-900 border rounded-full px-3 py-1.5 transition-all text-xs ${
            isFocused
              ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-slate-900 shadow-inner'
              : 'border-slate-700/80 hover:border-slate-600 bg-slate-900/90'
          }`}
        >
          {/* Lock / Security Badge */}
          <button
            type="button"
            onClick={() => setShowSecurity(!showSecurity)}
            className="p-1 -ml-1 mr-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            title="View site information"
          >
            {isInternal ? (
              <Shield className="w-3.5 h-3.5 text-indigo-400" />
            ) : isHttps ? (
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <LockOpen className="w-3.5 h-3.5 text-amber-400" />
            )}
          </button>

          {/* Search Engine Icon Badge when empty or query */}
          {(!inputValue || !inputValue.startsWith('http')) && (
            <span className="text-xs mr-1.5 opacity-70 select-none">
              {currentEngine.icon}
            </span>
          )}

          {/* URL Input */}
          <input
            id="browser-omnibox-input"
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={() => {
              setIsFocused(true);
              inputRef.current?.select();
            }}
            onBlur={() => setIsFocused(false)}
            onKeyDown={handleKeyDown}
            placeholder={`Search with ${currentEngine.name} or enter web address...`}
            className="flex-1 bg-transparent border-none outline-none text-slate-100 placeholder-slate-500 font-mono text-xs"
            autoComplete="off"
            spellCheck="false"
          />

          {/* Action icons on the right side of omnibox */}
          <div className="flex items-center gap-1 ml-2">
            {/* Ad Shield indicator */}
            {isAdBlockEnabled && (
              <div
                className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-emerald-950/60 border border-emerald-800/50 text-emerald-300 select-none"
                title="Ad and Tracker Shield Active"
              >
                <Shield className="w-2.5 h-2.5" />
                <span>Shield</span>
              </div>
            )}

            {/* Auth / Login Assistant Button */}
            {!isInternal && (
              <button
                type="button"
                id="btn-auth-assistant"
                onClick={onOpenAuthAssistant}
                className={`p-1 rounded transition-colors ${
                  activeTab.url.includes('accounts.google.com') ||
                  activeTab.url.includes('login') ||
                  activeTab.url.includes('signin') ||
                  activeTab.url.includes('oauth')
                    ? 'text-amber-400 bg-amber-500/20 ring-1 ring-amber-400/40 animate-pulse'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
                title="Sign-In & Google Auth Assistant / Cookie Jar"
              >
                <Key className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Reader Mode Toggle */}
            {!isInternal && (
              <button
                type="button"
                id="btn-toggle-reader"
                onClick={onToggleReader}
                className={`p-1 rounded hover:bg-slate-800 transition-colors ${
                  activeTab.viewMode === 'reader'
                    ? 'text-indigo-400 bg-indigo-500/10'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Toggle Reader Mode"
              >
                <BookOpen className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Source Code Toggle */}
            {!isInternal && (
              <button
                type="button"
                id="btn-toggle-source"
                onClick={onToggleSource}
                className={`p-1 rounded hover:bg-slate-800 transition-colors ${
                  activeTab.viewMode === 'source'
                    ? 'text-emerald-400 bg-emerald-500/10'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="View Page Source / DOM"
              >
                <Code2 className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Bookmark Star Button */}
            {!isInternal && (
              <button
                type="button"
                id="btn-toggle-bookmark"
                onClick={onToggleBookmark}
                className={`p-1 rounded hover:bg-slate-800 transition-colors ${
                  isBookmarked
                    ? 'text-amber-400 fill-amber-400'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title={isBookmarked ? 'Remove bookmark' : 'Bookmark this tab'}
              >
                <Star className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-amber-400' : ''}`} />
              </button>
            )}
          </div>
        </div>

        {/* Security Popover */}
        <SecurityPopover
          url={activeTab.url}
          isOpen={showSecurity}
          onClose={() => setShowSecurity(false)}
          isAdBlockActive={isAdBlockEnabled}
        />
      </form>

      {/* Browser Toolbar Right Actions: AI Copilot, DevTools, Zoom, Main Menu */}
      <div className="flex items-center gap-1">
        {/* Gemini AI Copilot button */}
        <button
          id="btn-toggle-ai"
          onClick={onToggleAi}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
            isAiOpen
              ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/20'
              : 'bg-slate-700/60 hover:bg-slate-700 text-slate-200 border border-slate-600/50'
          }`}
          title="Toggle Gemini Web Assistant"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          <span className="hidden md:inline">AI Copilot</span>
        </button>

        {/* DevTools Toggle */}
        <button
          id="btn-toggle-devtools"
          onClick={onToggleDevTools}
          className={`p-1.5 rounded-md hover:bg-slate-700 transition-colors ${
            isDevToolsOpen ? 'text-indigo-400 bg-slate-700' : 'text-slate-300'
          }`}
          title="Toggle Developer Tools (Console, Network, Inspector)"
        >
          <Terminal className="w-4 h-4" />
        </button>

        {/* Browser Settings / Main Menu Button */}
        <div className="relative">
          <button
            id="btn-browser-menu"
            onClick={() => setShowMenu(!showMenu)}
            className={`p-1.5 rounded-md hover:bg-slate-700 transition-colors ${
              showMenu ? 'bg-slate-700 text-slate-100' : 'text-slate-300'
            }`}
            title="Customize and control Web Browser"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {/* Browser Main Menu Dropdown */}
          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-10 z-50 w-60 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl py-1.5 text-xs text-slate-200">
                <button
                  className="w-full px-3 py-2 text-left hover:bg-slate-700 flex items-center gap-2.5"
                  onClick={() => {
                    onNewIncognitoTab();
                    setShowMenu(false);
                  }}
                >
                  <Shield className="w-4 h-4 text-indigo-400" />
                  <span>New Private Window</span>
                </button>

                <button
                  className="w-full px-3 py-2 text-left hover:bg-slate-700 flex items-center gap-2.5"
                  onClick={() => {
                    onOpenHistory();
                    setShowMenu(false);
                  }}
                >
                  <History className="w-4 h-4 text-slate-400" />
                  <span>History</span>
                </button>

                <button
                  className="w-full px-3 py-2 text-left hover:bg-slate-700 flex items-center gap-2.5"
                  onClick={() => {
                    onOpenBookmarks();
                    setShowMenu(false);
                  }}
                >
                  <BookmarkIcon className="w-4 h-4 text-slate-400" />
                  <span>Bookmarks Manager</span>
                </button>

                <div className="h-px bg-slate-700 my-1" />

                {/* Zoom Controls */}
                <div className="px-3 py-1.5 flex items-center justify-between text-slate-300">
                  <span className="text-slate-400">Zoom</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onZoomChange(-0.1)}
                      className="p-1 rounded bg-slate-700 hover:bg-slate-600"
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-mono text-[11px] w-10 text-center">
                      {Math.round(zoomLevel * 100)}%
                    </span>
                    <button
                      onClick={() => onZoomChange(0.1)}
                      className="p-1 rounded bg-slate-700 hover:bg-slate-600"
                      title="Zoom In"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="h-px bg-slate-700 my-1" />

                <button
                  className="w-full px-3 py-2 text-left hover:bg-slate-700 flex items-center gap-2.5"
                  onClick={() => {
                    onOpenAuthAssistant();
                    setShowMenu(false);
                  }}
                >
                  <Key className="w-4 h-4 text-amber-400" />
                  <span>Sign-In & Cookie Manager</span>
                </button>

                <button
                  className="w-full px-3 py-2 text-left hover:bg-slate-700 flex items-center gap-2.5"
                  onClick={() => {
                    onToggleDevTools();
                    setShowMenu(false);
                  }}
                >
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span>Developer Tools</span>
                </button>

                <button
                  className="w-full px-3 py-2 text-left hover:bg-slate-700 flex items-center gap-2.5"
                  onClick={() => {
                    onOpenSettings();
                    setShowMenu(false);
                  }}
                >
                  <Sliders className="w-4 h-4 text-slate-400" />
                  <span>Settings & User Agent</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
