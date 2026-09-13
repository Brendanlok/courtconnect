'use client';
// Public "Company"-equivalent page. Deliberately product-focused, not a
// fabricated company history/team bio — there's no real "founded in X by
// team of Y" story to tell here, and inventing one would be misleading.
import { TrendingUp, Radio, Trophy, Users, ShieldCheck } from 'lucide-react';
import { usePublicAuth } from '@/context/PublicAuthContext';

const POINTS = [
  { icon: TrendingUp, title: 'A rating that means something', desc: 'CourtConnect uses an Elo-based MMR — the same foundation as chess and competitive esports — instead of a self-reported "skill level".' },
  { icon: ShieldCheck, title: 'Verified, not self-reported', desc: 'Results need your opponent to confirm before MMR moves. Live-recorded matches carry a verified bonus on top.' },
  { icon: Radio,       title: 'Built for how you actually play', desc: 'Score live courtside, track shuttle-hit detection, and pull up your court heatmap after the match.' },
  { icon: Trophy,      title: 'Tournaments and club ladders', desc: 'Join brackets, track club ladders, and build rivalries with the players you actually see on court.' },
  { icon: Users,       title: 'Find real opponents nearby', desc: 'Search players and clubs by state, tier, and availability — not a random matchmaking queue.' },
];

export default function About() {
  const openAuth = usePublicAuth();
  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">About CourtConnect</h1>
        <p className="text-sm text-slate-400 mt-2 leading-relaxed">
          CourtConnect is a badminton rating and matchmaking platform for players in Malaysia.
          It tracks a real, Elo-based MMR across singles and doubles, verifies results between
          both players before anything counts, and gives players a place to find opponents,
          join tournaments, and track club ladders — all free.
        </p>
      </div>

      <div className="space-y-3">
        {POINTS.map(p => (
          <div key={p.title} className="flex gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <p.icon className="text-emerald-400 shrink-0 mt-0.5" size={18}/>
            <div>
              <p className="font-semibold text-sm">{p.title}</p>
              <p className="text-sm text-slate-400 mt-0.5">{p.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-4 text-center">
        <p className="text-sm font-semibold text-emerald-300">Ready to see your rating?</p>
        <button onClick={() => openAuth('signup')}
          className="mt-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl transition-colors">
          Sign up free
        </button>
      </div>
    </div>
  );
}
