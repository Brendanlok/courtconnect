'use client';
import { useState, useRef, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Avatar } from '@/components/ui/Avatar';
import { TierBadge } from '@/components/ui/TierBadge';
import { QRModal } from '@/components/QRModal';
import { LogMatchModal } from '@/components/LogMatchModal';
import { Plus, User, Settings, LogOut, QrCode, ChevronDown, MapPin } from 'lucide-react';
import Link from 'next/link';

export function Topbar() {
  const { user } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const [qrOpen,   setQrOpen]   = useState(false);
  const [logOpen,  setLogOpen]   = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <>
      <header className="h-14 bg-slate-900/80 backdrop-blur border-b border-slate-800 flex items-center justify-between px-5 shrink-0">
        {/* Left: location context — hidden on mobile */}
        <div className="hidden sm:flex items-center gap-1.5 text-sm text-slate-400">
          <MapPin size={13} className="text-emerald-400" />
          <span className="text-slate-300 font-medium">{user.area},</span>
          <span>{user.state}</span>
          <span className="ml-1 text-xs bg-slate-800 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">🇲🇾 Malaysia</span>
        </div>
        {/* Mobile: app name */}
        <span className="sm:hidden font-bold text-emerald-400 text-base">CourtConnect</span>

        {/* Right */}
        <div className="flex items-center gap-3">
          <button onClick={() => setLogOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl text-sm transition-colors">
            <Plus size={15} /> Log Match
          </button>

          {/* User menu */}
          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenuOpen(o => !o)}
              className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-slate-800 transition-colors">
              <Avatar name={user.displayName} size="sm" />
              <div className="text-left hidden sm:block">
                <p className="text-xs font-semibold leading-tight">{user.displayName}</p>
                <p className="text-[10px] text-slate-400">@{user.username}</p>
              </div>
              <ChevronDown size={14} className={`text-slate-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl shadow-black/50 z-50 overflow-hidden">
                {/* Profile summary */}
                <div className="p-4 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <Avatar name={user.displayName} />
                    <div>
                      <p className="font-bold text-sm">{user.displayName}</p>
                      <p className="text-xs text-slate-400">@{user.username}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <TierBadge tier={user.tier} />
                        <span className="text-xs text-amber-400 font-bold">{user.mmr.toLocaleString()} MMR</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Menu items */}
                <div className="p-2">
                  <Link href={`/players/${user.username}`} onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800 transition-colors text-sm">
                    <User size={15} className="text-slate-400" /> View Profile
                  </Link>
                  <button onClick={() => { setQrOpen(true); setMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800 transition-colors text-sm">
                    <QrCode size={15} className="text-slate-400" /> My QR Code
                  </button>
                  <button
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800 transition-colors text-sm">
                    <Settings size={15} className="text-slate-400" /> Settings
                  </button>
                </div>

                <div className="p-2 border-t border-slate-800">
                  <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-500/10 text-red-400 transition-colors text-sm">
                    <LogOut size={15} /> Log Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <QRModal    open={qrOpen}  onClose={() => setQrOpen(false)} />
      <LogMatchModal open={logOpen} onClose={() => setLogOpen(false)} />
    </>
  );
}
