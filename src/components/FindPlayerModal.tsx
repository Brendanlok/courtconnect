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

          {status === 'found' && found && <PlayerActionCard player={found}/>}
        </div>
      </div>
    </div>
  );
}
