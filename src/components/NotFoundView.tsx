'use client';
import { BASE_PATH } from '@/lib/utils';

// Shared by src/app/not-found.tsx (signed-in users / any route Next can't
// match) and AuthGate (logged-out visitors hitting a URL that isn't a real
// route) — before this, both cases fell through silently: signed-in users
// saw Next's plain unstyled default 404 text, and logged-out visitors on a
// broken/mistyped link saw the login modal with no indication the page
// didn't exist.
export function NotFoundView({ fullScreen = false }: { fullScreen?: boolean }) {
  return (
    <div className={`${fullScreen ? 'min-h-screen' : 'min-h-[60vh]'} flex flex-col items-center justify-center text-center px-6 gap-4`}>
      <p className="text-4xl">🏸</p>
      <p className="font-bold text-lg">Page not found</p>
      <p className="text-sm text-slate-400 max-w-sm">
        That link doesn&apos;t match anything on CourtConnect. It may be mistyped or out of date.
      </p>
      <button onClick={() => { window.location.href = `${BASE_PATH}/`; }}
        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-semibold transition-colors">
        Go Home
      </button>
    </div>
  );
}
