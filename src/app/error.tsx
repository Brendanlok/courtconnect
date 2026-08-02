'use client';
import { useEffect } from 'react';
import { BASE_PATH } from '@/lib/utils';

// No error boundary existed anywhere in the app before this — any uncaught
// render error crashed the whole page to a blank screen with no recovery UI
// and nothing logged, since Next only auto-shows a boundary if one is
// defined. This is the route-level one (catches everything under the root
// layout); global-error.tsx is the rarer root-layout-level fallback.
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Route error boundary caught:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6 gap-4">
      <p className="text-4xl">⚠️</p>
      <p className="font-bold text-lg">Something went wrong</p>
      <p className="text-sm text-slate-400 max-w-sm">
        This screen hit an unexpected error. Try again, or head back home.
      </p>
      <div className="flex gap-2">
        <button onClick={reset}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-semibold transition-colors">
          Try Again
        </button>
        <button onClick={() => { window.location.href = `${BASE_PATH}/`; }}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-sm font-semibold transition-colors">
          Go Home
        </button>
      </div>
    </div>
  );
}
