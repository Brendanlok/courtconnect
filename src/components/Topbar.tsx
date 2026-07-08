'use client';
import { useState, useRef, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Avatar } from '@/components/ui/Avatar';
import { TierBadge } from '@/components/ui/TierBadge';
import { QRModal } from '@/components/QRModal';
import { LogMatchModal } from '@/components/LogMatchModal';
import { SettingsModal } from '@/components/SettingsModal';
import { Plus, User, Settings, LogOut, QrCode, ChevronDown, Bell, Sun, Moon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { NotificationPanel } from '@/components/NotificationPanel';

export function Topbar() {
  const { user, unreadNotifCount } = useApp();
  const { logout } = useAuth();
  const [menuOpen,    setMenuOpen]    = useState(false);
  const [notifOpen,   setNotifOpen]   = useState(false);
  const [qrOpen,      setQrOpen]      = useState(false);
  const [logOpen,     setLogOpen]     = useState(false);
  const [settOpen,    setSettOpen]    = useState(false);
  const [isDark,      setIsDark]      = useState(() =>
    typeof window !== 'undefined' ? !document.documentElement.classList.contains('light') : true
  );

  const toggleTheme = () => {
    const goLight = isDark;
    document.documentElement.classList.toggle('light', goLight);
    localStorage.setItem('cc_theme', goLight ? 'light' : 'dark');
    setIsDark(!goLight);
  };
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const goToProfile = () => { setMenuOpen(false); window.location.href = `/players/${user.username}/`; };

  return (
    <>
      <header className="h-14 bg-slate-900/80 backdrop-blur border-b border-slate-800 flex items-center justify-between px-4 sm:px-5 shrink-0 relative z-30">
        {/* Left: app branding */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0">
            <span className="text-black font-black text-xs">CC</span>
          </div>
          <span className="font-bold text-sm tracking-tight">CourtConnect</span>
        </div>

        {/* Right */}
        <div className="flex items-center gap-3">
          <button onClick={() => setLogOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl text-sm transition-colors">
            <Plus size={15} /> Log Match
          </button>

          {/* Notification bell */}
          <div className="relative">
            <button onClick={() => { setNotifOpen(o => !o); setMenuOpen(false); }} aria-label="Notifications"
              className="relative w-11 h-11 flex items-center justify-center rounded-xl hover:bg-slate-800 transition-colors">
              <Bell size={17} className="text-slate-400"/>
              {unreadNotifCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[14px] h-3.5 bg-red-500 rounded-full text-[8px] font-bold flex items-center justify-center text-white px-0.5 leading-none">
                  {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                </span>
              )}
            </button>
            {notifOpen && <NotificationPanel onClose={() => setNotifOpen(false)}/>}
          </div>

          {/* User menu */}
          <div className="relative" ref={menuRef}>
            <button onClick={() => setMenuOpen(o => !o)} aria-label="Account menu" aria-expanded={menuOpen}
              className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl hover:bg-slate-800 transition-colors">
              <Avatar name={user.displayName} size="sm" />
              <div className="text-left hidden sm:block">
                <p className="text-xs font-semibold leading-tight">{user.displayName}</p>
                <p className="text-[10px] text-slate-400">@{user.username}</p>
              </div>
              <ChevronDown size={14} className={`text-slate-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
            </button>

            {menuOpen && (
              <div className="popover-anim origin-top-right absolute right-0 top-full mt-2 w-64 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl shadow-black/50 z-50 overflow-hidden">
                <div className="p-4 border-b border-slate-800">
                  <div className="flex items-center gap-3">
                    <Avatar name={user.displayName} />
                    <div>
                      <p className="font-bold text-sm">{user.displayName}</p>
                      <p className="text-xs text-slate-400">@{user.username}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <TierBadge tier={user.tier} placementMatchesPlayed={user.placementMatchesPlayed}/>
                        <span className="text-xs text-amber-400 font-bold">{user.mmr.toLocaleString()} MMR</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-2">
                  <button onClick={goToProfile}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800 transition-colors text-sm text-left">
                    <User size={15} className="text-slate-400" /> View Profile
                  </button>
                  <button onClick={() => { setQrOpen(true); setMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800 transition-colors text-sm">
                    <QrCode size={15} className="text-slate-400" /> My QR Code
                  </button>
                  <button onClick={() => { setSettOpen(true); setMenuOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-800 transition-colors text-sm">
                    <Settings size={15} className="text-slate-400" /> Settings
                  </button>
                  {/* Theme toggle */}
                  <button type="button" onClick={toggleTheme} role="switch" aria-checked={!isDark}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-800 transition-colors">
                    <div className="flex items-center gap-3 text-sm">
                      {isDark ? <Moon size={15} className="text-slate-400"/> : <Sun size={15} className="text-amber-400"/>}
                      <span>{isDark ? 'Dark Mode' : 'Light Mode'}</span>
                    </div>
                    <div className={`relative w-8 h-4 rounded-full transition-colors shrink-0 ${isDark ? 'bg-slate-600' : 'bg-amber-400'}`}>
                      <span className={`absolute top-[2px] left-[2px] w-3 h-3 bg-white rounded-full shadow transition-transform ${isDark ? '' : 'translate-x-4'}`}/>
                    </div>
                  </button>
                </div>
                <div className="p-2 border-t border-slate-800">
                  <button onClick={() => { setMenuOpen(false); logout(); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-500/10 text-red-400 transition-colors text-sm">
                    <LogOut size={15} /> Log Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {qrOpen   && <QRModal       open={true} onClose={() => setQrOpen(false)} />}
      {logOpen  && <LogMatchModal open={true} onClose={() => setLogOpen(false)} />}
      {settOpen && <SettingsModal open={true} onClose={() => setSettOpen(false)} />}
    </>
  );
}
