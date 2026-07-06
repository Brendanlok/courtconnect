'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, CalendarDays, Trophy, Users, Zap } from 'lucide-react';
import { useApp } from '@/context/AppContext';

const LINKS = [
  { href: '/',            label: 'Home',    icon: Home },
  { href: '/matches',     label: 'Matches', icon: CalendarDays },
  { href: '/live',        label: 'Live',    icon: Zap },
  { href: '/tournaments', label: 'Events',  icon: Trophy },
  { href: '/players',     label: 'Players', icon: Users },
];

const norm = (p: string) => p.replace(/\/$/, '') || '/';

export function BottomNav() {
  const path = usePathname();
  // keep useApp import alive for future badge needs
  useApp();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur border-t border-slate-800 grid grid-cols-5">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = norm(path) === norm(href);

        return (
          <Link key={href} href={href}
            className={`flex flex-col items-center justify-center py-2.5 gap-1 relative transition-colors
              ${active ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}>
            <span className="relative">
              <Icon size={22} strokeWidth={active ? 2.5 : 2} />
            </span>
            <span className="text-[10px] font-medium leading-none">{label}</span>
            {active && <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-emerald-400 rounded-t-full" />}
          </Link>
        );
      })}
    </nav>
  );
}
