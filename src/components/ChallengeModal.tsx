'use client';
import { useState } from 'react';
import { X, Swords, MapPin, Calendar, MessageSquare } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { MATCH_TYPE_LABEL } from '@/lib/utils';
import type { UserProfile, MatchType, Challenge } from '@/types';
import { useModalA11y } from '@/hooks/useModalA11y';
import { Button } from '@/components/ui/Button';

const FORMATS: MatchType[] = ['MS', 'WS', 'MD', 'WD', 'MX'];

export function ChallengeModal({ opponent, onClose }: { opponent: UserProfile; onClose: () => void }) {
  const { user, sendChallenge } = useApp();

  const [format,  setFormat]  = useState<MatchType>('MS');
  const [venue,   setVenue]   = useState('');
  const [date,    setDate]    = useState('');
  const [time,    setTime]    = useState('');
  const [message, setMessage] = useState('');
  const [sent,    setSent]    = useState(false);

  const { ref: panelRef, dialogProps } = useModalA11y(!sent, onClose, `Challenge ${opponent.displayName}`);

  const inp = 'w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-500 transition-colors';

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!venue.trim() || !date || !time) return;

    const c: Challenge = {
      id: `ch_${Date.now()}`,
      fromId: user.uid,
      fromName: user.displayName,
      fromUsername: user.username,
      toId: opponent.uid,
      toName: opponent.displayName,
      toUsername: opponent.username,
      format,
      venue: venue.trim(),
      date: `${date}T${time}:00`,
      message: message.trim() || undefined,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    sendChallenge(c);
    setSent(true);
    setTimeout(onClose, 1400);
  };

  if (sent) return (
    <div className="modal-backdrop fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl p-10 text-center">
        <div className="text-4xl mb-3">⚔️</div>
        <p className="text-lg font-bold">Challenge Sent!</p>
        <p className="text-sm text-slate-400 mt-1">Waiting for {opponent.displayName} to respond.</p>
      </div>
    </div>
  );

  return (
    <div className="modal-backdrop fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4" onClick={onClose}>
      <div ref={panelRef} {...dialogProps} className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl outline-none" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="font-bold flex items-center gap-2">
            <Swords size={16} className="text-amber-400"/> Challenge {opponent.displayName}
          </h2>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-white transition-colors"><X size={18}/></button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          {/* Format */}
          <div>
            <p className="text-[11px] text-slate-500 font-semibold mb-2">Format</p>
            <div className="flex gap-1.5 flex-wrap">
              {FORMATS.map(f => (
                <button key={f} type="button" onClick={() => setFormat(f)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors
                    ${format === f
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                      : 'bg-transparent border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-300'}`}>
                  {f} · {MATCH_TYPE_LABEL[f]}
                </button>
              ))}
            </div>
          </div>

          {/* Venue */}
          <label className="block">
            <p className="text-[11px] text-slate-500 font-semibold mb-1.5 flex items-center gap-1">
              <MapPin size={10}/> Venue / Court
            </p>
            <input value={venue} onChange={e => setVenue(e.target.value)} required
              placeholder="e.g. Bukit Kiara Sports Complex, KL"
              className={inp}/>
          </label>

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <p className="text-[11px] text-slate-500 font-semibold mb-1.5 flex items-center gap-1">
                <Calendar size={10}/> Date
              </p>
              <input value={date} onChange={e => setDate(e.target.value)} required
                type="date" min={new Date().toISOString().slice(0,10)}
                className={inp}/>
            </label>
            <label className="block">
              <p className="text-[11px] text-slate-500 font-semibold mb-1.5">Time</p>
              <input value={time} onChange={e => setTime(e.target.value)} required
                type="time" className={inp}/>
            </label>
          </div>

          {/* Message */}
          <label className="block">
            <p className="text-[11px] text-slate-500 font-semibold mb-1.5 flex items-center gap-1">
              <MessageSquare size={10}/> Message <span className="text-slate-600 font-normal">(optional)</span>
            </p>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={2}
              placeholder={`e.g. Hey ${opponent.displayName.split(' ')[0]}, up for a game?`}
              className={`${inp} resize-none`}/>
          </label>

          <Button type="submit" variant="amber" icon={<Swords size={14}/>} className="w-full font-bold">
            Send Challenge
          </Button>
        </form>
      </div>
    </div>
  );
}
