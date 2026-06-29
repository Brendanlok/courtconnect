'use client';
import { useState } from 'react';
import { X, Save, Trash2, AlertTriangle } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { MY_STATES } from '@/lib/utils';
import type { MalaysiaState } from '@/types';

type DeleteStep = 'idle' | 'warn' | 'confirm';

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, updateUser } = useApp();

  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio,         setBio]         = useState(user.bio ?? '');
  const [state,       setState]       = useState<MalaysiaState>(user.state);
  const [area,        setArea]        = useState(user.area);
  const [available,   setAvailable]   = useState(user.available ?? '');
  const [saved,       setSaved]       = useState(false);
  const [deleteStep,  setDeleteStep]  = useState<DeleteStep>('idle');
  const [deleteInput, setDeleteInput] = useState('');

  if (!open) return null;

  const inp = 'w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500 transition-colors';

  const save = () => {
    updateUser({ displayName, bio, state, area, available });
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 900);
  };

  const handleDelete = () => {
    updateUser({ displayName: 'Deleted User', bio: '', mmr: 1000,
      stats: { wins: 0, losses: 0, totalMatches: 0 }, openToPlay: false });
    localStorage.removeItem('cc_openToPlay');
    setDeleteStep('idle');
    onClose();
  };

  if (saved) return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl p-10 text-center">
        <div className="text-4xl mb-3">✅</div>
        <p className="text-lg font-bold">Saved!</p>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="font-bold">Settings</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X size={18}/></button>
        </div>

        <div className="p-5 space-y-3 max-h-[72vh] overflow-y-auto">

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] text-slate-500 font-semibold">Display Name</span>
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} className={`mt-1 ${inp}`}/>
            </label>
            <label className="block">
              <span className="text-[11px] text-slate-500 font-semibold">Availability</span>
              <input value={available} onChange={e => setAvailable(e.target.value)}
                placeholder="e.g. Weekday evenings" className={`mt-1 ${inp}`}/>
            </label>
          </div>

          <label className="block">
            <span className="text-[11px] text-slate-500 font-semibold">Bio</span>
            <textarea value={bio} onChange={e => setBio(e.target.value)} rows={2}
              placeholder="Tell other players about yourself…"
              className={`mt-1 ${inp} resize-none`}/>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] text-slate-500 font-semibold">State</span>
              <select value={state} onChange={e => setState(e.target.value as MalaysiaState)}
                className={`mt-1 ${inp}`}>
                {MY_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] text-slate-500 font-semibold">Area / City</span>
              <input value={area} onChange={e => setArea(e.target.value)}
                placeholder="e.g. Petaling Jaya" className={`mt-1 ${inp}`}/>
            </label>
          </div>

          <div className="flex items-center justify-between px-3 py-2 bg-slate-800/50 border border-slate-800 rounded-xl">
            <span className="text-xs text-slate-500">Username</span>
            <span className="text-xs text-slate-300 font-semibold">@{user.username} · cannot be changed</span>
          </div>

          <div className="border-t border-slate-800/80 pt-2">
            {deleteStep === 'idle' && (
              <button onClick={() => setDeleteStep('warn')}
                className="flex items-center gap-1.5 text-xs text-red-500/70 hover:text-red-400 transition-colors">
                <Trash2 size={12}/> Delete account
              </button>
            )}

            {deleteStep === 'warn' && (
              <div className="bg-slate-800 border border-red-500/20 rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5"/>
                  <div>
                    <p className="text-sm font-semibold text-red-300">Permanently delete your profile?</p>
                    <p className="text-xs text-slate-400 mt-0.5">All match history, MMR, and stats will be lost. This cannot be undone.</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setDeleteStep('idle')}
                    className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors">
                    Cancel
                  </button>
                  <button onClick={() => { setDeleteInput(''); setDeleteStep('confirm'); }}
                    className="flex-1 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors">
                    Continue
                  </button>
                </div>
              </div>
            )}

            {deleteStep === 'confirm' && (
              <div className="bg-slate-800 border border-red-500/30 rounded-xl p-4 space-y-3">
                <p className="text-sm font-semibold text-red-300">Type <span className="font-mono bg-slate-700 px-1 rounded">DELETE</span> to confirm</p>
                <input value={deleteInput} onChange={e => setDeleteInput(e.target.value)}
                  placeholder="DELETE"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-red-500 transition-colors"/>
                <div className="flex gap-2">
                  <button onClick={() => setDeleteStep('idle')}
                    className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleDelete} disabled={deleteInput !== 'DELETE'}
                    className="flex-1 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors">
                    Delete forever
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-5 pb-5 flex gap-3">
          <button onClick={save}
            className="flex-1 flex items-center justify-center gap-2 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold text-sm transition-colors">
            <Save size={14}/> Save
          </button>
          <button onClick={onClose}
            className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl font-semibold text-sm transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
