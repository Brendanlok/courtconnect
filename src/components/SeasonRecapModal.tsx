'use client';
import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { useModalA11y } from '@/hooks/useModalA11y';
import { Button } from '@/components/ui/Button';
import { X, Trophy, Loader2, Share2 } from 'lucide-react';
import { TIER_STYLE } from '@/lib/utils';
import { seasonStartDate, seasonEndDate } from '@/lib/seasons';
import { generateSeasonRecapBlob } from '@/lib/seasonRecapImage';
import { shareOrDownloadRecap } from '@/lib/matchRecapImage';

// Shown once, right after AppContext's season-rollover effect closes out a
// season for this account. Win/loss for the closed season is derived from
// matches whose playedAt falls in that season's date range — nothing about
// the record itself is stored, only the final mmr/tier snapshot (see
// season_history in supabase/migrations/0014_ranked_seasons.sql).
export function SeasonRecapModal() {
  const { user, seasonRecap, dismissSeasonRecap, matches } = useApp();
  const { ref: panelRef, dialogProps } = useModalA11y(!!seasonRecap, dismissSeasonRecap, 'Season Recap');
  const [sharing, setSharing] = useState(false);
  if (!seasonRecap) return null;

  const start = seasonStartDate(seasonRecap.seasonNumber).getTime();
  const end = seasonEndDate(seasonRecap.seasonNumber).getTime();
  const seasonMatches = matches.filter(m => {
    if (m.status !== 'Confirmed' || m.mode === 'casual') return false;
    const t = new Date(m.playedAt).getTime();
    return t >= start && t < end;
  });
  const wins = seasonMatches.filter(m => m.winnerId === 'me').length;
  const losses = seasonMatches.length - wins;
  const style = TIER_STYLE[seasonRecap.tierEnd];

  const handleShare = async () => {
    setSharing(true);
    try {
      const blob = await generateSeasonRecapBlob({
        displayName: user.displayName,
        seasonNumber: seasonRecap.seasonNumber,
        tierEnd: seasonRecap.tierEnd,
        mmrEnd: seasonRecap.mmrEnd,
        wins, losses,
      });
      await shareOrDownloadRecap(blob, `courtconnect-season-${seasonRecap.seasonNumber}.png`);
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="modal-backdrop fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4" onClick={dismissSeasonRecap}>
      <div ref={panelRef} {...dialogProps}
        className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl outline-none overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <p className="text-sm font-semibold">Season {seasonRecap.seasonNumber} Complete</p>
          <button onClick={dismissSeasonRecap} className="text-slate-500 hover:text-white transition-colors">
            <X size={18}/>
          </button>
        </div>

        <div className="p-6 text-center space-y-4">
          <Trophy size={40} className="mx-auto text-amber-400"/>
          <div>
            <p className={`text-3xl font-black ${style.text}`}>{seasonRecap.tierEnd}</p>
            <p className="text-sm text-slate-400 mt-1">{seasonRecap.mmrEnd} MMR</p>
          </div>
          <p className="text-sm text-slate-300">
            {seasonMatches.length > 0
              ? <>Finished <span className="text-emerald-400 font-bold">{wins}W</span> – <span className="text-red-400 font-bold">{losses}L</span> this season</>
              : 'No ranked matches played this season'}
          </p>
          <p className="text-xs text-slate-500">
            A new season has started — your rating softened back toward the middle so there's room to climb again.
          </p>
        </div>

        <div className="p-5 pt-0 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={dismissSeasonRecap}>Close</Button>
          <Button className="flex-1 flex items-center justify-center gap-2" onClick={handleShare} disabled={sharing}>
            {sharing ? <Loader2 size={15} className="animate-spin"/> : <Share2 size={15}/>}
            Share
          </Button>
        </div>
      </div>
    </div>
  );
}
