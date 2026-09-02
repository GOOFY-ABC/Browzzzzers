import React, { useState } from 'react';
import { X, Search, Trash2, Globe, Clock, ExternalLink } from 'lucide-react';
import { HistoryEntry } from '../types';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryEntry[];
  onNavigate: (url: string) => void;
  onClearHistory: () => void;
  onDeleteItem: (id: string) => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  history,
  onNavigate,
  onClearHistory,
  onDeleteItem,
}) => {
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const filtered = history.filter(
    (item) =>
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.url.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-slate-100">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-850">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-semibold text-slate-200">Browsing History</h2>
            <span className="text-xs text-slate-500 font-mono">({history.length} items)</span>
          </div>

          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                onClick={onClearHistory}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 text-xs transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search Filter Bar */}
        <div className="p-3 border-b border-slate-800 bg-slate-900 flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-500 ml-1" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search through history..."
            className="flex-1 bg-transparent border-none outline-none text-xs text-slate-200 placeholder-slate-500"
            autoFocus
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-slate-500 hover:text-slate-300 text-xs"
            >
              Clear
            </button>
          )}
        </div>

        {/* History List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-850 p-2">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-500 text-xs">
              {history.length === 0 ? 'No browsing history yet.' : 'No matching history entries.'}
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-800/60 transition-colors group"
              >
                <div
                  className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                  onClick={() => {
                    onNavigate(item.url);
                    onClose();
                  }}
                >
                  {item.favicon ? (
                    <img
                      src={item.favicon}
                      alt=""
                      className="w-4 h-4 rounded-sm shrink-0 object-contain"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <Globe className="w-4 h-4 text-slate-500 shrink-0" />
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-slate-200 truncate group-hover:text-indigo-300">
                      {item.title || item.url}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">{item.url}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3 ml-4 shrink-0">
                  <span className="text-[11px] text-slate-500">
                    {new Date(item.visitedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>

                  <button
                    onClick={() => onDeleteItem(item.id)}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-slate-700 text-slate-400 hover:text-rose-400 transition-all"
                    title="Remove from history"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
