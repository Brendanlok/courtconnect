'use client';
import { useEffect } from 'react';
import { BASE_PATH } from '@/lib/utils';

// Catches errors thrown by the root layout itself (rare) — error.tsx handles
// everything else. Must render its own <html>/<body> since it replaces the
// whole tree, including the layout that would normally provide them.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Global error boundary caught:', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-[#020817] text-slate-100 min-h-screen flex flex-col items-center justify-center text-center px-6 gap-4">
        <p className="text-4xl">⚠️</p>
        <p className="font-bold text-lg">Something went wrong</p>
        <p className="text-sm text-slate-400 max-w-sm">
          CourtConnect hit an unexpected error. Try again, or head back home.
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
      </body>
    </html>
  );
}
