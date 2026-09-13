import type { Tier } from '@/types';
import { TIER_STYLE } from '@/lib/utils';

interface Props {
  tier: Tier;
  className?: string;
  placementMatchesPlayed?: number | null;
  recalibrationMatchesPlayed?: number | null;
}

export function TierBadge({ tier, className = '', placementMatchesPlayed, recalibrationMatchesPlayed }: Props) {
  // "Calibrating" covers both a brand-new account's first 10 matches and a
  // returning account re-placed after 90+ days inactive (AppContext resets
  // placementMatchesPlayed to 0 for both cases) — one honest label rather
  // than distinguishing "new" from "returning" for a badge.
  //
  // Must tell "prop not passed" (demo players — never calibrating) apart
  // from "prop passed as null" (a real account Supabase hands back null for
  // an unset column — very much still calibrating). `!= null` can't do that:
  // it's loose equality, so it treats null and undefined as the same thing
  // and both fall through to "not calibrating" — exactly the bug a real
  // account with a null column hits. `!== undefined` distinguishes them.
  const inCalibration   = placementMatchesPlayed !== undefined && (placementMatchesPlayed ?? 0) < 10;
  const inRecalibration = !inCalibration && recalibrationMatchesPlayed != null && recalibrationMatchesPlayed < 5;
  if (inCalibration || inRecalibration) {
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border bg-amber-500/10 text-amber-400 border-amber-500/30 ${className}`}>
        {inCalibration ? `⚡ Calibrating ${placementMatchesPlayed ?? 0}/10` : `⚡ Recalibrating ${recalibrationMatchesPlayed}/5`}
      </span>
    );
  }
  const s = TIER_STYLE[tier];
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${s.bg} ${s.text} ${s.border} ${className}`}>
      {s.icon} {tier}
    </span>
  );
}
