'use client';
import { useState } from 'react';
import { X, Shield, ChevronDown, ChevronUp } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { MY_STATES } from '@/lib/utils';
import type { Club, ClubPurpose, MalaysiaState } from '@/types';
import { useModalA11y } from '@/hooks/useModalA11y';
import { Button } from '@/components/ui/Button';

const PURPOSES: ClubPurpose[] = ['Competitive', 'Training', 'Recreational', 'Social', 'Youth'];
const COLORS = [
  { label: 'Emerald', value: 'bg-emerald-600' },
  { label: 'Blue',    value: 'bg-blue-600' },
  { label: 'Violet',  value: 'bg-violet-600' },
  { label: 'Amber',   value: 'bg-amber-600' },
  { label: 'Red',     value: 'bg-red-600' },
  { label: 'Cyan',    value: 'bg-cyan-600' },
  { label: 'Rose',    value: 'bg-rose-600' },
  { label: 'Indigo',  value: 'bg-indigo-600' },
];

export function CreateClubModal({ onClose }: { onClose: () => void }) {
  const { user, createClub } = useApp();

  const [name,       setName]       = useState('');
  const [shortName,  setShortName]  = useState('');
  const [description,setDescription]= useState('');
  const [purpose,    setPurpose]    = useState<ClubPurpose>('Competitive');
  const [state,      setState]      = useState<MalaysiaState>(user.state);
  const [area,       setArea]       = useState(user.area);
  const [maxMembers, setMaxMembers] = useState(30);
  const [minMMR,     setMinMMR]     = useState('');
  const [isPrivate,  setIsPrivate]  = useState(false);
  const [color,      setColor]      = useState('bg-emerald-600');
  const [error,      setError]      = useState('');
  const [done,       setDone]       = useState(false);
  const [advOpen,    setAdvOpen]    = useState(false);

  const { ref: panelRef, dialogProps } = useModalA11y(!done, onClose, 'Create Club');

  const inp = 'w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-500 transition-colors';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim())      return setError('Club name is required.');
    if (!shortName.trim()) return setError('Short name is required.');
    if (!description.trim()) return setError('Description is required.');
    if (!area.trim())      return setError('Area is required.');

    const initials = shortName.trim().toUpperCase().slice(0, 3);
    const club: Club = {
      id: `club_${Date.now()}`,
      name: name.trim(),
      shortName: shortName.trim().toUpperCase(),
      description: description.trim(),
      purpose,
      state, area: area.trim(),
      logoInitials: initials,
      color,
      maxMembers,
      minMMR: minMMR ? Number(minMMR) : undefined,
      isPrivate,
      adminId: user.uid,
      memberIds: [user.uid],
      pendingIds: [],
      avgMMR: user.mmr,
      topPlayers: [user.displayName],
      tags: [purpose, isPrivate ? 'Invite Only' : 'Open'],
      foundedYear: new Date().getFullYear(),
    };
    createClub(club);
    setDone(true);
    setTimeout(onClose, 1200);
  };

  if (done) return (
    <div className="modal-backdrop fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm p-10 text-center">
        <div className="text-4xl mb-3">🛡️</div>
        <p className="text-lg font-bold">Club Created!</p>
        <p className="text-sm text-slate-400 mt-1">{name} is now live.</p>
      </div>
    </div>
  );

  return (
    <div className="modal-backdrop fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4" onClick={onClose}>
      <div ref={panelRef} {...dialogProps} className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl outline-none" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="font-bold flex items-center gap-2"><Shield size={16} className="text-emerald-400"/> Create Club</h2>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-white"><X size={18}/></button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/25 px-3 py-2 rounded-xl">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <label className="block col-span-2">
              <span className="text-[11px] text-slate-500 font-semibold">Club Name</span>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. KL Smashers" className={`mt-1 ${inp}`}/>
            </label>
            <label className="block">
              <span className="text-[11px] text-slate-500 font-semibold">Short Name</span>
              <input value={shortName} onChange={e => setShortName(e.target.value.toUpperCase().slice(0,4))}
                placeholder="e.g. KLS" maxLength={4} className={`mt-1 ${inp} font-mono`}/>
            </label>
            <label className="block">
              <span className="text-[11px] text-slate-500 font-semibold">Purpose</span>
              <select value={purpose} onChange={e => setPurpose(e.target.value as ClubPurpose)} className={`mt-1 ${inp}`}>
                {PURPOSES.map(p => <option key={p}>{p}</option>)}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-[11px] text-slate-500 font-semibold">Description</span>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              placeholder="Tell players what your club is about, training schedule, requirements…"
              className={`mt-1 ${inp} resize-none`}/>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] text-slate-500 font-semibold">State</span>
              <select value={state} onChange={e => setState(e.target.value as MalaysiaState)} className={`mt-1 ${inp}`}>
                {MY_STATES.map(s => <option key={s}>{s}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] text-slate-500 font-semibold">Area / City</span>
              <input value={area} onChange={e => setArea(e.target.value)} placeholder="e.g. Cheras" className={`mt-1 ${inp}`}/>
            </label>
          </div>

          {/* Advanced options — capacity, MMR gate, colour, privacy */}
          <button type="button" onClick={() => setAdvOpen(o => !o)}
            className="w-full flex items-center justify-between px-3 py-2 bg-slate-800/50 hover:bg-slate-800 border border-slate-800 rounded-xl transition-colors">
            <span className="text-xs font-semibold text-slate-300">Advanced options</span>
            <span className="flex items-center gap-1 text-[11px] text-slate-500">
              {!advOpen && (isPrivate ? 'Private' : 'Public')}
              {advOpen ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
            </span>
          </button>

          {advOpen && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-[11px] text-slate-500 font-semibold">Max Members</span>
                  <input type="number" min={2} max={200} value={maxMembers} onChange={e => setMaxMembers(Number(e.target.value))} className={`mt-1 ${inp}`}/>
                </label>
                <label className="block">
                  <span className="text-[11px] text-slate-500 font-semibold">Min MMR <span className="text-slate-600 font-normal">(optional)</span></span>
                  <input type="number" min={0} value={minMMR} onChange={e => setMinMMR(e.target.value)}
                    placeholder="No minimum" className={`mt-1 ${inp}`}/>
                </label>
              </div>

              {/* Color picker */}
              <div>
                <p className="text-[11px] text-slate-500 font-semibold mb-2">Club Colour</p>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map(c => (
                    <button key={c.value} type="button" onClick={() => setColor(c.value)}
                      className={`w-7 h-7 rounded-lg ${c.value} transition-all ${color === c.value ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110' : 'opacity-60 hover:opacity-100'}`}/>
                  ))}
                </div>
              </div>

              {/* Privacy toggle */}
              <div className="flex items-center justify-between px-4 py-3 bg-slate-800 rounded-xl">
                <div>
                  <p className="text-sm font-medium">{isPrivate ? 'Private — Request to Join' : 'Public — Open to Join'}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{isPrivate ? 'You approve each member manually' : 'Anyone meeting the MMR requirement can join instantly'}</p>
                </div>
                <button type="button" onClick={() => setIsPrivate(p => !p)}
                  className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${isPrivate ? 'bg-violet-500' : 'bg-emerald-500'}`}>
                  <span className={`absolute top-[2px] left-[2px] w-4 h-4 bg-white rounded-full shadow transition-transform ${isPrivate ? 'translate-x-5' : 'translate-x-0'}`}/>
                </button>
              </div>
            </div>
          )}

          <Button type="submit" className="w-full font-bold">
            Create Club
          </Button>
        </form>
      </div>
    </div>
  );
}
