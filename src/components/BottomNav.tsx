'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, TrendingUp, Trophy, Users, MessageCircle } from 'lucide-react';
import { useApp } from '@/context/AppContext';

const LINKS = [
  { href: '/',            label: 'Home',        icon: Home },
  { href: '/leaderboard', label: 'Ranks',       icon: TrendingUp },
  { href: '/tournaments', label: 'Tournaments', icon: Trophy },
  { href: '/players',     label: 'Players',     icon: Users },
  { href: '/chat',        label: 'Messages',    icon: MessageCircle, badge: true },
];

const norm = (p: string) => p.replace(/\/$/, '') || '/';

export function BottomNav() {
  const path = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur border-t border-slate-800 flex">
      {LINKS.map(({ href, label, icon: Icon, badge }) => {
        const active = norm(path) === norm(href);
        return (
          <Link key={href} href={href}
            className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-1 relative transition-colors
              ${active ? 'text-emerald-400' : 'text-slate-500 hover:text-slate-300'}`}>
            <span className="relative">
              <Icon size={20} strokeWidth={active ? 2.5 : 2} />
              {badge && (
                <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-red-500 rounded-full text-[8px] font-bold flex items-center justify-center text-white leading-none">
                  3
                </span>
              )}
            </span>
            <span className="text-[10px] font-medium leading-none">{label}</span>
            {active && <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-emerald-400 rounded-t-full" />}
          </Link>
        );
      })}
    </nav>
  );
}
