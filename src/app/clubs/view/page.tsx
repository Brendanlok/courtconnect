'use client';
import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { ClubDetailClient } from '@/app/clubs/[id]/ClubDetailClient';

// A static, param-less "club" view. /clubs/[id]/ only pre-renders the demo
// roster's club ids (output: 'export' has no server to fall back to for
// unknown paths), so a real (user-created) club 404s there. This route
// sidesteps that — reads ?id= client-side, same convention as /profile/.
export default function ClubViewPage() {
  const { clubs } = useApp();
  const [clubId, setClubId] = useState<string | null>(null);

  useEffect(() => {
    setClubId(new URLSearchParams(window.location.search).get('id'));
  }, []);

  if (!clubId) return null;
  // clubs starts as demo-only seed data and fills in real clubs a moment
  // later via an async Supabase subscription — render ClubDetailClient (which
  // 404s on an unknown id) only once the target club has actually arrived,
  // so a fresh load of a real club's link doesn't flash "not found" before
  // its data streams in.
  // ponytail: no distinct "genuinely doesn't exist" state — a bad/stale id
  // just spins forever instead of 404ing. Add a timeout if that's reported.
  if (!clubs.some(c => c.id === clubId)) {
    return <p className="text-center text-slate-500 py-16 text-sm">Loading…</p>;
  }
  return <ClubDetailClient clubId={clubId} />;
}
