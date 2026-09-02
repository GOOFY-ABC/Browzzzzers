import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  Send,
  BookOpen,
  HelpCircle,
  Globe2,
  FileText,
  Lightbulb,
  Copy,
  Check,
  RotateCcw,
} from 'lucide-react';

interface AIAssistantProps {
  url: string;
  title: string;
  isOpen: boolean;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({
  url,
  title,
  isOpen,
  onClose,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pageText, setPageText] = useState('');
  const [targetLang, setTargetLang] = useState('Spanish');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fetch page content when opened
  useEffect(() => {
    if (!isOpen || !url || url.startsWith('about:')) return;

    fetch(`/api/fetch?url=${encodeURIComponent(url)}`)
      .then((res) => res.json())
      .then((data) => {
        const text = data.reader?.textContent || data.rawHtml || '';
        setPageText(text);
      })
      .catch(() => {});
  }, [url, isOpen]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleAction = async (mode: 'summarize' | 'explain' | 'key_facts' | 'translate', extra?: string) => {
    setIsLoading(true);

    let promptText = '';
    if (mode === 'summarize') promptText = 'Summarize this page';
    else if (mode === 'explain') promptText = 'Explain this topic in simple terms';
    else if (mode === 'key_facts') promptText = 'Extract key facts and statistics';
    else if (mode === 'translate') promptText = `Translate summary to ${targetLang}`;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      text: promptText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          title,
          content: pageText,
          mode,
          language: targetLang,
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        text: data.result || 'No response from model.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        text: `⚠️ **Error**: ${err.message}. Ensure GEMINI_API_KEY is configured in your project settings.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputQuery.trim() || isLoading) return;

    const question = inputQuery.trim();
    setInputQuery('');

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      text: question,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          title,
          content: pageText,
          mode: 'chat',
          question,
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        text: data.result || 'No response from model.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      const errMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        text: `⚠️ **Error**: ${err.message}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div
      id="browser-ai-assistant"
      className="w-80 md:w-96 border-l border-slate-700 bg-slate-900 text-slate-100 flex flex-col h-full shadow-2xl z-30"
    >
      {/* Header */}
      <div className="p-3.5 border-b border-slate-800 bg-slate-850 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-sm">
            <Sparkles className="w-4 h-4 text-amber-300" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-200">Gemini Web Copilot</div>
            <div className="text-[10px] text-slate-400 truncate max-w-[180px]">
              {title || 'Active Tab'}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          title="Close AI Assistant"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Action Buttons */}
      <div className="p-3 bg-slate-900/90 border-b border-slate-800/80 space-y-2">
        <div className="text-[11px] font-medium text-slate-400">Quick Actions</div>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => handleAction('summarize')}
            disabled={isLoading || !url || url.startsWith('about:')}
            className="flex items-center gap-1.5 p-2 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700/60 text-[11px] text-slate-200 text-left transition-all disabled:opacity-40"
          >
            <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <span className="truncate">Summarize Page</span>
          </button>

          <button
            onClick={() => handleAction('explain')}
            disabled={isLoading || !url || url.startsWith('about:')}
            className="flex items-center gap-1.5 p-2 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700/60 text-[11px] text-slate-200 text-left transition-all disabled:opacity-40"
          >
            <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">Explain Simply</span>
          </button>

          <button
            onClick={() => handleAction('key_facts')}
            disabled={isLoading || !url || url.startsWith('about:')}
            className="flex items-center gap-1.5 p-2 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700/60 text-[11px] text-slate-200 text-left transition-all disabled:opacity-40"
          >
            <BookOpen className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">Extract Key Facts</span>
          </button>

          <button
            onClick={() => handleAction('translate')}
            disabled={isLoading || !url || url.startsWith('about:')}
            className="flex items-center gap-1.5 p-2 rounded-lg bg-slate-800 hover:bg-slate-750 border border-slate-700/60 text-[11px] text-slate-200 text-left transition-all disabled:opacity-40"
          >
            <Globe2 className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="truncate">Translate</span>
          </button>
        </div>
      </div>

      {/* Chat Messages Log */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 font-sans text-xs">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center h-full text-slate-500 py-10 px-4">
            <Sparkles className="w-8 h-8 mb-2 text-indigo-400/50" />
            <p className="text-xs font-medium text-slate-400">Ask questions about this page</p>
            <p className="text-[11px] text-slate-500 mt-1">
              Select a quick action above or type a custom query below to analyze the active site.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isAi = msg.role === 'assistant';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isAi ? 'items-start' : 'items-end'}`}
              >
                <div
                  className={`p-3 rounded-xl max-w-[90%] select-text leading-relaxed ${
                    isAi
                      ? 'bg-slate-800 border border-slate-700/70 text-slate-200'
                      : 'bg-indigo-600 text-white'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.text}</div>
                </div>

                <div className="flex items-center gap-2 mt-1 px-1 text-[10px] text-slate-500">
                  <span>{msg.timestamp}</span>
                  {isAi && (
                    <button
                      onClick={() => copyToClipboard(msg.text, msg.id)}
                      className="hover:text-slate-300"
                      title="Copy response"
                    >
                      {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}

        {isLoading && (
          <div className="flex items-center gap-2 text-indigo-400 text-xs py-2 px-3 bg-slate-800/60 rounded-xl border border-slate-700/40 w-fit">
            <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            <span>Analyzing webpage with Gemini...</span>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Box */}
      <form
        onSubmit={handleCustomQuestion}
        className="p-3 border-t border-slate-800 bg-slate-850 flex items-center gap-2"
      >
        <input
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          placeholder="Ask anything about this page..."
          disabled={isLoading || !url || url.startsWith('about:')}
          className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500"
        />
        <button
          type="submit"
          disabled={isLoading || !inputQuery.trim() || !url || url.startsWith('about:')}
          className="p-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition-colors"
          title="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
