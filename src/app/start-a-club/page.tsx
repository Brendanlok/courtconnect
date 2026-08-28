'use client';
// Public info page for CourtConnect's club features (DUPR's "Start a Club"
// nav item). No club data is exposed here — clubs table isn't anon-readable
// (see lib/publicData.ts header) — this is purely explainer copy + a
// sign-up CTA, describing features that already exist in the app.
import { Trophy, Swords, Shield, UserPlus } from 'lucide-react';
import { usePublicAuth } from '@/context/PublicAuthContext';
import { useAuth } from '@/context/AuthContext';
import { BASE_PATH } from '@/lib/utils';

const FEATURES = [
  { icon: UserPlus, title: 'Members join with a request', desc: 'Anyone can request to join your club; you approve who gets in.' },
  { icon: Trophy,    title: 'A club ladder, automatically', desc: 'Every confirmed match between two club members feeds a standing ladder — no manual tracking.' },
  { icon: Swords,    title: 'Rivalries between clubs', desc: 'Track head-to-head records against other clubs your members have played.' },
  { icon: Shield,    title: 'Admins and moderators', desc: 'Hand off day-to-day approvals to moderators without giving up ownership.' },
];

export default function StartAClub() {
  const openAuth = usePublicAuth();
  const { authUser } = useAuth();
  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Start a Club</h1>
        <p className="text-sm text-slate-400 mt-2 leading-relaxed">
          Running a badminton club or a regular group session? Create a club on CourtConnect
          to bring your members onto one board — a shared ladder, club-vs-club rivalries, and a
          single place to see who's actually playing.
        </p>
      </div>

      <div className="space-y-3">
        {FEATURES.map(f => (
          <div key={f.title} className="flex gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <f.icon className="text-emerald-400 shrink-0 mt-0.5" size={18}/>
            <div>
              <p className="font-semibold text-sm">{f.title}</p>
              <p className="text-sm text-slate-400 mt-0.5">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-4 text-center">
        {authUser ? (
          <>
            <p className="text-sm font-semibold text-emerald-300">You&apos;re signed in — create a club from the Clubs tab.</p>
            <a href={`${BASE_PATH}/clubs/`}
              className="inline-block mt-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl transition-colors">
              Go to Clubs
            </a>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-emerald-300">Free to create — sign up, then create a club from Clubs.</p>
            <button onClick={() => openAuth('signup')}
              className="mt-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl transition-colors">
              Sign up free
            </button>
          </>
        )}
      </div>
    </div>
  );
}
