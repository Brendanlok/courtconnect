'use client';
// Logged-out landing page at "/" — replaces what used to be a bare login
// form with an actual marketing page (hero, features, live stats teaser,
// rankings preview), DUPR-style. Signed-in visitors never see this; AuthGate
// only renders it when authUser is null.
import { useEffect, useState } from 'react';
import { Trophy, Radio, Users, TrendingUp, MapPin } from 'lucide-react';
import { fetchPublicPlayerCount } from '@/lib/publicData';
import { usePublicAuth } from '@/context/PublicAuthContext';
import { BASE_PATH, TIER_STYLE } from '@/lib/utils';
import { Avatar } from '@/components/ui/Avatar';

const FEATURES = [
  { icon: TrendingUp, title: 'Real MMR ratings', desc: 'An Elo-based rating that actually reflects your level — climb it match by match.' },
  { icon: Radio,       title: 'Live match recording', desc: 'Score live courtside, auto-detect shuttle hits, and get a verified-play bonus.' },
  { icon: Trophy,      title: 'Tournaments & clubs',   desc: 'Join brackets, track club ladders, and build rivalries with players nearby.' },
  { icon: Users,       title: 'Find real opponents',   desc: 'Search players and clubs near you by state, tier, and availability.' },
];

export function MarketingHome() {
  const openAuth = usePublicAuth();
  const [playerCount, setPlayerCount] = useState<number | null>(null);
  useEffect(() => { fetchPublicPlayerCount().then(setPlayerCount); }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6">
      {/* Hero */}
      <section className="py-14 md:py-20 text-center">
        <h1 className="text-4xl md:text-6xl font-black tracking-tight">
          Know your real <span className="text-emerald-400">badminton rating</span>.
        </h1>
        <p className="mt-4 text-slate-400 text-base md:text-lg max-w-xl mx-auto">
          CourtConnect tracks MMR, verifies live matches, and ranks players across Malaysia —
          free, and built for players who actually keep score.
        </p>
        <div className="mt-7 flex items-center justify-center gap-3">
          <button onClick={() => openAuth('signup')}
            className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl transition-colors">
            Get your rating — it&apos;s free
          </button>
          <a href={`${BASE_PATH}/rankings/`}
            className="px-6 py-3 border border-slate-700 hover:border-slate-500 font-semibold rounded-xl transition-colors">
            See Rankings
          </a>
        </div>
        {playerCount !== null && playerCount > 0 && (
          <p className="mt-5 text-xs text-slate-500 flex items-center justify-center gap-1.5">
            <MapPin size={12}/> {playerCount.toLocaleString()} ranked players and counting
          </p>
        )}
      </section>

      {/* Product teaser — a real UI card (Avatar/TierBadge, same components
          the app itself uses), not a stock photo or a fabricated screenshot
          of a real account. Clearly a sample, not a real player. */}
      <section className="pb-14 flex justify-center">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 w-full max-w-sm">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-3">Sample player card</p>
          <div className="flex items-center gap-3">
            <Avatar name="Sample Player" size="lg" />
            <div className="flex-1 min-w-0">
              <p className="font-bold truncate">Sample Player</p>
              <p className="text-xs text-slate-500">@sampleplayer · Selangor</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-2xl font-black tabular-nums">1584</p>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${TIER_STYLE.Platinum.bg} ${TIER_STYLE.Platinum.text}`}>
                {TIER_STYLE.Platinum.icon} Platinum
              </span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-800 text-center">
            <div><p className="font-bold text-sm">42</p><p className="text-[10px] text-slate-500">Wins</p></div>
            <div><p className="font-bold text-sm">61%</p><p className="text-[10px] text-slate-500">Win Rate</p></div>
            <div><p className="font-bold text-sm">#128</p><p className="text-[10px] text-slate-500">Nat. Rank</p></div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-14">
        {FEATURES.map(f => (
          <div key={f.title} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <f.icon className="text-emerald-400" size={22}/>
            <p className="mt-3 font-bold">{f.title}</p>
            <p className="mt-1 text-sm text-slate-400">{f.desc}</p>
          </div>
        ))}
      </section>

      {/* How ratings work teaser */}
      <section className="pb-16 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 md:p-8 text-center">
        <p className="font-bold text-lg">Curious how the rating actually works?</p>
        <p className="mt-1 text-sm text-slate-400">Elo-based, transparent, and explained in plain English — no black box.</p>
        <a href={`${BASE_PATH}/how-it-works/`}
          className="mt-4 inline-block px-5 py-2.5 border border-slate-700 hover:border-slate-500 font-semibold text-sm rounded-xl transition-colors">
          How Ratings Work
        </a>
      </section>
    </div>
  );
}
