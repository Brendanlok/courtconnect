'use client';
import { useState, useRef, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Avatar } from '@/components/ui/Avatar';
import { TierBadge } from '@/components/ui/TierBadge';
import { QRModal } from '@/components/QRModal';
import { LogMatchModal } from '@/components/LogMatchModal';
import { SettingsModal } from '@/components/SettingsModal';
import { Plus, User, Settings, LogOut, QrCode, ChevronDown, MapPin, Bell, Navigation, X, Sun, Moon } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { NotificationPanel } from '@/components/NotificationPanel';
import { MY_STATES, COUNTRIES, getCountryByName } from '@/lib/utils';
import type { MalaysiaState } from '@/types';

// Rough coordinate → Malaysian state mapping
function coordsToState(lat: number, lng: number): { state: MalaysiaState; area: string } {
  if (lng > 114) return { state: 'Sabah',   area: 'Kota Kinabalu' };
  if (lng > 108) return { state: 'Sarawak', area: 'Kuching' };
  if (lat > 5.8) return { state: 'Kelantan', area: 'Kota Bharu' };
  if (lat > 5.2 && lng < 101) return { state: 'Kedah', area: 'Alor Setar' };
  if (lat > 5.2 && lng < 102) return { state: 'Penang', area: 'George Town' };
  if (lat > 4.5 && lng < 102) return { state: 'Perak', area: 'Ipoh' };
  if (lat > 4.5 && lng > 102) return { state: 'Kelantan', area: 'Kota Bharu' };
  if (lat > 4 && lng > 103)   return { state: 'Terengganu', area: 'Kuala Terengganu' };
  if (lat > 3.5 && lng > 103) return { state: 'Pahang', area: 'Kuantan' };
  if (lat > 3.2 && lat < 3.5 && lng > 101.5 && lng < 102) return { state: 'Kuala Lumpur', area: 'Cheras' };
  if (lat > 2.9 && lat < 3.4 && lng > 101.4 && lng < 101.8) return { state: 'Kuala Lumpur', area: 'Kuala Lumpur' };
  if (lat > 2.8 && lng > 101.3 && lng < 101.8) return { state: 'Selangor', area: 'Petaling Jaya' };
  if (lat > 2.8 && lng > 101.6 && lng < 102.2) return { state: 'Selangor', area: 'Kajang' };
  if (lat > 3   && lng > 101.5) return { state: 'Selangor', area: 'Shah Alam' };
  if (lat > 2.5 && lat < 3) return { state: 'Negeri Sembilan', area: 'Seremban' };
  if (lat > 2   && lat < 2.4) return { state: 'Melaka', area: 'Melaka City' };
  if (lat > 1.5 && lng > 103.5) return { state: 'Johor', area: 'Johor Bahru' };
  if (lat > 1.5 && lng < 103.5) return { state: 'Johor', area: 'Muar' };
  return { state: 'Selangor', area: 'Petaling Jaya' };
}

