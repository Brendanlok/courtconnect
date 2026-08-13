'use client';
// Public + in-app coach directory (DUPR's "Find a Coach"). Reads
// coach_profiles_public (supabase/migrations/0025) — self-reported listings
// only, no certification/verification, said explicitly below rather than
// implied. "Message" deep-links into the existing /chat/?realUid= flow
// (chat/page.tsx already handles opening/creating that conversation) —
// works whether the visitor is logged in or not, since /chat isn't a public
// route: AuthGate's normal login wall kicks in automatically if they aren't.
import { useEffect, useState } from 'react';
import { GraduationCap, MapPin, Loader2, MessageCircle } from 'lucide-react';
import { fetchCoaches, type PublicCoach } from '@/lib/publicData';
import { Avatar } from '@/components/ui/Avatar';
import { BASE_PATH } from '@/lib/utils';
import { useApp } from '@/context/AppContext';

export default function FindACoach() {
  const [coaches, setCoaches] = useState<PublicCoach[] | null>(null);
  useEffect(() => { fetchCoaches().then(setCoaches); }, []);
  // useApp() outside AppProvider (logged-out visitor) returns {} — user is
  // undefined then, so myUid is just undefined and no card matches it.
  const { user } = useApp();
  const myUid = user?.uid;

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><GraduationCap className="text-emerald-400" size={22}/> Find a Coach</h1>
        <p className="text-sm text-slate-400 mt-1">
          Players who&apos;ve listed themselves as coaches. Self-reported — not verified or certified by CourtConnect.
        </p>
      </div>

      {coaches === null ? (
        <div className="flex items-center justify-center py-10 text-slate-500"><Loader2 className="animate-spin" size={20}/></div>
      ) : coaches.length === 0 ? (
        <p className="text-sm text-slate-500 py-6 text-center">No coaches listed yet.</p>
      ) : (
        <div className="space-y-3">
          {coaches.map(c => (
            <div key={c.uid} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <Avatar name={c.displayName} photoURL={c.photoURL} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold">{c.displayName}</p>
                  <p className="text-xs text-slate-500">@{c.username}{c.state ? ` · ${c.state}` : ''}{c.yearsExperience ? ` · ${c.yearsExperience}y experience` : ''}</p>
                </div>
                {c.hourlyRate != null && (
                  <span className="text-sm font-bold text-amber-400 shrink-0">{c.currency}{c.hourlyRate}/hr</span>
                )}
              </div>
              {c.bio && <p className="text-sm text-slate-400 mt-3 line-clamp-4 break-words">{c.bio}</p>}
              {c.specialties.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {c.specialties.map(s => (
                    <span key={s} className="text-[10px] font-semibold px-2 py-0.5 bg-slate-800 text-slate-300 rounded-full">{s}</span>
                  ))}
                </div>
              )}
              {c.areas.length > 0 && (
                <p className="text-xs text-slate-500 mt-2 flex items-center gap-1"><MapPin size={11}/> {c.areas.join(', ')}</p>
              )}
              {c.uid === myUid ? (
                <p className="mt-3 flex items-center justify-center gap-1.5 w-full px-3 py-2 bg-slate-800 text-slate-500 font-bold text-sm rounded-xl">
                  This is you
                </p>
              ) : (
                <a href={`${BASE_PATH}/chat/?realUid=${c.uid}`}
                  className="mt-3 flex items-center justify-center gap-1.5 w-full px-3 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-xl transition-colors">
                  <MessageCircle size={14}/> Message
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-600 text-center">
        Are you a coach? List yourself free from Settings once you&apos;re signed in.
      </p>
    </div>
  );
}
