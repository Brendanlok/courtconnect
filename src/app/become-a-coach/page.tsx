'use client';
// Public info page for coaching (DUPR's "Become a Coach"). The actual opt-in
// form lives in Settings (authenticated-only, can't list without an
// account) — this page explains the feature and gets a logged-out visitor
// signed up, same pattern as start-a-club/page.tsx.
import { GraduationCap, MessageCircle, Star, Wallet } from 'lucide-react';
import { usePublicAuth } from '@/context/PublicAuthContext';
import { useAuth } from '@/context/AuthContext';
import { BASE_PATH } from '@/lib/utils';

const POINTS = [
  { icon: Star,          title: 'Free to list', desc: 'No fees to create a coach listing — just your bio, rate, and specialties.' },
  { icon: MessageCircle, title: 'Players message you directly', desc: 'No booking system in the middle — a player reaches out, you work out the details yourselves.' },
  { icon: Wallet,        title: 'You set your own rate', desc: 'List an hourly rate if you want one, or leave it blank and discuss per player.' },
];

export default function BecomeACoach() {
  const openAuth = usePublicAuth();
  const { authUser } = useAuth();
  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><GraduationCap className="text-emerald-400" size={22}/> Become a Coach</h1>
        <p className="text-sm text-slate-400 mt-2 leading-relaxed">
          Coach badminton? List yourself on CourtConnect so players searching for one can find you.
          Listings are self-reported — CourtConnect doesn&apos;t certify or vet coaches, it just helps players find you.
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
        {authUser ? (
          <>
            <p className="text-sm font-semibold text-emerald-300">You&apos;re signed in — turn on your coach listing from Settings &rsaquo; Coaching.</p>
            <a href={`${BASE_PATH}/`}
              className="inline-block mt-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl transition-colors">
              Go to CourtConnect
            </a>
          </>
        ) : (
          <>
            <p className="text-sm font-semibold text-emerald-300">Sign up, then turn on your coach listing from Settings.</p>
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
