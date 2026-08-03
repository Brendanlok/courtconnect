'use client';
import { useState } from 'react';
import { X, Settings, Crown } from 'lucide-react';
import type { Club } from '@/types';
import { useModalA11y } from '@/hooks/useModalA11y';
import { Button } from '@/components/ui/Button';

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

const FREE_MAX_MEMBERS = 200;
const PRO_MAX_MEMBERS = 500;

export function ClubSettingsModal({ club, onSave, onClose }: {
  club: Club;
  onSave: (patch: Partial<Club>) => void;
  onClose: () => void;
}) {
  const [name,        setName]        = useState(club.name);
  const [description,  setDescription] = useState(club.description);
  const [maxMembers,  setMaxMembers]  = useState(club.maxMembers);
  const [color,       setColor]       = useState(club.color);
  const [error,       setError]       = useState('');

  const { ref: panelRef, dialogProps } = useModalA11y(true, onClose, 'Club Settings');

  const cap = club.isPro ? PRO_MAX_MEMBERS : FREE_MAX_MEMBERS;
  const inp = 'w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-500 transition-colors';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Club name is required.');
    if (!description.trim()) return setError('Description is required.');
    if (maxMembers < club.memberIds.length) return setError(`Can't set the cap below the current member count (${club.memberIds.length}).`);
    if (maxMembers < 2 || maxMembers > cap) return setError(`Max members must be between 2 and ${cap}.`);
    onSave({ name: name.trim(), description: description.trim(), maxMembers, color });
    onClose();
  };

  return (
    <div className="modal-backdrop fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4" onClick={onClose}>
      <div ref={panelRef} {...dialogProps} className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl outline-none" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="font-bold flex items-center gap-2"><Settings size={16} className="text-emerald-400"/> Club Settings</h2>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-white"><X size={18}/></button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/25 px-3 py-2 rounded-xl">{error}</p>}

          <label className="block">
            <span className="text-[11px] text-slate-500 font-semibold">Club Name</span>
            <input value={name} onChange={e => setName(e.target.value)} className={`mt-1 ${inp}`}/>
          </label>

          <label className="block">
            <span className="text-[11px] text-slate-500 font-semibold">Description</span>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              className={`mt-1 ${inp} resize-none`}/>
          </label>

          <label className="block">
            <span className="text-[11px] text-slate-500 font-semibold flex items-center gap-1.5">
              Max Members
              {club.isPro && <span className="text-[9px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><Crown size={8}/>Pro: up to {PRO_MAX_MEMBERS}</span>}
            </span>
            <input type="number" min={2} max={cap} value={maxMembers} onChange={e => setMaxMembers(Number(e.target.value))} className={`mt-1 ${inp}`}/>
            {!club.isPro && <p className="text-[11px] text-slate-600 mt-1">Free clubs cap at {FREE_MAX_MEMBERS}. Club Pro raises this to {PRO_MAX_MEMBERS}.</p>}
          </label>

          <div>
            <p className="text-[11px] text-slate-500 font-semibold mb-2">Club Colour</p>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c.value} type="button" onClick={() => setColor(c.value)}
                  className={`w-7 h-7 rounded-lg ${c.value} transition-all ${color === c.value ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110' : 'opacity-60 hover:opacity-100'}`}/>
              ))}
            </div>
          </div>

          <Button type="submit" className="w-full font-bold">Save Changes</Button>
        </form>
      </div>
    </div>
  );
}
