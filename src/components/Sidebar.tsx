'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { Home, TrendingUp, Trophy, Users, Menu, Zap, MessageCircle } from 'lucide-react';

const LINKS = [
  { href: '/',            label: 'Home',        icon: Home },
  { href: '/leaderboard', label: 'Leaderboard', icon: TrendingUp },
  { href: '/tournaments', label: 'Tournaments', icon: Trophy },
  { href: '/players',     label: 'Players',     icon: Users },
  { href: '/live',        label: 'Live Score',  icon: Zap },
  { href: '/chat',        label: 'Messages',    icon: MessageCircle },
];

export function Sidebar() {
  const path = usePathname();
  const { sidebarCollapsed, toggleSidebar, totalUnread } = useApp();
  const collapsed = sidebarCollapsed;

  return (
    <aside
      style={{ width: collapsed ? 56 : 200, transition: 'width 220ms cubic-bezier(0.4,0,0.2,1)' }}
      className="hidden md:flex flex-col bg-slate-900 border-r border-slate-800 shrink-0 h-screen overflow-hidden"
    >
      {/* Logo + hamburger */}
      <div className="flex items-center h-14 border-b border-slate-800 px-2 shrink-0 overflow-hidden gap-1">
        <button
          onClick={toggleSidebar}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors shrink-0"
        >
          <Menu size={18} />
        </button>
        <span
          style={{
            opacity: collapsed ? 0 : 1,
            maxWidth: collapsed ? 0 : 140,
            marginLeft: collapsed ? 0 : 4,
            transition: 'opacity 150ms, max-width 220ms, margin 220ms',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}
          className="font-bold text-emerald-400 text-[15px]"
        >
          CourtConnect
        </span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-hidden">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = path === href || path === href + '/';
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={[
                'flex items-center rounded-xl text-sm font-medium transition-colors relative overflow-hidden',
                collapsed ? 'justify-center p-2.5' : 'px-3 py-2.5',
                active
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 shadow-[0_0_0_0] shadow-emerald-500/10'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800 border border-transparent',
              ].join(' ')}
            >
              <span className="relative shrink-0">
                <Icon size={18} strokeWidth={active ? 2.5 : 2} />
              </span>

              {/* Label — fades out when collapsed */}
              <span
                style={{
                  opacity: collapsed ? 0 : 1,
                  maxWidth: collapsed ? 0 : 120,
                  marginLeft: collapsed ? 0 : 10,
                  transition: 'opacity 150ms, max-width 220ms, margin 220ms',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                }}
              >
                {label}
              </span>

              {/* Active dot */}
              {active && !collapsed && (
                <span className="ml-auto w-1.5 h-1.5 bg-emerald-400 rounded-full shrink-0" />
              )}
            </Link>
          );
        })}
      </nav>

    </aside>
  );
}
