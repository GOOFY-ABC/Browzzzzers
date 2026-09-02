import React from 'react';
import { Lock, ShieldCheck, ShieldAlert, Key, Globe, Eye, Server } from 'lucide-react';
import { getDomainFromUrl } from '../lib/urlHelper';

interface SecurityPopoverProps {
  url: string;
  isOpen: boolean;
  onClose: () => void;
  isAdBlockActive?: boolean;
}

export const SecurityPopover: React.FC<SecurityPopoverProps> = ({
  url,
  isOpen,
  onClose,
  isAdBlockActive = true,
}) => {
  if (!isOpen) return null;

  const isHttps = url.startsWith('https://');
  const isInternal = url.startsWith('about:');
  const domain = getDomainFromUrl(url);

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute top-12 left-24 z-50 w-80 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl p-4 text-xs text-slate-200">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-700/80">
          <div className={`p-2 rounded-lg ${isHttps ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
            {isHttps ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
          </div>
          <div>
            <div className="font-semibold text-slate-100 text-sm">{domain}</div>
            <div className="text-slate-400 flex items-center gap-1">
              {isInternal
                ? 'Internal Browser Page'
                : isHttps
                ? 'Connection is secure (Encrypted)'
                : 'Connection not encrypted'}
            </div>
          </div>
        </div>

        <div className="space-y-3 pt-3">
          <div className="flex items-start gap-2 text-slate-300">
            <Lock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-slate-200">Certificate Status</div>
              <div className="text-slate-400 text-[11px]">
                {isHttps ? 'Valid SSL/TLS Certificate proxy verified' : 'Plain HTTP / Unverified'}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 text-slate-300">
            <Server className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-slate-200">Proxy Isolation</div>
              <div className="text-slate-400 text-[11px]">
                Sandboxed HTML rewriting with strict SSRF filtering active
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 text-slate-300">
            <Eye className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-slate-200">Tracker & Ad Shield</div>
              <div className="text-slate-400 text-[11px]">
                {isAdBlockActive ? 'Active — telemetry scripts blocked' : 'Disabled'}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2 text-slate-300">
            <Globe className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-medium text-slate-200">Cookies & Storage</div>
              <div className="text-slate-400 text-[11px]">
                Isolated per browser session container
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-700/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md font-medium text-xs transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </>
  );
};
