'use client';
import { useState } from 'react';
import { Swords, MessageCircle, ThumbsUp } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Avatar } from '@/components/ui/Avatar';
import { TierBadge } from '@/components/ui/TierBadge';
import { Button } from '@/components/ui/Button';
import { ChallengeModal } from '@/components/ChallengeModal';
import type { UserProfile } from '@/types';
import { BASE_PATH } from '@/lib/utils';

const ENDORSE_SKILLS = ['Powerful Smash', 'Sharp Net Play', 'Great Footwork', 'Strong Defense', 'Smart Placement', 'Good Sportsmanship'];

// Compact card for a real account found by username or uid — used wherever
// there's no full profile page to show them on yet (see /profile/ and
// FindPlayerModal). Challenge / Message / Endorse are the only real
// cross-account actions built so far; a full match-history/stats view for a
// stranger isn't wired up (AppContext has no "load this uid's matches" path).
export function PlayerActionCard({ player }: { player: UserProfile }) {
  const { myEndorsements, endorsePlayer } = useApp();
  const [challengeOpen, setChallengeOpen] = useState(false);
  const given = myEndorsements[player.uid] ?? [];

  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Avatar name={player.displayName} photoURL={player.photoURL} size="lg"/>
        <div className="min-w-0">
          <p className="font-bold truncate">{player.displayName}</p>
          <p className="text-xs text-slate-500">@{player.username}</p>
          <div className="flex items-center gap-2 mt-1">
            <TierBadge tier={player.tier}/>
            <span className="text-xs text-slate-400">{player.mmr.toLocaleString()} MMR</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={() => setChallengeOpen(true)} variant="amber" icon={<Swords size={14}/>} className="flex-1">
          Challenge
        </Button>
        <Button variant="secondary" onClick={() => { window.location.href = `${BASE_PATH}/chat/?realUid=${player.uid}`; }}
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
              <button key={skill} onClick={() => endorsePlayer(player.uid, skill)}
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

      {challengeOpen && <ChallengeModal opponent={player} onClose={() => setChallengeOpen(false)}/>}
    </div>
  );
}
