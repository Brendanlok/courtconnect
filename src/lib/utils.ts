import type { Tier } from '@/types';

export function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ');
}

export function getTier(mmr: number): Tier {
  if (mmr < 800)  return 'Beginner';
  if (mmr < 1000) return 'Bronze';
  if (mmr < 1300) return 'Silver';
  if (mmr < 1600) return 'Gold';
  if (mmr < 2000) return 'Platinum';
  if (mmr < 2400) return 'Diamond';
  return 'Elite';
}

const TIER_THRESHOLDS: Record<Tier, [number, number]> = {
  Beginner: [0,    800],
  Bronze:   [800,  1000],
  Silver:   [1000, 1300],
  Gold:     [1300, 1600],
  Platinum: [1600, 2000],
  Diamond:  [2000, 2400],
  Elite:    [2400, 3000],
};

export function tierProgress(mmr: number, tier: Tier): number {
  const [lo, hi] = TIER_THRESHOLDS[tier];
  return Math.min(100, Math.round(((mmr - lo) / (hi - lo)) * 100));
}

export function nextTier(tier: Tier): { name: Tier | null; threshold: number } {
  const order: Tier[] = ['Beginner','Bronze','Silver','Gold','Platinum','Diamond','Elite'];
  const idx = order.indexOf(tier);
  const next = order[idx + 1] ?? null;
  return { name: next, threshold: next ? TIER_THRESHOLDS[next][0] : TIER_THRESHOLDS['Elite'][1] };
}

export const TIER_STYLE: Record<Tier, { bg: string; text: string; border: string; icon: string }> = {
  Beginner: { bg:'bg-slate-500/20',   text:'text-slate-400',   border:'border-slate-500/40',   icon:'○' },
  Bronze:   { bg:'bg-amber-900/20',   text:'text-amber-500',   border:'border-amber-700/40',   icon:'◉' },
  Silver:   { bg:'bg-slate-400/20',   text:'text-slate-300',   border:'border-slate-400/40',   icon:'◈' },
  Gold:     { bg:'bg-yellow-500/20',  text:'text-yellow-400',  border:'border-yellow-500/40',  icon:'◆' },
  Platinum: { bg:'bg-cyan-600/20',    text:'text-cyan-400',    border:'border-cyan-600/40',    icon:'◆' },
  Diamond:  { bg:'bg-violet-600/20',  text:'text-violet-400',  border:'border-violet-600/40',  icon:'◈' },
  Elite:    { bg:'bg-red-600/20',     text:'text-red-400',     border:'border-red-600/40',     icon:'★' },
};

export function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 0) {
    const f = -diff;
    if (f < 3600000)  return `in ${Math.floor(f/60000)}m`;
    if (f < 86400000) return `in ${Math.floor(f/3600000)}h`;
    return `in ${Math.floor(f/86400000)}d`;
  }
  if (diff < 60000)    return 'just now';
  if (diff < 3600000)  return `${Math.floor(diff/60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
  return `${Math.floor(diff/86400000)}d ago`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-MY', { day:'numeric', month:'short', year:'numeric' });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-MY', { hour:'2-digit', minute:'2-digit' });
}

export function calcMMRChange(winnerMMR: number, loserMMR: number, k = 32) {
  const exp = 1 / (1 + Math.pow(10, (loserMMR - winnerMMR) / 400));
  const delta = Math.round(k * (1 - exp));
  return { gain: delta, loss: -delta };
}

export function skillMatch(a: number, b: number) {
  return Math.max(0, Math.round(100 - (Math.abs(a - b) / 600) * 100));
}

export const MATCH_TYPE_LABEL: Record<string, string> = {
  MS: "Men's Singles", WS: "Women's Singles",
  MD: "Men's Doubles", WD: "Women's Doubles", MX: "Mixed Doubles",
};

export const MY_STATES = [
  'Kuala Lumpur','Selangor','Penang','Johor','Perak',
  'Kedah','Kelantan','Terengganu','Pahang','Negeri Sembilan',
  'Melaka','Perlis','Sabah','Sarawak','Putrajaya','Labuan',
];
