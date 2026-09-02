import React, { useState } from 'react';
import { Plus, X, Globe, Pin, Volume2, VolumeX, Shield, MoreVertical } from 'lucide-react';
import { BrowserTab } from '../types';

interface TabBarProps {
  tabs: BrowserTab[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: () => void;
  onDuplicateTab: (id: string) => void;
  onTogglePinTab: (id: string) => void;
  onToggleMuteTab: (id: string) => void;
  onCloseOtherTabs: (id: string) => void;
}

export const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
  onDuplicateTab,
  onTogglePinTab,
  onToggleMuteTab,
  onCloseOtherTabs,
}) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tabId: string } | null>(null);

  const handleContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    setContextMenu({
      x: Math.min(e.clientX, window.innerWidth - 200),
      y: e.clientY,
      tabId,
    });
  };

  const closeMenu = () => setContextMenu(null);

  return (
    <div
      id="browser-tab-bar"
      className="flex items-center bg-slate-900 border-b border-slate-800/80 px-2 pt-2 select-none overflow-x-auto no-scrollbar relative"
      onClick={closeMenu}
    >
      {/* Window Controls (Mac/Unix style dots) */}
      <div className="flex items-center gap-1.5 mr-3 px-2 py-1">
        <div className="w-3 h-3 rounded-full bg-rose-500/80 hover:bg-rose-500 transition-colors cursor-pointer" title="Close window" />
        <div className="w-3 h-3 rounded-full bg-amber-500/80 hover:bg-amber-500 transition-colors cursor-pointer" title="Minimize" />
        <div className="w-3 h-3 rounded-full bg-emerald-500/80 hover:bg-emerald-500 transition-colors cursor-pointer" title="Maximize" />
      </div>

      {/* Tabs List */}
      <div className="flex items-center gap-1.5 flex-1 max-w-full overflow-x-auto no-scrollbar">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              id={`tab-${tab.id}`}
              onContextMenu={(e) => handleContextMenu(e, tab.id)}
              onClick={() => onSelectTab(tab.id)}
              className={`group relative flex items-center gap-2 h-9 px-3 rounded-t-lg text-xs font-medium cursor-pointer transition-all ${
                tab.isPinned ? 'w-12 justify-center' : 'min-w-[130px] max-w-[220px] flex-1'
              } ${
                isActive
                  ? 'bg-slate-800 text-slate-100 shadow-sm border-t border-x border-slate-700/60'
                  : 'bg-slate-900/60 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              {/* Incognito indicator */}
              {tab.isIncognito && (
                <Shield className="w-3.5 h-3.5 text-indigo-400 shrink-0" title="Private Browsing" />
              )}

              {/* Favicon or Loading Spinner */}
              {tab.isLoading ? (
                <div className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin shrink-0" />
              ) : tab.favicon ? (
                <img
                  src={tab.favicon}
                  alt=""
                  className="w-3.5 h-3.5 rounded-sm shrink-0 object-contain"
                  onError={(e) => {
                    // Fallback to Globe if image fails to load
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <Globe className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              )}

              {/* Tab Title (hidden if pinned) */}
              {!tab.isPinned && (
                <span className="truncate flex-1 text-[13px]">
                  {tab.title || (tab.url.startsWith('about:') ? 'New Tab' : tab.url)}
                </span>
              )}

              {/* Pin indicator */}
              {tab.isPinned && (
                <Pin className="w-3 h-3 text-amber-400 shrink-0" />
              )}

              {/* Mute indicator */}
              {tab.isMuted && (
                <VolumeX className="w-3 h-3 text-rose-400 shrink-0" />
              )}

              {/* Close Button (if not pinned, or visible on hover) */}
              {!tab.isPinned && (
                <button
                  id={`tab-close-${tab.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  className={`p-0.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-700/80 transition-colors ${
                    isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}
                  title="Close tab"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}

        {/* New Tab Button */}
        <button
          id="btn-new-tab"
          onClick={onNewTab}
          className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-md transition-colors shrink-0"
          title="Open new tab (Ctrl+T)"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Context Menu Modal */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 w-48 text-xs text-slate-200"
          style={{ top: contextMenu.y + 10, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-slate-700/70 flex items-center gap-2"
            onClick={() => {
              onDuplicateTab(contextMenu.tabId);
              closeMenu();
            }}
          >
            Duplicate Tab
          </button>
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-slate-700/70 flex items-center gap-2"
            onClick={() => {
              onTogglePinTab(contextMenu.tabId);
              closeMenu();
            }}
          >
            Pin / Unpin Tab
          </button>
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-slate-700/70 flex items-center gap-2"
            onClick={() => {
              onToggleMuteTab(contextMenu.tabId);
              closeMenu();
            }}
          >
            Mute / Unmute Tab
          </button>
          <div className="h-px bg-slate-700 my-1" />
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-slate-700/70 text-slate-300"
            onClick={() => {
              onCloseOtherTabs(contextMenu.tabId);
              closeMenu();
            }}
          >
            Close Other Tabs
          </button>
          <button
            className="w-full px-3 py-1.5 text-left hover:bg-rose-500/20 text-rose-300"
            onClick={() => {
              onCloseTab(contextMenu.tabId);
              closeMenu();
            }}
          >
            Close Tab
          </button>
        </div>
      )}
    </div>
  );
};
