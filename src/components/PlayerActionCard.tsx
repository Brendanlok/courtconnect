'use client';
import { useState } from 'react';
import { Swords, MessageCircle, ThumbsUp, UserPlus, UserCheck, Clock } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Avatar } from '@/components/ui/Avatar';
import { TierBadge } from '@/components/ui/TierBadge';
import { Button } from '@/components/ui/Button';
import { ChallengeModal } from '@/components/ChallengeModal';
import type { UserProfile } from '@/types';
import { BASE_PATH, isCalibrating } from '@/lib/utils';

const ENDORSE_SKILLS = ['Powerful Smash', 'Sharp Net Play', 'Great Footwork', 'Strong Defense', 'Smart Placement', 'Good Sportsmanship'];

// Compact card for a real account found by username or uid — used wherever
// there's no full profile page to show them on yet (see /profile/ and
// FindPlayerModal). Challenge / Message / Endorse are the only real
// cross-account actions built so far; a full match-history/stats view for a
// stranger isn't wired up (AppContext has no "load this uid's matches" path).
export function PlayerActionCard({ player }: { player: UserProfile }) {
  const { myEndorsements, endorsePlayer, following, followRequestsSent, followPlayer, unfollowPlayer } = useApp();
  // Open straight into the challenge dialog when arrived via a ?challenge=1
  // deep link (the "Challenge" button in a real-player chat builds this) —
  // same intent PlayerProfileClient already honours for demo players.
  const [challengeOpen, setChallengeOpen] = useState(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('challenge') === '1'
  );
  const given = myEndorsements[player.uid] ?? [];
  const isFollowing = following.includes(player.uid);
  const hasRequested = followRequestsSent.includes(player.uid);

  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Avatar name={player.displayName} photoURL={player.photoURL} size="lg"/>
        <div className="min-w-0">
          <p className="font-bold truncate">{player.displayName}</p>
          <p className="text-xs text-slate-500">@{player.username}</p>
          <div className="flex items-center gap-2 mt-1">
            <TierBadge tier={player.tier} placementMatchesPlayed={player.placementMatchesPlayed}/>
            {!isCalibrating(player) && <span className="text-xs text-slate-400">{player.mmr.toLocaleString()} MMR</span>}
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
        <button onClick={() => { if (isFollowing || hasRequested) unfollowPlayer(player.uid); else followPlayer(player.uid, player.isPrivate); }}
          title={hasRequested ? 'Cancel follow request' : isFollowing ? 'Unfollow' : player.isPrivate ? 'Request to follow' : 'Follow'}
          className={`flex items-center justify-center gap-1.5 px-3 rounded-xl text-sm font-medium border transition-colors ${
            isFollowing
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400'
              : hasRequested
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600'
          }`}>
          {isFollowing ? <UserCheck size={14}/> : hasRequested ? <Clock size={14}/> : <UserPlus size={14}/>}
        </button>
      </div>

      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span><span className="font-semibold text-slate-300">{(player.followingCount ?? 0).toLocaleString()}</span> Following</span>
        <span><span className="font-semibold text-slate-300">{(player.followersCount ?? 0).toLocaleString()}</span> Followers</span>
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
