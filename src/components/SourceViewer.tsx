import React, { useState, useEffect } from 'react';
import { Code2, Copy, Check, ArrowLeft, Download } from 'lucide-react';

interface SourceViewerProps {
  url: string;
  onClose: () => void;
}

export const SourceViewer: React.FC<SourceViewerProps> = ({ url, onClose }) => {
  const [sourceCode, setSourceCode] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    fetch(`/api/fetch?url=${encodeURIComponent(url)}`)
      .then((res) => res.json())
      .then((data) => {
        setSourceCode(data.rawHtml || '<!DOCTYPE html>\n<!-- No HTML source returned -->');
        setIsLoading(false);
      })
      .catch((err) => {
        setSourceCode(`<!-- Failed to fetch source code: ${err.message} -->`);
        setIsLoading(false);
      });
  }, [url]);

  const handleCopy = () => {
    navigator.clipboard.writeText(sourceCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([sourceCode], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = 'page-source.html';
    a.click();
    URL.revokeObjectURL(blobUrl);
  };

  const lines = sourceCode.split('\n');

  return (
    <div className="flex-1 flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-mono text-xs select-text">
      {/* Top Source Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Web Page</span>
          </button>
          <div className="h-4 w-px bg-slate-700 mx-1" />
          <span className="text-slate-400 font-sans text-xs">
            Source code of <span className="text-indigo-400 font-mono">{url}</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-500 text-[11px]">{lines.length} lines</span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy All'}</span>
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </button>
        </div>
      </div>

      {/* Code Display Area */}
      <div className="flex-1 overflow-auto p-4 leading-relaxed">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-slate-500">
            <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mr-2" />
            <span>Fetching raw HTML...</span>
          </div>
        ) : (
          <div className="flex">
            {/* Line Numbers */}
            <div className="select-none text-slate-600 text-right pr-4 border-r border-slate-800 mr-4 shrink-0 font-mono">
              {lines.map((_, idx) => (
                <div key={idx}>{idx + 1}</div>
              ))}
            </div>
            {/* Code Content */}
            <pre className="text-emerald-300 flex-1 whitespace-pre overflow-x-auto">
              {sourceCode}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
