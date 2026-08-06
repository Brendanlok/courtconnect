import type { Tier } from '@/types';
import { TIER_STYLE } from '@/lib/utils';

interface Props {
  tier: Tier;
  className?: string;
  placementMatchesPlayed?: number;
  recalibrationMatchesPlayed?: number | null;
}

export function TierBadge({ tier, className = '', placementMatchesPlayed, recalibrationMatchesPlayed }: Props) {
  const inPlacement    = placementMatchesPlayed !== undefined && placementMatchesPlayed < 10;
  const inRecalibration = !inPlacement && recalibrationMatchesPlayed != null && recalibrationMatchesPlayed < 5;
  if (inPlacement || inRecalibration) {
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border bg-amber-500/10 text-amber-400 border-amber-500/30 ${className}`}>
        {inPlacement ? `⚡ Placement ${placementMatchesPlayed}/10` : `⚡ Recalibrating ${recalibrationMatchesPlayed}/5`}
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
