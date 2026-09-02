import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  Type,
  Clock,
  FileText,
  Share2,
  Check,
  Sparkles,
  ArrowLeft,
} from 'lucide-react';
import { ReaderContent } from '../types';

interface ReaderModeProps {
  url: string;
  onClose: () => void;
  onOpenAi: () => void;
}

export const ReaderMode: React.FC<ReaderModeProps> = ({ url, onClose, onOpenAi }) => {
  const [data, setData] = useState<ReaderContent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Appearance settings
  const [theme, setTheme] = useState<'sepia' | 'dark' | 'light' | 'night'>('sepia');
  const [fontFamily, setFontFamily] = useState<'serif' | 'sans' | 'mono'>('serif');
  const [fontSize, setFontSize] = useState<number>(18);
  const [copied, setCopied] = useState(false);

  // Text to Speech
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);

    fetch(`/api/fetch?url=${encodeURIComponent(url)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        if (isMounted) {
          if (json.reader && json.reader.textContent) {
            setData(json.reader);
          } else {
            setData({
              title: json.title || url,
              content: json.rawHtml || '<p>No content available</p>',
              textContent: json.rawHtml || '',
              readingTimeMinutes: 1,
              wordCount: 100,
            });
          }
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Failed to extract readable content.');
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
      window.speechSynthesis.cancel();
    };
  }, [url]);

  // Speech controls
  const handleSpeak = () => {
    if (!data?.textContent) return;

    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      setIsSpeaking(true);
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.pause();
      setIsPaused(true);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(data.textContent.slice(0, 5000));
    utterance.rate = 1.0;
    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  const handleStopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
  };

  const handleCopy = () => {
    if (!data?.textContent) return;
    navigator.clipboard.writeText(data.textContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Themes Styling Map
  const themeClasses = {
    sepia: 'bg-[#f4ecd8] text-[#5b4636]',
    light: 'bg-[#fafafa] text-[#24292f]',
    dark: 'bg-[#1e293b] text-[#cbd5e1]',
    night: 'bg-[#090d16] text-[#94a3b8]',
  };

  const fontClasses = {
    serif: 'font-serif',
    sans: 'font-sans',
    mono: 'font-mono',
  };

  return (
    <div className={`flex-1 overflow-y-auto flex flex-col items-center select-text transition-colors duration-300 ${themeClasses[theme]}`}>
      {/* Reader Control Header Bar */}
      <div className="sticky top-0 z-20 w-full bg-inherit/90 backdrop-blur border-b border-current/10 px-4 py-2.5 flex items-center justify-between max-w-4xl">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md border border-current/20 hover:bg-current/10 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Exit Reader</span>
        </button>

        {/* Reader Customization Tools */}
        <div className="flex items-center gap-2 text-xs">
          {/* Text-to-Speech */}
          <div className="flex items-center gap-1 bg-current/5 rounded-lg p-1 border border-current/10">
            <button
              onClick={handleSpeak}
              disabled={isLoading || !data}
              className="p-1 rounded hover:bg-current/10 transition-colors"
              title={isSpeaking ? (isPaused ? 'Resume' : 'Pause Audio') : 'Listen to Article'}
            >
              {isSpeaking && !isPaused ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
            {isSpeaking && (
              <button
                onClick={handleStopSpeaking}
                className="p-1 rounded hover:bg-current/10 transition-colors text-rose-500"
                title="Stop Audio"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Font Type */}
          <div className="flex items-center bg-current/5 rounded-lg p-0.5 border border-current/10">
            <button
              onClick={() => setFontFamily('serif')}
              className={`px-2 py-0.5 rounded text-xs font-serif ${fontFamily === 'serif' ? 'bg-current/20 font-bold' : ''}`}
            >
              Serif
            </button>
            <button
              onClick={() => setFontFamily('sans')}
              className={`px-2 py-0.5 rounded text-xs font-sans ${fontFamily === 'sans' ? 'bg-current/20 font-bold' : ''}`}
            >
              Sans
            </button>
            <button
              onClick={() => setFontFamily('mono')}
              className={`px-2 py-0.5 rounded text-xs font-mono ${fontFamily === 'mono' ? 'bg-current/20 font-bold' : ''}`}
            >
              Mono
            </button>
          </div>

          {/* Font Size */}
          <div className="flex items-center bg-current/5 rounded-lg p-0.5 border border-current/10">
            <button
              onClick={() => setFontSize((s) => Math.max(14, s - 2))}
              className="px-2 py-0.5 rounded hover:bg-current/10"
              title="Decrease text size"
            >
              A-
            </button>
            <span className="text-[11px] px-1 font-mono">{fontSize}</span>
            <button
              onClick={() => setFontSize((s) => Math.min(28, s + 2))}
              className="px-2 py-0.5 rounded hover:bg-current/10"
              title="Increase text size"
            >
              A+
            </button>
          </div>

          {/* Theme Palette */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setTheme('sepia')}
              className={`w-5 h-5 rounded-full bg-[#f4ecd8] border-2 ${theme === 'sepia' ? 'border-amber-700' : 'border-slate-400/40'}`}
              title="Sepia theme"
            />
            <button
              onClick={() => setTheme('light')}
              className={`w-5 h-5 rounded-full bg-[#fafafa] border-2 ${theme === 'light' ? 'border-slate-800' : 'border-slate-400/40'}`}
              title="Light theme"
            />
            <button
              onClick={() => setTheme('dark')}
              className={`w-5 h-5 rounded-full bg-[#1e293b] border-2 ${theme === 'dark' ? 'border-indigo-400' : 'border-slate-400/40'}`}
              title="Dark theme"
            />
            <button
              onClick={() => setTheme('night')}
              className={`w-5 h-5 rounded-full bg-[#090d16] border-2 ${theme === 'night' ? 'border-purple-400' : 'border-slate-400/40'}`}
              title="OLED Night theme"
            />
          </div>

          {/* AI Page Analysis shortcut */}
          <button
            onClick={onOpenAi}
            className="flex items-center gap-1 px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm"
            title="Ask AI about this article"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>AI Copilot</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="w-full max-w-3xl px-6 py-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="w-8 h-8 border-3 border-current border-t-transparent rounded-full animate-spin opacity-60" />
            <p className="text-sm opacity-70">Extracting article content & formatting...</p>
          </div>
        ) : error ? (
          <div className="p-6 rounded-xl border border-current/20 bg-current/5 text-center">
            <h3 className="font-semibold text-lg mb-2">Unable to load Reader Mode</h3>
            <p className="text-sm opacity-80 mb-4">{error}</p>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-current/10 hover:bg-current/20 text-xs font-medium"
            >
              Return to Standard Browser
            </button>
          </div>
        ) : data ? (
          <article className={fontClasses[fontFamily]}>
            {/* Title & Meta */}
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-4 leading-tight">
              {data.title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-xs opacity-70 pb-6 mb-6 border-b border-current/15">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>{data.readingTimeMinutes} min read</span>
              </span>
              <span className="flex items-center gap-1">
                <FileText className="w-3.5 h-3.5" />
                <span>{data.wordCount} words</span>
              </span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 hover:opacity-100 transition-opacity ml-auto"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Share2 className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy Text'}</span>
              </button>
            </div>

            {/* Article Body */}
            <div
              className="prose prose-slate max-w-none leading-relaxed space-y-4"
              style={{ fontSize: `${fontSize}px`, lineHeight: 1.7 }}
              dangerouslySetInnerHTML={{ __html: data.content }}
            />
          </article>
        ) : null}
      </div>
    </div>
  );
};
