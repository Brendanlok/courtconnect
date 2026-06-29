'use client';
import { useState } from 'react';
import { X, Save } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { MY_STATES } from '@/lib/utils';
import type { MalaysiaState } from '@/types';

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, updateUser } = useApp();

  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio,         setBio]         = useState(user.bio ?? '');
  const [state,       setState]       = useState<MalaysiaState>(user.state);
  const [area,        setArea]        = useState(user.area);
  const [available,   setAvailable]   = useState(user.available ?? '');
  const [saved,       setSaved]       = useState(false);

  if (!open) return null;

  const save = () => {
    updateUser({ displayName, bio, state, area, available });
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        {saved ? (
          <div className="p-12 text-center">
            <div className="text-5xl mb-4">✅</div>
            <p className="text-xl font-bold">Saved!</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <h2 className="font-bold text-lg">Settings</h2>
              <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X size={20}/></button>
            </div>

            <div className="p-5 space-y-4 max-h-[72vh] overflow-y-auto">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold">Profile</p>

              <label className="block">
                <span className="text-xs text-slate-400 font-semibold">Display Name</span>
                <input value={displayName} onChange={e => setDisplayName(e.target.value)}
                  className="mt-1.5 w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-500 transition-colors"/>
              </label>

              <label className="block">
                <span className="text-xs text-slate-400 font-semibold">Bio</span>
                <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3}
                  placeholder="Tell other players about yourself…"
                  className="mt-1.5 w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-500 transition-colors resize-none"/>
              </label>

              <label className="block">
                <span className="text-xs text-slate-400 font-semibold">Availability</span>
                <input value={available} onChange={e => setAvailable(e.target.value)}
                  placeholder="e.g. Weekday evenings, Weekends"
                  className="mt-1.5 w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-500 transition-colors"/>
              </label>

              <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold pt-1">Location</p>

              <label className="block">
                <span className="text-xs text-slate-400 font-semibold">State</span>
                <select value={state} onChange={e => setState(e.target.value as MalaysiaState)}
                  className="mt-1.5 w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-500 transition-colors">
                  {MY_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>

              <label className="block">
                <span className="text-xs text-slate-400 font-semibold">Area / City</span>
                <input value={area} onChange={e => setArea(e.target.value)}
                  placeholder="e.g. Petaling Jaya"
                  className="mt-1.5 w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-500 transition-colors"/>
              </label>

              <div className="bg-slate-800/50 border border-slate-700 rounded-xl px-3 py-2.5">
                <p className="text-xs text-slate-500">Username: <span className="text-slate-300 font-semibold">@{user.username}</span> · cannot be changed</p>
              </div>
            </div>

            <div className="p-5 pt-0 flex gap-3">
              <button onClick={save}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold text-sm transition-colors">
                <Save size={15}/> Save Changes
              </button>
              <button onClick={onClose}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl font-semibold text-sm transition-colors">
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