function LocationPicker({ onClose }: { onClose: () => void }) {
  const { user, updateUser } = useApp();
  const [state,    setState]    = useState<MalaysiaState>(user.state);
  const [area,     setArea]     = useState(user.area);
  const [detecting,setDetecting]= useState(false);
  const [gpsError, setGpsError] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  const detect = () => {
    if (!navigator.geolocation) { setGpsError('Geolocation not supported by your browser.'); return; }
    setDetecting(true); setGpsError('');
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { state: s, area: a } = coordsToState(pos.coords.latitude, pos.coords.longitude);
        setState(s); setArea(a);
        setDetecting(false);
      },
      () => { setGpsError('Could not get your location. Pick manually below.'); setDetecting(false); },
      { timeout: 8000 }
    );
  };

  const save = () => {
    updateUser({ state, area });
    onClose();
  };

  return (
    <div ref={ref}
      className="absolute left-0 top-full mt-2 w-72 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <p className="font-semibold text-sm flex items-center gap-2"><MapPin size={14} className="text-emerald-400"/> Your Location</p>
        <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={15}/></button>
      </div>
      <div className="p-4 space-y-3">
        <button onClick={detect} disabled={detecting}
          className="w-full flex items-center justify-center gap-2 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
          <Navigation size={14} className={detecting ? 'animate-spin' : ''}/>
          {detecting ? 'Detecting…' : 'Use my current location'}
        </button>
        {gpsError && <p className="text-xs text-red-400">{gpsError}</p>}
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <div className="flex-1 h-px bg-slate-800"/><span>or pick manually</span><div className="flex-1 h-px bg-slate-800"/>
        </div>
        <label className="block">
          <span className="text-[11px] text-slate-500 font-semibold">State</span>
          <select value={state} onChange={e => setState(e.target.value as MalaysiaState)}
            className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500 transition-colors">
            {MY_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-[11px] text-slate-500 font-semibold">Area / City</span>
          <input value={area} onChange={e => setArea(e.target.value)} placeholder="e.g. Petaling Jaya"
            className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500 transition-colors"/>
        </label>
        <button onClick={save}
          className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 font-bold rounded-xl text-sm transition-colors">
          Save Location
        </button>
      </div>
    </div>
  );
}

export function Topbar() {
  const { user, unreadNotifCount } = useApp();
  const { logout } = useAuth();
  const [menuOpen,    setMenuOpen]    = useState(false);
  const [notifOpen,   setNotifOpen]   = useState(false);
  const [locationOpen,setLocationOpen]= useState(false);
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
      <header className="h-14 bg-slate-900/80 backdrop-blur border-b border-slate-800 flex items-center justify-between px-5 shrink-0 relative z-30">
        {/* Left: clickable location */}
        <div className="relative hidden sm:block">
          <button onClick={() => { setLocationOpen(o => !o); setMenuOpen(false); setNotifOpen(false); }}
            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors group">
            <MapPin size={13} className="text-emerald-400" />
            <span className="text-slate-300 font-medium group-hover:text-emerald-300 transition-colors">{user.area},</span>
            <span>{user.state}</span>
            <ChevronDown size={11} className={`text-slate-500 transition-transform ${locationOpen ? 'rotate-180' : ''}`}/>
            <span className="ml-1 text-xs bg-slate-800 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">🇲🇾 Malaysia</span>
          </button>
          {locationOpen && <LocationPicker onClose={() => setLocationOpen(false)}/>}
        </div>
        {/* Mobile: app name */}
        <span className="sm:hidden font-bold text-emerald-400 text-base">CourtConnect</span>

        {/* Right */}
        <div className="flex items-center gap-3">
          <button onClick={() => setLogOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl text-sm transition-colors">
            <Plus size={15} /> Log Match
          </button>

          {/* Notification bell */}
          <div className="relative">
            <button onClick={() => { setNotifOpen(o => !o); setMenuOpen(false); setLocationOpen(false); }}
              className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-800 transition-colors">
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
                  <div className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer" onClick={toggleTheme}>
                    <div className="flex items-center gap-3 text-sm">
                      {isDark ? <Moon size={15} className="text-slate-400"/> : <Sun size={15} className="text-amber-400"/>}
                      <span>{isDark ? 'Dark Mode' : 'Light Mode'}</span>
                    </div>
                    <div className={`relative w-8 h-4 rounded-full transition-colors ${isDark ? 'bg-slate-600' : 'bg-amber-400'}`}>
                      <span className={`absolute top-[2px] left-[2px] w-3 h-3 bg-white rounded-full shadow transition-transform ${isDark ? '' : 'translate-x-4'}`}/>
                    </div>
                  </div>
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

      <QRModal       open={qrOpen}   onClose={() => setQrOpen(false)} />
      <LogMatchModal open={logOpen}  onClose={() => setLogOpen(false)} />
      <SettingsModal open={settOpen} onClose={() => setSettOpen(false)} />
    </>
  );
}
