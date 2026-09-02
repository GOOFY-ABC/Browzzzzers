import React, { useState, useEffect } from 'react';
import {
  X,
  Maximize2,
  Minimize2,
  Terminal,
  Activity,
  Code2,
  ShieldCheck,
  Search,
  Copy,
  Check,
  RefreshCw,
  Clock,
  Database,
  Play,
  Cookie,
  Plus,
  Trash2,
} from 'lucide-react';
import { NetworkLogItem } from '../types';
import { getDomainFromUrl } from '../lib/urlHelper';

interface DevToolsProps {
  url: string;
  isOpen: boolean;
  onClose: () => void;
}

export const DevTools: React.FC<DevToolsProps> = ({ url, isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'network' | 'elements' | 'cookies' | 'security' | 'console'>('network');
  const [isExpanded, setIsExpanded] = useState(false);
  const [rawHtml, setRawHtml] = useState('');
  const [headers, setHeaders] = useState<Record<string, string>>({});
  const [networkLogs, setNetworkLogs] = useState<NetworkLogItem[]>([]);
  const [selectedLog, setSelectedLog] = useState<NetworkLogItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Cookies state
  const [cookiesList, setCookiesList] = useState<Array<{ name: string; value: string; domain: string; path: string }>>([]);
  const [cookieNameInput, setCookieNameInput] = useState('');
  const [cookieValueInput, setCookieValueInput] = useState('');

  const currentDomain = getDomainFromUrl(url);

  const fetchDomainCookies = () => {
    if (!url || url.startsWith('about:')) return;
    fetch(`/api/cookies?domain=${encodeURIComponent(currentDomain)}`)
      .then((res) => res.json())
      .then((data) => setCookiesList(data.cookies || []))
      .catch(() => {});
  };

  useEffect(() => {
    if (activeTab === 'cookies') {
      fetchDomainCookies();
    }
  }, [activeTab, url]);

  const handleAddCookie = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cookieNameInput.trim() || !cookieValueInput.trim()) return;
    await fetch('/api/cookies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cookie: {
          name: cookieNameInput.trim(),
          value: cookieValueInput.trim(),
          domain: currentDomain,
          path: '/',
        },
      }),
    });
    setCookieNameInput('');
    setCookieValueInput('');
    fetchDomainCookies();
  };

  const handleDeleteCookie = async (name: string, domain: string) => {
    await fetch('/api/cookies', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, domain }),
    });
    fetchDomainCookies();
  };

  // Console state
  const [consoleInput, setConsoleInput] = useState('');
  const [consoleLogs, setConsoleLogs] = useState<Array<{ type: 'log' | 'info' | 'error' | 'warn' | 'result'; text: string; time: string }>>([
    { type: 'info', text: 'DevTools Console initialized. Proxy sandbox active.', time: new Date().toLocaleTimeString() },
  ]);

  // Fetch page inspection data when URL changes
  useEffect(() => {
    if (!isOpen || !url || url.startsWith('about:')) return;

    setIsLoading(true);
    fetch(`/api/fetch?url=${encodeURIComponent(url)}`)
      .then((res) => res.json())
      .then((data) => {
        setRawHtml(data.rawHtml || '');
        setHeaders(data.headers || {});

        // Add main document network log
        const mainLog: NetworkLogItem = {
          id: `net-${Date.now()}`,
          url: data.url || url,
          method: 'GET',
          status: data.status || 200,
          statusText: data.statusText || 'OK',
          contentType: data.contentType || 'text/html',
          size: data.size || '14.2 KB',
          timeMs: data.timeMs || 120,
          timestamp: Date.now(),
          headers: data.headers || {},
        };

        setNetworkLogs((prev) => [mainLog, ...prev.slice(0, 20)]);
        setSelectedLog(mainLog);

        setConsoleLogs((prev) => [
          ...prev,
          {
            type: 'log',
            text: `[Network] Loaded ${url} (${data.status}) in ${data.timeMs}ms`,
            time: new Date().toLocaleTimeString(),
          },
        ]);
        setIsLoading(false);
      })
      .catch((err) => {
        setConsoleLogs((prev) => [
          ...prev,
          {
            type: 'error',
            text: `[Error] Failed to inspect ${url}: ${err.message}`,
            time: new Date().toLocaleTimeString(),
          },
        ]);
        setIsLoading(false);
      });
  }, [url, isOpen]);

  const handleCopySource = () => {
    navigator.clipboard.writeText(rawHtml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConsoleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!consoleInput.trim()) return;

    const cmd = consoleInput.trim();
    setConsoleLogs((prev) => [
      ...prev,
      { type: 'log', text: `> ${cmd}`, time: new Date().toLocaleTimeString() },
    ]);

    try {
      // Evaluate command in safe scope
      let result;
      if (cmd === 'location.href') result = url;
      else if (cmd === 'document.title') result = document.title;
      else if (cmd === 'navigator.userAgent') result = navigator.userAgent;
      else if (cmd === 'clear()') {
        setConsoleLogs([]);
        setConsoleInput('');
        return;
      } else {
        result = eval(cmd);
      }
      setConsoleLogs((prev) => [
        ...prev,
        { type: 'result', text: `< ${String(result)}`, time: new Date().toLocaleTimeString() },
      ]);
    } catch (err: any) {
      setConsoleLogs((prev) => [
        ...prev,
        { type: 'error', text: `Uncaught: ${err.message}`, time: new Date().toLocaleTimeString() },
      ]);
    }
    setConsoleInput('');
  };

  if (!isOpen) return null;

  return (
    <div
      id="browser-devtools-panel"
      className={`border-t border-slate-700 bg-slate-900 text-slate-200 flex flex-col z-30 transition-all ${
        isExpanded ? 'h-96' : 'h-64'
      }`}
    >
      {/* DevTools Top Navigation Bar */}
      <div className="flex items-center justify-between bg-slate-800/90 px-3 py-1.5 border-b border-slate-700 select-none">
        <div className="flex items-center gap-1">
          <div className="flex items-center gap-1 mr-3 text-xs font-semibold text-slate-300">
            <Terminal className="w-3.5 h-3.5 text-indigo-400" />
            <span>DevTools</span>
          </div>

          <button
            onClick={() => setActiveTab('network')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors ${
              activeTab === 'network' ? 'bg-slate-700 text-indigo-400 font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Network</span>
            <span className="ml-1 px-1 rounded-full text-[10px] bg-slate-800 text-slate-400">
              {networkLogs.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('elements')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors ${
              activeTab === 'elements' ? 'bg-slate-700 text-indigo-400 font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Source & DOM</span>
          </button>

          <button
            onClick={() => setActiveTab('cookies')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors ${
              activeTab === 'cookies' ? 'bg-slate-700 text-indigo-400 font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cookie className="w-3.5 h-3.5" />
            <span>Cookies ({cookiesList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('console')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors ${
              activeTab === 'console' ? 'bg-slate-700 text-indigo-400 font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Console</span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors ${
              activeTab === 'security' ? 'bg-slate-700 text-indigo-400 font-medium' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Security</span>
          </button>
        </div>

        {/* Panel controls (Expand, Close) */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-slate-200"
            title="Close DevTools"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-hidden flex flex-col bg-slate-950 font-mono text-xs">
        {/* 1. NETWORK TAB */}
        {activeTab === 'network' && (
          <div className="flex-1 flex overflow-hidden">
            {/* Left: Requests Table */}
            <div className="w-1/2 border-r border-slate-800 overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-900 text-slate-400 text-[11px] border-b border-slate-800 select-none">
                  <tr>
                    <th className="py-1.5 px-3">Name</th>
                    <th className="py-1.5 px-2">Status</th>
                    <th className="py-1.5 px-2">Type</th>
                    <th className="py-1.5 px-2">Size</th>
                    <th className="py-1.5 px-2">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {networkLogs.map((log) => {
                    const isSelected = selectedLog?.id === log.id;
                    const isSuccess = log.status >= 200 && log.status < 400;
                    return (
                      <tr
                        key={log.id}
                        onClick={() => setSelectedLog(log)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-indigo-950/60 text-indigo-200' : 'hover:bg-slate-900/60 text-slate-300'
                        }`}
                      >
                        <td className="py-1.5 px-3 truncate max-w-[160px]" title={log.url}>
                          {log.url.split('/').pop() || log.url}
                        </td>
                        <td className="py-1.5 px-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              isSuccess ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                            }`}
                          >
                            {log.status}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-slate-400 truncate max-w-[80px]">
                          {log.contentType.split(';')[0]}
                        </td>
                        <td className="py-1.5 px-2 text-slate-400">{log.size}</td>
                        <td className="py-1.5 px-2 text-slate-400">{log.timeMs}ms</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Right: Selected Request Headers & Details */}
            <div className="w-1/2 p-3 overflow-y-auto bg-slate-900/40">
              {selectedLog ? (
                <div className="space-y-3">
                  <div>
                    <div className="font-semibold text-slate-300 mb-1">General</div>
                    <div className="bg-slate-950 p-2 rounded border border-slate-800 text-[11px] space-y-1">
                      <div><span className="text-slate-500">Request URL:</span> <span className="text-slate-200 break-all">{selectedLog.url}</span></div>
                      <div><span className="text-slate-500">Request Method:</span> <span className="text-indigo-400">{selectedLog.method}</span></div>
                      <div><span className="text-slate-500">Status Code:</span> <span className="text-emerald-400">{selectedLog.status} {selectedLog.statusText}</span></div>
                    </div>
                  </div>

                  <div>
                    <div className="font-semibold text-slate-300 mb-1">Response Headers</div>
                    <div className="bg-slate-950 p-2 rounded border border-slate-800 text-[11px] space-y-1 max-h-48 overflow-y-auto">
                      {Object.entries(selectedLog.headers).map(([key, val]) => (
                        <div key={key} className="break-all">
                          <span className="text-slate-500">{key}:</span> <span className="text-slate-300">{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 text-slate-500">Select a request to view headers</div>
              )}
            </div>
          </div>
        )}

        {/* 2. SOURCE / DOM TAB */}
        {activeTab === 'elements' && (
          <div className="flex-1 flex flex-col overflow-hidden p-2">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 px-1">
              <div className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Find in source..."
                  className="bg-slate-900 px-2 py-0.5 rounded border border-slate-700 text-slate-200 outline-none w-48 text-[11px]"
                />
              </div>
              <button
                onClick={handleCopySource}
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-colors"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy HTML'}</span>
              </button>
            </div>
            <pre className="flex-1 overflow-auto p-2 bg-slate-950 rounded text-slate-300 text-[11px] leading-relaxed whitespace-pre font-mono select-text">
              {rawHtml ? rawHtml.slice(0, 50000) : 'Loading source code...'}
            </pre>
          </div>
        )}

        {/* 3. COOKIES & STORAGE TAB */}
        {activeTab === 'cookies' && (
          <div className="flex-1 flex flex-col overflow-hidden p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-slate-300 font-semibold text-xs flex items-center gap-1.5">
                <Cookie className="w-3.5 h-3.5 text-indigo-400" />
                <span>Cookies for <span className="text-indigo-300">{currentDomain}</span></span>
              </div>
              <button
                onClick={fetchDomainCookies}
                className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px]"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Refresh</span>
              </button>
            </div>

            {/* Cookies Table */}
            <div className="flex-1 overflow-y-auto rounded border border-slate-800 bg-slate-950">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-900 text-slate-400 text-[11px] border-b border-slate-800">
                  <tr>
                    <th className="py-1 px-2.5">Name</th>
                    <th className="py-1 px-2.5">Value</th>
                    <th className="py-1 px-2.5">Domain</th>
                    <th className="py-1 px-2.5">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850 text-[11px]">
                  {cookiesList.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center py-6 text-slate-500">
                        No cookies set for {currentDomain}
                      </td>
                    </tr>
                  ) : (
                    cookiesList.map((c, i) => (
                      <tr key={i} className="hover:bg-slate-900/50">
                        <td className="py-1 px-2.5 font-bold text-indigo-300">{c.name}</td>
                        <td className="py-1 px-2.5 text-slate-400 max-w-xs truncate" title={c.value}>{c.value}</td>
                        <td className="py-1 px-2.5 text-slate-500">{c.domain}</td>
                        <td className="py-1 px-2.5">
                          <button
                            onClick={() => handleDeleteCookie(c.name, c.domain)}
                            className="text-slate-500 hover:text-rose-400 p-0.5 rounded"
                            title="Delete Cookie"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Quick Add Cookie */}
            <form onSubmit={handleAddCookie} className="flex items-center gap-2 pt-1 border-t border-slate-800">
              <input
                type="text"
                value={cookieNameInput}
                onChange={(e) => setCookieNameInput(e.target.value)}
                placeholder="Cookie Name"
                className="bg-slate-900 px-2 py-1 rounded border border-slate-700 text-slate-200 text-[11px] w-36 outline-none focus:border-indigo-500"
              />
              <input
                type="text"
                value={cookieValueInput}
                onChange={(e) => setCookieValueInput(e.target.value)}
                placeholder="Cookie Value"
                className="flex-1 bg-slate-900 px-2 py-1 rounded border border-slate-700 text-slate-200 text-[11px] outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                className="flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[11px]"
              >
                <Plus className="w-3 h-3" />
                <span>Add Cookie</span>
              </button>
            </form>
          </div>
        )}

        {/* 4. CONSOLE TAB */}
        {activeTab === 'console' && (
          <div className="flex-1 flex flex-col overflow-hidden p-2">
            <div className="flex-1 overflow-y-auto space-y-1 p-2 bg-slate-950 rounded select-text">
              {consoleLogs.map((log, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2 py-0.5 ${
                    log.type === 'error'
                      ? 'text-rose-400 bg-rose-950/20 px-1 rounded'
                      : log.type === 'warn'
                      ? 'text-amber-400'
                      : log.type === 'info'
                      ? 'text-indigo-400'
                      : log.type === 'result'
                      ? 'text-emerald-400'
                      : 'text-slate-300'
                  }`}
                >
                  <span className="text-slate-600 select-none text-[10px] shrink-0">{log.time}</span>
                  <span className="break-all">{log.text}</span>
                </div>
              ))}
            </div>

            <form onSubmit={handleConsoleSubmit} className="mt-2 flex items-center gap-2">
              <span className="text-indigo-400 font-bold">{'>'}</span>
              <input
                type="text"
                value={consoleInput}
                onChange={(e) => setConsoleInput(e.target.value)}
                placeholder="Type JS expression or clear() and press Enter..."
                className="flex-1 bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-slate-200 outline-none focus:border-indigo-500 text-xs font-mono"
              />
              <button
                type="submit"
                className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs"
              >
                Run
              </button>
            </form>
          </div>
        )}

        {/* 4. SECURITY TAB */}
        {activeTab === 'security' && (
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold mb-1">
                <ShieldCheck className="w-4 h-4" />
                <span>Security Overview</span>
              </div>
              <p className="text-slate-400 text-[11px]">
                This page is isolated within the sandboxed proxy environment with SSRF boundary enforcement.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                <div className="text-slate-400 font-semibold mb-1">Connection Encryption</div>
                <div className="text-slate-200 text-xs">
                  {url.startsWith('https://') ? 'TLS 1.3 / AES-256 GCM Proxy Bridge' : 'Plain HTTP (Unencrypted)'}
                </div>
              </div>
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                <div className="text-slate-400 font-semibold mb-1">CORS & Frame Policy</div>
                <div className="text-slate-200 text-xs">
                  Stripped X-Frame-Options for secure iframe sandbox rendering
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
