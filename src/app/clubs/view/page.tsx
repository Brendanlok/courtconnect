'use client';
import { useState, useEffect } from 'react';
import { ClubDetailClient } from '@/app/clubs/[id]/ClubDetailClient';

// A static, param-less "club" view. /clubs/[id]/ only pre-renders the demo
// roster's club ids (output: 'export' has no server to fall back to for
// unknown paths), so a real (user-created) club 404s there. This route
// sidesteps that — reads ?id= client-side, same convention as /profile/.
export default function ClubViewPage() {
  const [clubId, setClubId] = useState<string | null>(null);

  useEffect(() => {
    setClubId(new URLSearchParams(window.location.search).get('id'));
  }, []);

  if (!clubId) return null;
  return <ClubDetailClient clubId={clubId} />;
}
