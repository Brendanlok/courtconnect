'use client';
import { useApp } from '@/context/AppContext';
import { PlayerProfileClient } from '@/app/players/[username]/PlayerProfileClient';

// A static, single-path "my own profile" view. /players/[username]/ only
// pre-renders the demo roster's usernames (output: 'export' has no server to
// fall back to for unknown paths), so a real signed-in user's own username
// 404s there. This route sidesteps that entirely — it's always just "show
// whoever is currently signed in," so it needs no per-user static params.
export default function MyProfilePage() {
  const { user } = useApp();
  return <PlayerProfileClient username={user.username} forceIsMe />;
}
