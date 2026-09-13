'use client';
// Public, logged-out player profile — the shareable-link counterpart to the
// Rankings search box. Same anon-readable users_public view, same fields
// (see lib/publicData.ts); no matches/clubs data since there's no anon-safe
// view for those yet.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, MapPin, Share2, Copy, Check, Loader2 } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { TierBadge } from '@/components/ui/TierBadge';
import { Button } from '@/components/ui/Button';
import { fetchPublicPlayer, type PublicPlayer } from '@/lib/publicData';
import { usePublicAuth } from '@/context/PublicAuthContext';
import { BASE_PATH } from '@/lib/utils';

export function PlayerProfileClient({ username }: { username: string }) {
  const openAuth = usePublicAuth();
  const [player, setPlayer] = useState<PublicPlayer | null | 'not-found'>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    fetchPublicPlayer(username).then(p => { if (live) setPlayer(p ?? 'not-found'); });
    return () => { live = false; };
  }, [username]);

  const handleShare = async () => {
    const url = `${window.location.origin}${BASE_PATH}/rankings/${username}/`;
    if (navigator.share) {
      try { await navigator.share({ title: `@${username} on CourtConnect`, url }); return; }
      catch { /* user cancelled or not supported */ }
    }
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { /* ignore */ }
  };

  if (player === null) {
    return <div className="max-w-md mx-auto px-4 py-20 flex justify-center"><Loader2 className="animate-spin text-slate-500" size={24}/></div>;
  }

  const backLink = (
    <Link href="/rankings/" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200 transition-colors">
      <ArrowLeft size={15}/> Rankings
    </Link>
  );

  if (player === 'not-found') {
    return (
      <div className="max-w-md mx-auto px-4 py-8 space-y-6">
        {backLink}
        <p className="text-sm text-slate-500 bg-slate-900 border border-slate-800 rounded-2xl px-4 py-6 text-center">
          No public player found for &ldquo;@{username}&rdquo;.
        </p>
      </div>
    );
  }

  const wr = player.totalMatches > 0 ? Math.round((player.wins / player.totalMatches) * 100) : 0;

  return (
    <div className="max-w-md mx-auto px-4 py-8 space-y-6">
      {backLink}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-3">
        <Avatar name={player.displayName} photoURL={player.photoURL} size="lg" className="mx-auto ring-4 ring-emerald-500/20"/>
        <div>
          <p className="font-bold text-xl">{player.displayName}</p>
          <p className="text-slate-500 text-sm">@{player.username}</p>
        </div>
        <div className="flex items-center justify-center gap-2">
          <TierBadge tier={player.tier} placementMatchesPlayed={player.placementMatchesPlayed}/>
          <span className="font-black tabular-nums text-sm text-slate-300">{player.mmr} MMR</span>
        </div>
        {player.state && (
          <p className="text-slate-500 text-xs flex items-center justify-center gap-1">
            <MapPin size={11}/> {player.state}{player.country ? `, ${player.country}` : ''}
          </p>
        )}
        {player.bio && <p className="text-slate-400 text-sm pt-1">{player.bio}</p>}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label: 'Wins', val: player.wins, color: 'text-emerald-400' },
          { label: 'Losses', val: player.losses, color: 'text-red-400' },
          { label: 'Win Rate', val: `${wr}%`, color: '' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-2xl py-3">
            <p className={`font-black text-lg tabular-nums ${s.color}`}>{s.val}</p>
            <p className="text-slate-500 text-[10px] uppercase tracking-wide">{s.label}</p>
          </div>
        ))}
      </div>

      <Button onClick={handleShare} variant="secondary" className="w-full">
        {copied ? <><Check size={15}/> Link copied!</> : <><Share2 size={15}/> Share this profile</>}
      </Button>

      <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-4 text-center">
        <p className="text-sm font-semibold text-emerald-300">Want your own rating on this board?</p>
        <button onClick={() => openAuth('signup')}
          className="mt-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl transition-colors">
          Sign up free
        </button>
      </div>
    </div>
  );
}
