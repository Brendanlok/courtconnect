import type { Tier } from '@/types';
import { TIER_STYLE } from '@/lib/utils';

export function TierBadge({ tier, className = '' }: { tier: Tier; className?: string }) {
  const s = TIER_STYLE[tier];
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${s.bg} ${s.text} ${s.border} ${className}`}>
      {s.icon} {tier}
    </span>
  );
}
