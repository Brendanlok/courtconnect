'use client';
// Header/footer chrome shared by every logged-out public page (marketing
// home, Rankings, How Ratings Work, About, Start a Club). Deliberately
// separate from the authenticated app's Topbar/Sidebar/BottomNav (those stay
// untouched, FROZEN nav) — this is a different surface for visitors who
// aren't signed in yet.
import { BASE_PATH } from '@/lib/utils';
import { usePublicAuth } from '@/context/PublicAuthContext';

// One list drives both header and footer — flat links, not dropdowns: each
// item is exactly one page today, so a dropdown menu would just be an empty
// abstraction. Add sub-items here (and switch to a dropdown) once a section
// actually has more than one page under it.
const NAV_LINKS = [
  { href: '/rankings/', label: 'Rankings' },
  { href: '/how-it-works/', label: 'How Ratings Work' },
  { href: '/start-a-club/', label: 'Start a Club' },
  { href: '/about/', label: 'About' },
];

export function PublicNav() {
  const onAuthClick = usePublicAuth();
  return (
    <header className="sticky top-0 z-30 bg-[#020817]/90 backdrop-blur border-b border-slate-800">
      <div className="max-w-5xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-3">
        <a href={`${BASE_PATH}/`} className="flex items-center gap-2 font-black text-lg shrink-0">
          <span>🏸</span> CourtConnect
        </a>
        <nav className="hidden md:flex items-center gap-5 text-sm text-slate-400">
          {NAV_LINKS.map(l => (
            <a key={l.href} href={`${BASE_PATH}${l.href}`} className="hover:text-white transition-colors">{l.label}</a>
          ))}
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
        <div className="flex items-center gap-4 flex-wrap justify-center">
          {NAV_LINKS.map(l => (
            <a key={l.href} href={`${BASE_PATH}${l.href}`} className="hover:text-slate-300 transition-colors">{l.label}</a>
          ))}
        </div>
      </div>
    </footer>
  );
}
