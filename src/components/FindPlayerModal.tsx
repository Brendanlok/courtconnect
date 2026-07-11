'use client';
import { useState } from 'react';
import { X, Search, UserX } from 'lucide-react';
import { lookupUserByUsername } from '@/lib/firestoreService';
import { getTier } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { PlayerActionCard } from '@/components/PlayerActionCard';
import { useModalA11y } from '@/hooks/useModalA11y';
import { auth } from '@/lib/firebase';
import type { UserProfile } from '@/types';

export function FindPlayerModal({ onClose }: { onClose: () => void }) {
  const { ref: panelRef, dialogProps } = useModalA11y(true, onClose, 'Find a Player');
  const [query,   setQuery]   = useState('');
  const [status,  setStatus]  = useState<'idle' | 'loading' | 'not-found' | 'is-you' | 'found'>('idle');
  const [found,   setFound]   = useState<UserProfile | null>(null);

  const search = async () => {
    const clean = query.trim().toLowerCase().replace(/^@/, '');
    if (!clean) return;
    setStatus('loading');
    const data = await lookupUserByUsername(clean).catch(() => null);
    if (!data || !data.uid) { setStatus('not-found'); setFound(null); return; }
    if (data.uid === auth.currentUser?.uid) { setStatus('is-you'); setFound(null); return; }
    setFound({
      uid: data.uid, username: data.username ?? clean, displayName: data.displayName ?? 'Player',
      email: '', mmr: data.mmr ?? 1200, tier: getTier(data.mmr ?? 1200),
      globalRank: 0, state: 'Kuala Lumpur', area: '',
      stats: data.stats ?? { wins: 0, losses: 0, totalMatches: 0 }, joinedAt: '',
      photoURL: data.photoURL ?? null,
    });
    setStatus('found');
  };

  return (
    <div className="modal-backdrop fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4" onClick={onClose}>
      <div ref={panelRef} {...dialogProps} className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl outline-none" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="font-bold flex items-center gap-2">
            <Search size={16} className="text-emerald-400"/> Find a Player
          </h2>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-white transition-colors"><X size={18}/></button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-500">Look up a real CourtConnect account by their exact username to challenge, message, or endorse them.</p>
          <div className="flex gap-2">
            <input value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
              placeholder="@username"
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-emerald-500 transition-colors"/>
            <Button onClick={search} disabled={!query.trim() || status === 'loading'} icon={<Search size={14}/>}>
              {status === 'loading' ? 'Searching…' : 'Search'}
            </Button>
          </div>

          {status === 'not-found' && (
            <div className="flex items-center gap-2 text-sm text-slate-400 py-3">
              <UserX size={16} className="text-slate-600"/> No player found with that username.
            </div>
          )}
          {status === 'is-you' && (
            <div className="text-sm text-slate-400 py-3">That's your own username.</div>
          )}

          {status === 'found' && found && (
            <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4 space-y-4">
              <div className="flex items-center gap-3">
                <Avatar name={found.displayName} photoURL={found.photoURL} size="lg"/>
                <div className="min-w-0">
                  <p className="font-bold truncate">{found.displayName}</p>
                  <p className="text-xs text-slate-500">@{found.username}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <TierBadge tier={found.tier}/>
                    <span className="text-xs text-slate-400">{found.mmr.toLocaleString()} MMR</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={() => setChallengeOpen(true)} variant="amber" icon={<Swords size={14}/>} className="flex-1">
                  Challenge
                </Button>
                <Button variant="secondary" onClick={() => { window.location.href = `/chat/?realUid=${found.uid}`; }}
                  icon={<MessageCircle size={14}/>} className="flex-1">
                  Message
                </Button>
              </div>

              <div>
                <p className="text-[11px] text-slate-500 mb-2 flex items-center gap-1"><ThumbsUp size={11}/> Endorse this player</p>
                <div className="flex flex-wrap gap-1.5">
                  {ENDORSE_SKILLS.map(skill => {
                    const isGiven = given.includes(skill);
                    return (
                      <button key={skill} onClick={() => endorsePlayer(found.uid, skill)}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-colors
                          ${isGiven
                            ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-violet-500/50 hover:text-violet-300'}`}>
                        {skill}{isGiven && <span className="ml-1 text-[10px] opacity-60">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {challengeOpen && found && <ChallengeModal opponent={found} onClose={() => setChallengeOpen(false)}/>}
    </div>
  );
}
