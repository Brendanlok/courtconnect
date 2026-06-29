'use client';
import { useState } from 'react';
import { X, Save, Trash2, AlertTriangle } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { MY_STATES, AVAILABILITY_OPTIONS, postcodeToCity } from '@/lib/utils';
import type { MalaysiaState } from '@/types';

type DeleteStep = 'idle' | 'warn' | 'confirm';

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, updateUser } = useApp();

  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio,         setBio]         = useState(user.bio ?? '');
  const [state,       setState]       = useState<MalaysiaState>(user.state);
  const [postcode,    setPostcode]    = useState(user.postcode ?? '');
  const [availability,setAvailability]= useState<string[]>(
    (user.available ?? '').split(',').map(s => s.trim()).filter(Boolean)
  );
  const [saved,       setSaved]       = useState(false);
  const [deleteStep,  setDeleteStep]  = useState<DeleteStep>('idle');
  const [deleteInput, setDeleteInput] = useState('');

  if (!open) return null;

  const inp = 'w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500 transition-colors';
  const city = postcodeToCity(postcode);

  const toggleAvail = (id: string) =>
    setAvailability(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const save = () => {
    updateUser({ displayName, bio, state, postcode,
      area: city ?? user.area,
      available: availability.join(',') });
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

        <div className="p-5 space-y-4 max-h-[72vh] overflow-y-auto">

          {/* Name + Bio */}
          <label className="block">
            <span className="text-[11px] text-slate-500 font-semibold">Display Name</span>
            <input value={displayName} onChange={e => setDisplayName(e.target.value)} className={`mt-1 ${inp}`}/>
          </label>

          <label className="block">
            <span className="text-[11px] text-slate-500 font-semibold">Bio</span>
            <textarea value={bio} onChange={e => setBio(e.target.value)} rows={2}
              placeholder="Tell other players about yourself…"
              className={`mt-1 ${inp} resize-none`}/>
          </label>

          {/* Location */}
          <div>
            <p className="text-[11px] text-slate-500 font-semibold mb-2">Location</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[11px] text-slate-500">State</span>
                <select value={state} onChange={e => setState(e.target.value as MalaysiaState)} className={`mt-1 ${inp}`}>
                  {MY_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] text-slate-500">Postcode</span>
                <input value={postcode} onChange={e => setPostcode(e.target.value.replace(/\D/g,'').slice(0,5))}
                  placeholder="e.g. 47810" maxLength={5} className={`mt-1 ${inp} font-mono`}/>
                {city && (
                  <p className="text-xs text-emerald-400 mt-1 flex items-center gap-1">
                    <span className="text-slate-500">→</span> {city}
                  </p>
                )}
                {postcode.length === 5 && !city && (
                  <p className="text-xs text-red-400 mt-1">Postcode not recognised</p>
                )}
              </label>
            </div>
          </div>

          {/* Availability checklist */}
          <div>
            <p className="text-[11px] text-slate-500 font-semibold mb-2">Availability</p>
            <div className="grid grid-cols-2 gap-1.5">
              {AVAILABILITY_OPTIONS.map(opt => {
                const checked = availability.includes(opt.id);
                return (
                  <button key={opt.id} type="button" onClick={() => toggleAvail(opt.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border text-left transition-colors
                      ${checked
                        ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300'}`}>
                    <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors
                      ${checked ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'}`}>
                      {checked && <span className="text-[9px] text-white font-bold">✓</span>}
                    </span>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Username (read-only) */}
          <div className="flex items-center justify-between px-3 py-2 bg-slate-800/50 border border-slate-800 rounded-xl">
            <span className="text-xs text-slate-500">Username</span>
            <span className="text-xs text-slate-300 font-semibold">@{user.username} · cannot be changed</span>
          </div>

          {/* Delete account */}
          <div className="border-t border-slate-800/80 pt-3">
            {deleteStep === 'idle' && (
              <button onClick={() => setDeleteStep('warn')}
                className="flex items-center gap-2 w-full px-3 py-2.5 border border-red-500/25 bg-red-500/5 hover:bg-red-500/10 text-red-400/80 hover:text-red-400 rounded-xl text-xs font-medium transition-colors">
                <Trash2 size={13}/> Delete account
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

        <div className="px-5 pb-5 flex gap-3 border-t border-slate-800 pt-4">
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
