'use client';
import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => void;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Slim dismissible bar offering to install the PWA (manifest.json + service
// worker are already shipped — this just surfaces the browser's own install
// flow instead of leaving it undiscoverable).
// ponytail: Android/Chrome only — beforeinstallprompt has no iOS/Safari
// equivalent, so the event never fires there and the bar simply never shows.
// A manual "Add to Home Screen" walkthrough for iOS can be added later if it
// turns out to matter.
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return true;
    return !!localStorage.getItem('cc_install_dismissed');
  });

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!deferred || dismissed) return null;

  const dismiss = () => {
    localStorage.setItem('cc_install_dismissed', '1');
    setDismissed(true);
  };

  const install = async () => {
    deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-emerald-500/10 border-b border-emerald-500/20 text-sm shrink-0">
      <Download size={15} className="text-emerald-400 shrink-0"/>
      <span className="flex-1 text-emerald-200 text-xs md:text-sm">Install CourtConnect for quicker courtside access</span>
      <button onClick={install}
        className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold rounded-lg text-xs shrink-0 transition-colors">
        Install
      </button>
      <button onClick={dismiss} aria-label="Dismiss" className="text-emerald-200/60 hover:text-emerald-200 shrink-0">
        <X size={16}/>
      </button>
    </div>
  );
}
