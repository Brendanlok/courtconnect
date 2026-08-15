'use client';
// Header/footer chrome shared by every logged-out public page (marketing
// home, Rankings, How Ratings Work, Events, Find/Become a Coach, About,
// Start a Club). Deliberately separate from the authenticated app's
// Topbar/Sidebar/BottomNav (those stay untouched, FROZEN nav) — this is a
// different surface for visitors who aren't signed in yet.
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Menu, X } from 'lucide-react';
import { BASE_PATH } from '@/lib/utils';
import { usePublicAuth } from '@/context/PublicAuthContext';

// Only "Ratings" and "Coaching" have 2+ real pages under them today — real
// dropdowns. Everything else is still exactly one page, so it stays a flat
// link; a dropdown with one item is a decoration, not navigation. Add
// sub-items here as real pages ship rather than building menu shells ahead
// of the content.
const RATINGS_ITEMS = [
  { href: '/how-it-works/', label: 'How It Works' },
  { href: '/#faq', label: 'FAQ' },
];
const COACHING_ITEMS = [
  { href: '/find-a-coach/', label: 'Find a Coach' },
  { href: '/become-a-coach/', label: 'Become a Coach' },
];
const FLAT_LINKS = [
  { href: '/rankings/', label: 'Rankings' },
  { href: '/events/', label: 'Events' },
  { href: '/start-a-club/', label: 'Start a Club' },
  { href: '/about/', label: 'About' },
];
const FOOTER_COLUMNS = [
  { title: 'Ratings', items: RATINGS_ITEMS },
  { title: 'Coaching', items: COACHING_ITEMS },
  { title: 'More', items: [{ href: '/rankings/', label: 'Rankings' }, ...FLAT_LINKS.slice(1)] },
];

function DropdownMenu({ label, items }: { label: string; items: { href: string; label: string }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const mouseHandler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    // Same Escape-to-close pattern as every modal in the app (see NotificationPanel) —
    // was click-outside only, so a keyboard-only user had no way to dismiss the dropdown.
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', mouseHandler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', mouseHandler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)} className="flex items-center gap-1 hover:text-white transition-colors">
        {label} <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="popover-anim origin-top-left absolute top-full mt-2 left-0 z-30 bg-slate-900 border border-slate-700 rounded-xl shadow-xl overflow-hidden min-w-[160px]">
          {items.map(l => (
            <a key={l.href} href={`${BASE_PATH}${l.href}`} onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors whitespace-nowrap">
              {l.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// All real nav destinations, flattened — used for the mobile menu panel
// where a hover dropdown doesn't make sense (no hover on touch).
const ALL_LINKS = [...RATINGS_ITEMS, ...COACHING_ITEMS, ...FLAT_LINKS];

export function PublicNav() {
  const onAuthClick = usePublicAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!mobileOpen) return;
    const keyHandler = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false); };
    // Same click-outside pattern as DropdownMenu above — was Escape/link-tap
    // only, so tapping anywhere else on the page (outside the panel and its
    // own toggle button) left the menu stuck open.
    const mouseHandler = (e: MouseEvent) => { if (headerRef.current && !headerRef.current.contains(e.target as Node)) setMobileOpen(false); };
    document.addEventListener('keydown', keyHandler);
    document.addEventListener('mousedown', mouseHandler);
    return () => {
      document.removeEventListener('keydown', keyHandler);
      document.removeEventListener('mousedown', mouseHandler);
    };
  }, [mobileOpen]);
  return (
    <header ref={headerRef} className="sticky top-0 z-30 bg-[#020817]/90 backdrop-blur border-b border-slate-800">
      <div className="max-w-5xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-3">
        <a href={`${BASE_PATH}/`} className="flex items-center gap-2 font-black text-lg shrink-0">
          <span>🏸</span> CourtConnect
        </a>
        <nav className="hidden md:flex items-center gap-5 text-sm text-slate-400">
          <DropdownMenu label="Ratings" items={RATINGS_ITEMS} />
          <a href={`${BASE_PATH}/rankings/`} className="hover:text-white transition-colors">Rankings</a>
          <a href={`${BASE_PATH}/events/`} className="hover:text-white transition-colors">Events</a>
          <DropdownMenu label="Coaching" items={COACHING_ITEMS} />
          <a href={`${BASE_PATH}/start-a-club/`} className="hover:text-white transition-colors">Start a Club</a>
          <a href={`${BASE_PATH}/about/`} className="hover:text-white transition-colors">About</a>
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
          {/* Mobile-only — the flat nav above is `hidden` below md, and the
              footer is too far away to count as real navigation on a phone. */}
          <button onClick={() => setMobileOpen(o => !o)} aria-label="Menu"
            className="md:hidden p-1.5 text-slate-400 hover:text-white transition-colors">
            {mobileOpen ? <X size={20}/> : <Menu size={20}/>}
          </button>
        </div>
      </div>
      {mobileOpen && (
        <nav className="md:hidden border-t border-slate-800 px-4 py-3 space-y-1">
          {ALL_LINKS.map(l => (
            <a key={l.href} href={`${BASE_PATH}${l.href}`} onClick={() => setMobileOpen(false)}
              className="block px-2 py-2.5 text-sm text-slate-300 hover:text-white transition-colors">
              {l.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-slate-800 mt-16">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-10 flex flex-col sm:flex-row gap-8 sm:gap-16">
        {FOOTER_COLUMNS.map(col => (
          <div key={col.title} className="space-y-2">
            <p className="text-xs font-bold text-slate-300 uppercase tracking-wide">{col.title}</p>
            {col.items.map(l => (
              <a key={l.href} href={`${BASE_PATH}${l.href}`} className="block text-xs text-slate-500 hover:text-slate-300 transition-colors">{l.label}</a>
            ))}
          </div>
        ))}
      </div>
      <div className="max-w-5xl mx-auto px-4 md:px-6 pb-8 text-xs text-slate-600 border-t border-slate-900 pt-4">
        © {new Date().getFullYear()} CourtConnect · Malaysia
      </div>
    </footer>
  );
}
