import React, { useState, useEffect } from 'react';
import { Search, Globe, Sparkles, Clock, FileText, ArrowRight, ShieldCheck, BookmarkCheck } from 'lucide-react';
import { SEARCH_ENGINES, SPEED_DIAL_ITEMS } from '../lib/constants';
import { normalizeUrl } from '../lib/urlHelper';

interface NewTabPageProps {
  onNavigate: (url: string) => void;
  searchEngineId: string;
  onSearchEngineChange: (id: string) => void;
}

export const NewTabPage: React.FC<NewTabPageProps> = ({
  onNavigate,
  searchEngineId,
  onSearchEngineChange,
}) => {
  const [query, setQuery] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [notes, setNotes] = useState(() => {
    return localStorage.getItem('browser_scratchpad_notes') || '';
  });

  // Digital clock update
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNotes(val);
    localStorage.setItem('browser_scratchpad_notes', val);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    const resolved = normalizeUrl(query, searchEngineId);
    onNavigate(resolved);
  };

  const currentEngine = SEARCH_ENGINES.find((s) => s.id === searchEngineId) || SEARCH_ENGINES[0];

  return (
    <div
      id="browser-new-tab-page"
      className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex flex-col items-center justify-start p-6 sm:p-12 relative select-none"
    >
      {/* Background ambient glow */}
      <div className="absolute top-12 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-4xl flex flex-col items-center z-10">
        {/* Live Clock & Badge */}
        <div className="flex flex-col items-center gap-1 mb-8">
          <div className="text-4xl sm:text-5xl font-mono tracking-tight font-light text-slate-200">
            {timeStr || '12:00 PM'}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-slate-800/80 border border-slate-700 text-indigo-300 shadow-sm">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Isolated Proxy Sandbox</span>
            </span>
          </div>
        </div>

        {/* Central Search Omnibox */}
        <form onSubmit={handleSearch} className="w-full max-w-2xl mb-8">
          <div className="relative flex items-center bg-slate-800/90 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/15 rounded-2xl p-2 shadow-2xl transition-all">
            {/* Search Engine Selector */}
            <div className="flex items-center gap-1 pl-2 pr-1 select-none">
              <select
                value={searchEngineId}
                onChange={(e) => onSearchEngineChange(e.target.value)}
                className="bg-transparent text-slate-300 font-medium text-xs border-none outline-none cursor-pointer pr-2 hover:text-white"
              >
                {SEARCH_ENGINES.map((engine) => (
                  <option key={engine.id} value={engine.id} className="bg-slate-800 text-slate-200">
                    {engine.icon} {engine.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="h-6 w-px bg-slate-700 mx-2" />

            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search with ${currentEngine.name} or enter URL (e.g. en.wikipedia.org)...`}
              className="flex-1 bg-transparent border-none outline-none text-sm text-slate-100 placeholder-slate-400 font-sans px-2"
              autoFocus
            />

            <button
              type="submit"
              className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md hover:shadow-indigo-500/25"
              title="Search"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Suggestions / Sample URLs */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-3 text-xs text-slate-400">
            <span className="text-slate-500">Popular:</span>
            {[
              { label: 'Wikipedia', url: 'https://en.wikipedia.org' },
              { label: 'Hacker News', url: 'https://news.ycombinator.com' },
              { label: 'MDN Web Docs', url: 'https://developer.mozilla.org' },
              { label: 'Internet Archive', url: 'https://archive.org' },
              { label: 'BBC News', url: 'https://www.bbc.com/news' },
              { label: 'GitHub Trending', url: 'https://github.com/trending' },
            ].map((sample) => (
              <button
                key={sample.label}
                type="button"
                onClick={() => onNavigate(sample.url)}
                className="px-2.5 py-1 rounded-full bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700/60 text-slate-300 hover:text-white transition-all text-[11px]"
              >
                {sample.label}
              </button>
            ))}
          </div>
        </form>

        {/* Speed Dial Grid */}
        <div className="w-full mb-10">
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Speed Dial & Top Sites
            </h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {SPEED_DIAL_ITEMS.map((item) => (
              <button
                key={item.title}
                onClick={() => onNavigate(item.url)}
                className="flex flex-col items-center p-3 rounded-xl bg-slate-850 hover:bg-slate-800/90 border border-slate-800 hover:border-slate-700 transition-all hover:-translate-y-0.5 group text-center shadow-lg"
              >
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-2 bg-gradient-to-br ${item.bg} border`}
                >
                  {item.icon}
                </div>
                <div className="font-medium text-xs text-slate-200 group-hover:text-indigo-300 truncate w-full">
                  {item.title}
                </div>
                <div className="text-[10px] text-slate-400 truncate w-full mt-0.5">
                  {item.desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Bottom Section: Browser Scratchpad & Features */}
        <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Quick Scratchpad */}
          <div className="md:col-span-2 bg-slate-850/80 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                <FileText className="w-4 h-4 text-indigo-400" />
                <span>Quick Browser Notes / Scratchpad</span>
              </div>
              <span className="text-[10px] text-slate-500">Auto-saved locally</span>
            </div>
            <textarea
              value={notes}
              onChange={handleNotesChange}
              placeholder="Jot down quick thoughts, links, code snippets, or todo items while browsing..."
              className="w-full h-24 bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500/50 resize-none font-mono"
            />
          </div>

          {/* Browser Engine Info */}
          <div className="bg-slate-850/80 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Web Features</span>
              </div>
              <ul className="text-[11px] text-slate-400 space-y-2">
                <li className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Full HTML/CSS Proxy Rewriting</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                  <span>Reader Mode with Text-to-Speech</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                  <span>Gemini AI Page Analysis & Q&A</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  <span>Network & DOM DevTools Inspector</span>
                </li>
              </ul>
            </div>
            <div className="text-[10px] text-slate-500 pt-2 border-t border-slate-800 mt-2">
              Fast, Private, and Sandboxed
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
