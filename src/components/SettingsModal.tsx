import React from 'react';
import {
  X,
  Sliders,
  Shield,
  Search,
  Globe,
  Trash2,
  CheckCircle,
  Smartphone,
  Laptop,
  Tablet,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { BrowserSettings, UserAgentOption } from '../types';
import { SEARCH_ENGINES, USER_AGENTS } from '../lib/constants';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: BrowserSettings;
  onUpdateSettings: (newSettings: Partial<BrowserSettings>) => void;
  onClearAllData: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onClearAllData,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-slate-100">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-850">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-semibold text-slate-200">Browser Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {/* 1. Default Search Engine */}
          <div className="space-y-2">
            <div className="font-semibold text-slate-200 flex items-center gap-2">
              <Search className="w-4 h-4 text-indigo-400" />
              <span>Default Search Engine</span>
            </div>
            <p className="text-slate-400 text-[11px]">
              Choose the search provider used when queries are entered into the Omnibox.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
              {SEARCH_ENGINES.map((engine) => {
                const isSelected = settings.defaultSearchEngine === engine.id;
                return (
                  <button
                    key={engine.id}
                    onClick={() => onUpdateSettings({ defaultSearchEngine: engine.id })}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-indigo-600/15 border-indigo-500 text-indigo-300 font-medium'
                        : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span className="text-base">{engine.icon}</span>
                    <span className="truncate">{engine.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. User Agent Switcher */}
          <div className="space-y-2 pt-4 border-t border-slate-800">
            <div className="font-semibold text-slate-200 flex items-center gap-2">
              <Laptop className="w-4 h-4 text-indigo-400" />
              <span>User-Agent Emulation</span>
            </div>
            <p className="text-slate-400 text-[11px]">
              Simulate various operating systems and mobile devices for testing responsive designs and site behaviors.
            </p>
            <div className="space-y-1.5 pt-1">
              {USER_AGENTS.map((ua) => {
                const isSelected = settings.userAgentId === ua.id;
                return (
                  <div
                    key={ua.id}
                    onClick={() => onUpdateSettings({ userAgentId: ua.id })}
                    className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-indigo-600/15 border-indigo-500 text-indigo-200'
                        : 'bg-slate-800/40 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {ua.category === 'Mobile' ? (
                        <Smartphone className="w-4 h-4 text-slate-400" />
                      ) : ua.category === 'Tablet' ? (
                        <Tablet className="w-4 h-4 text-slate-400" />
                      ) : (
                        <Laptop className="w-4 h-4 text-slate-400" />
                      )}
                      <div>
                        <div className="font-medium text-slate-200">{ua.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono truncate max-w-md">
                          {ua.value}
                        </div>
                      </div>
                    </div>
                    {isSelected && <CheckCircle className="w-4 h-4 text-indigo-400 shrink-0" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Security & Shield */}
          <div className="space-y-3 pt-4 border-t border-slate-800">
            <div className="font-semibold text-slate-200 flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>Privacy & Proxy Shields</span>
            </div>

            <div className="space-y-2">
              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-800 cursor-pointer">
                <div>
                  <div className="font-medium text-slate-200">Ad & Tracker Blocker</div>
                  <div className="text-slate-400 text-[11px]">
                    Filter known telemetry, analytics, and advertising scripts on proxied web pages.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.enableAdBlock}
                  onChange={(e) => onUpdateSettings({ enableAdBlock: e.target.checked })}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-800 cursor-pointer">
                <div>
                  <div className="font-medium text-slate-200">Show Bookmarks Bar</div>
                  <div className="text-slate-400 text-[11px]">
                    Display quick access bookmarks underneath the URL bar.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.showBookmarksBar}
                  onChange={(e) => onUpdateSettings({ showBookmarksBar: e.target.checked })}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* 4. Clear Browsing Data */}
          <div className="pt-4 border-t border-slate-800 space-y-2">
            <div className="font-semibold text-rose-400 flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
              <span>Reset & Clear Browsing Data</span>
            </div>
            <p className="text-slate-400 text-[11px]">
              Erase all history logs, scratchpad notes, cookies, and restore factory defaults.
            </p>
            <button
              onClick={() => {
                if (confirm('Are you sure you want to clear all history, scratchpad notes, and browser data?')) {
                  onClearAllData();
                  onClose();
                }
              }}
              className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-medium transition-colors"
            >
              Clear All Browsing Data
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-850 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            AuraBrowser v1.0 • Isolated Sandbox Proxy
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-sm transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
