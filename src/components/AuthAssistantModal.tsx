import React, { useState, useEffect } from 'react';
import {
  X,
  Key,
  Shield,
  Cookie,
  ExternalLink,
  Copy,
  Check,
  Plus,
  Trash2,
  RefreshCw,
  AlertTriangle,
  Sparkles,
  HelpCircle,
  Laptop,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { getDomainFromUrl } from '../lib/urlHelper';

interface AuthAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUrl: string;
  onNavigate: (url: string) => void;
  onReload: () => void;
}

interface StoredCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
}

export const AuthAssistantModal: React.FC<AuthAssistantModalProps> = ({
  isOpen,
  onClose,
  currentUrl,
  onNavigate,
  onReload,
}) => {
  const [activeTab, setActiveTab] = useState<'google' | 'cookies' | 'faq'>('google');
  const [cookies, setCookies] = useState<StoredCookie[]>([]);
  const [isLoadingCookies, setIsLoadingCookies] = useState(false);
  const [copied, setCopied] = useState(false);

  // Form states for manual cookie addition
  const [newCookieName, setNewCookieName] = useState('');
  const [newCookieValue, setNewCookieValue] = useState('');
  const [rawCookieString, setRawCookieString] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState('');

  const currentDomain = getDomainFromUrl(currentUrl);

  const fetchCookies = () => {
    setIsLoadingCookies(true);
    fetch(`/api/cookies?domain=${encodeURIComponent(currentDomain)}`)
      .then((res) => res.json())
      .then((data) => {
        setCookies(data.cookies || []);
        setIsLoadingCookies(false);
      })
      .catch(() => {
        setIsLoadingCookies(false);
      });
  };

  useEffect(() => {
    if (isOpen) {
      fetchCookies();
    }
  }, [isOpen, currentUrl]);

  const handleAddSingleCookie = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCookieName.trim() || !newCookieValue.trim()) return;

    try {
      await fetch('/api/cookies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cookie: {
            name: newCookieName.trim(),
            value: newCookieValue.trim(),
            domain: currentDomain,
            path: '/',
          },
        }),
      });
      setNewCookieName('');
      setNewCookieValue('');
      setFeedbackMsg('Cookie saved to session');
      setTimeout(() => setFeedbackMsg(''), 3000);
      fetchCookies();
    } catch (err: any) {
      setFeedbackMsg(`Failed to save cookie: ${err.message}`);
    }
  };

  const handleImportRawCookies = async () => {
    if (!rawCookieString.trim()) return;
    try {
      await fetch('/api/cookies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawCookieString: rawCookieString.trim(),
          domain: currentDomain,
        }),
      });
      setRawCookieString('');
      setFeedbackMsg('Cookies imported successfully! Reloading page...');
      fetchCookies();
      setTimeout(() => {
        setFeedbackMsg('');
        onReload();
      }, 1500);
    } catch (err: any) {
      setFeedbackMsg(`Import failed: ${err.message}`);
    }
  };

  const handleDeleteCookie = async (name: string, domain: string) => {
    try {
      await fetch('/api/cookies', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, domain }),
      });
      fetchCookies();
    } catch (err) {}
  };

  const handleClearDomainCookies = async () => {
    try {
      await fetch('/api/cookies', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: currentDomain }),
      });
      fetchCookies();
      setFeedbackMsg(`Cleared all cookies for ${currentDomain}`);
      setTimeout(() => setFeedbackMsg(''), 3000);
    } catch (err) {}
  };

  const handleOpenDirectLogin = () => {
    // Open genuine Google sign-in or site sign-in in a separate secure browser tab
    window.open(currentUrl.startsWith('about:') ? 'https://accounts.google.com' : currentUrl, '_blank', 'noopener,noreferrer');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 select-none">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-slate-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-850">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-200">Sign-In & Authentication Assistant</h2>
              <p className="text-[11px] text-slate-400">
                Session Manager & Google OAuth Compatibility for <span className="text-indigo-300 font-mono">{currentDomain}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-5 pt-3 border-b border-slate-800 bg-slate-900/50 text-xs">
          <button
            onClick={() => setActiveTab('google')}
            className={`pb-2.5 px-2 font-medium border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'google'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Google Login & OAuth Guide</span>
          </button>
          <button
            onClick={() => setActiveTab('cookies')}
            className={`pb-2.5 px-2 font-medium border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'cookies'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cookie className="w-3.5 h-3.5" />
            <span>Session & Cookies ({cookies.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('faq')}
            className={`pb-2.5 px-2 font-medium border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'faq'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>How Sandboxed Logins Work</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-5 text-xs space-y-4">
          {feedbackMsg && (
            <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 flex items-center justify-between text-xs">
              <span>{feedbackMsg}</span>
            </div>
          )}

          {/* TAB 1: Google Login Assist */}
          {activeTab === 'google' && (
            <div className="space-y-4">
              {/* Alert / Explanation */}
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-1.5 leading-relaxed">
                <div className="flex items-center gap-1.5 font-semibold text-amber-400">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>Why Google Blocks Logins in Embedded Webviews & Proxies</span>
                </div>
                <p className="text-[11px] text-amber-300/80">
                  Google enforces strict anti-bot and anti-phishing policies (the <em>"Couldn't sign you in - This browser or app may not be secure"</em> protection). Google prevents automated typing of account passwords within sandboxed iframes and webview proxies to protect user credentials.
                </p>
              </div>

              {/* Solution Options */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Option 1: Direct Tab Sign-In */}
                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/70 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                      <ExternalLink className="w-4 h-4 text-indigo-400" />
                      <span>Option 1: Direct Native Sign-In</span>
                    </div>
                    <p className="text-slate-400 text-[11px] mt-1 leading-relaxed">
                      Launch Google Account authentication in an un-sandboxed browser tab where Google's security checks pass seamlessly.
                    </p>
                  </div>
                  <button
                    onClick={handleOpenDirectLogin}
                    className="w-full py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                  >
                    <span>Open in Direct Window</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Option 2: Session Token & Cookie Injector */}
                <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/70 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                      <Cookie className="w-4 h-4 text-emerald-400" />
                      <span>Option 2: Import Session Cookies</span>
                    </div>
                    <p className="text-slate-400 text-[11px] mt-1 leading-relaxed">
                      Paste existing authentication cookies or session tokens into this proxy browser's cookie jar to browse as logged in.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('cookies')}
                    className="w-full py-2 px-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span>Manage & Paste Cookies</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Fast Session Injector Box */}
              <div className="p-4 rounded-xl bg-slate-850 border border-slate-800 space-y-2.5">
                <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span>Quick Cookie Paste (Raw string)</span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  Paste a standard header cookie string (e.g., <code>SID=...; SSID=...; HSID=...</code> or any session cookie) for <strong className="text-slate-200">{currentDomain}</strong>:
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={rawCookieString}
                    onChange={(e) => setRawCookieString(e.target.value)}
                    placeholder="name=value; session_id=abc123xyz; ..."
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 font-mono text-[11px] focus:outline-hidden focus:border-indigo-500"
                  />
                  <button
                    onClick={handleImportRawCookies}
                    className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium shrink-0 transition-colors"
                  >
                    Inject & Apply
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Cookie Inspector & Storage */}
          {activeTab === 'cookies' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-200">
                    Active Cookies for <span className="text-indigo-400 font-mono">{currentDomain}</span>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Cookies in this proxy jar are transmitted with every proxied HTTP request and redirect.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchCookies}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                    title="Refresh cookies"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCookies ? 'animate-spin' : ''}`} />
                  </button>
                  {cookies.length > 0 && (
                    <button
                      onClick={handleClearDomainCookies}
                      className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-[11px] transition-colors"
                    >
                      Clear Domain Cookies
                    </button>
                  )}
                </div>
              </div>

              {/* Cookie List */}
              <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/60 divide-y divide-slate-850">
                {cookies.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 text-xs">
                    No active cookies stored for {currentDomain}.
                  </div>
                ) : (
                  cookies.map((c, idx) => (
                    <div key={idx} className="p-2.5 flex items-center justify-between hover:bg-slate-900/50 group transition-colors">
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium text-indigo-300 text-xs">{c.name}</span>
                          <span className="text-[10px] text-slate-500 font-mono">domain: {c.domain}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono truncate max-w-md">
                          {c.value}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteCookie(c.name, c.domain)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded opacity-0 group-hover:opacity-100 transition-all"
                        title="Delete cookie"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Add Single Cookie Form */}
              <form onSubmit={handleAddSingleCookie} className="p-3.5 rounded-xl bg-slate-850 border border-slate-800 space-y-2.5">
                <div className="font-semibold text-slate-200 flex items-center gap-1.5 text-xs">
                  <Plus className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Add Cookie Manually</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newCookieName}
                    onChange={(e) => setNewCookieName(e.target.value)}
                    placeholder="Cookie Name (e.g. session_id, SID)"
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 font-mono text-[11px] focus:outline-hidden focus:border-indigo-500"
                  />
                  <input
                    type="text"
                    value={newCookieValue}
                    onChange={(e) => setNewCookieValue(e.target.value)}
                    placeholder="Cookie Value"
                    className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 font-mono text-[11px] focus:outline-hidden focus:border-indigo-500"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs transition-colors"
                  >
                    Add Cookie
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: FAQ & Architectural Details */}
          {activeTab === 'faq' && (
            <div className="space-y-3 text-slate-300 text-xs leading-relaxed">
              <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 space-y-1">
                <div className="font-semibold text-slate-200">How does the proxy handle session persistence?</div>
                <p className="text-slate-400 text-[11px]">
                  Whenever a web server responds with a <code>Set-Cookie</code> header or initiates a redirect (HTTP 301/302/303), our backend proxy server captures and stores the cookies into an in-memory Cookie Jar mapped to that origin. Future requests to that domain automatically include the stored session credentials.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 space-y-1">
                <div className="font-semibold text-slate-200">Why does Google specifically restrict webviews?</div>
                <p className="text-slate-400 text-[11px]">
                  Google introduced strict embedded browser blocks in 2021 (RFC OAuth 2.0 for Native Apps). Embedded browser controls allow host applications to intercept keystrokes or cookies, so Google forces authentication to happen in a standard browser tab or native platform app.
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 space-y-1">
                <div className="font-semibold text-slate-200">How can I browse Google services logged in?</div>
                <p className="text-slate-400 text-[11px]">
                  You can use the <strong>Option 2: Import Session Cookies</strong> tab to paste your Google session credentials (such as <code>SID</code>, <code>SSID</code>, and <code>HSID</code>). Once stored, all proxied requests to Google domains will recognize your account session.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-850 flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            Proxy Session State: <span className="text-emerald-400 font-medium">Active Cookie Jar</span>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
