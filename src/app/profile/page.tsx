'use client';
import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { PlayerProfileClient } from '@/app/players/[username]/PlayerProfileClient';
import { PlayerActionCard } from '@/components/PlayerActionCard';
import { lookupUserByUid } from '@/lib/supabaseService';
import { getTier } from '@/lib/utils';
import { auth } from '@/lib/supabase';
import type { UserProfile } from '@/types';

// A static, single-path "profile" view. /players/[username]/ only
// pre-renders the demo roster's usernames (output: 'export' has no server to
// fall back to for unknown paths), so a real signed-in user's own username —
// or any other real account's — 404s there. This route sidesteps that:
// no ?uid= means "show whoever is currently signed in" (needs no per-user
// static params); ?uid=X shows that specific real account instead, e.g. from
// a scanned QR code or a shared chat link.
export default function ProfilePage() {
  const { user } = useApp();
  const [otherUid, setOtherUid] = useState<string | null>(null);
  const [other, setOther] = useState<UserProfile | null>(null);
  const [notFoundOther, setNotFoundOther] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const uid = new URLSearchParams(window.location.search).get('uid');
    if (!uid || uid === auth.currentUser?.uid) return;
    setOtherUid(uid);
    lookupUserByUid(uid).then(data => {
      if (!data) { setNotFoundOther(true); return; }
      setOther({
        uid, username: data.username ?? uid, displayName: data.displayName ?? 'Player',
        email: '', mmr: data.mmr ?? 1200, tier: getTier(data.mmr ?? 1200),
        globalRank: 0, state: 'Kuala Lumpur', area: '',
        stats: data.stats ?? { wins: 0, losses: 0, totalMatches: 0 }, joinedAt: '',
        photoURL: data.photoURL ?? null,
      });
    }).catch(() => setNotFoundOther(true));
  }, []);

  if (otherUid) {
    // Viewing someone else's real account — there's no remote match-history
    // fetch wired up yet (see PlayerActionCard), so this shows the same
    // compact card as Find-a-Player rather than a full stats page.
    if (notFoundOther) return <p className="text-center text-slate-500 py-16 text-sm">Player not found.</p>;
    if (!other) return <p className="text-center text-slate-500 py-16 text-sm">Loading…</p>;
    return <div className="max-w-md mx-auto"><PlayerActionCard player={other}/></div>;
  }

  return <PlayerProfileClient username={user.username} forceIsMe />;
}
