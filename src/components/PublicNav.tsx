'use client';
// Header/footer chrome shared by every logged-out public page (marketing
// home, Rankings, How Ratings Work). Deliberately separate from the
// authenticated app's Topbar/Sidebar/BottomNav (those stay untouched, FROZEN
// nav) — this is a different surface for visitors who aren't signed in yet.
import { BASE_PATH } from '@/lib/utils';
import { usePublicAuth } from '@/context/PublicAuthContext';

export function PublicNav() {
  const onAuthClick = usePublicAuth();
  return (
    <header className="sticky top-0 z-30 bg-[#020817]/90 backdrop-blur border-b border-slate-800">
      <div className="max-w-5xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-3">
        <a href={`${BASE_PATH}/`} className="flex items-center gap-2 font-black text-lg shrink-0">
          <span>🏸</span> CourtConnect
        </a>
        <nav className="hidden sm:flex items-center gap-5 text-sm text-slate-400">
          <a href={`${BASE_PATH}/rankings/`} className="hover:text-white transition-colors">Rankings</a>
          <a href={`${BASE_PATH}/how-it-works/`} className="hover:text-white transition-colors">How Ratings Work</a>
        </nav>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => onAuthClick('login')}
            className="px-3 py-1.5 text-sm font-semibold text-slate-300 hover:text-white transition-colors">
            Log In
          </button>
          <button onClick={() => onAuthClick('signup')}
            className="px-3.5 py-1.5 text-sm font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl transition-colors">
            Sign Up
          </button>
        </div>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-slate-800 mt-16">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
        <span>© {new Date().getFullYear()} CourtConnect · Malaysia</span>
        <div className="flex items-center gap-4">
          <a href={`${BASE_PATH}/rankings/`} className="hover:text-slate-300 transition-colors">Rankings</a>
          <a href={`${BASE_PATH}/how-it-works/`} className="hover:text-slate-300 transition-colors">How Ratings Work</a>
        </div>
      </div>
    </footer>
  );
}
