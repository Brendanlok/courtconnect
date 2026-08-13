import { supabase } from '@/lib/supabase';
import { PlayerProfileClient } from './PlayerProfileClient';

// Public profile pages, unlike /players/[username]/ (which only pre-renders
// the demo roster), are enumerated from the real anon-readable users_public
// view at build time — same non-dummy/non-private filter as the Rankings
// page itself. A brand-new player's page 404s until the next deploy
// (GitHub Actions rebuilds on every push to main), not instantly — the
// Rankings search box already covers the "look someone up right now" case
// in the meantime.
export async function generateStaticParams() {
  const { data } = await supabase
    .from('users_public')
    .select('username')
    .or('is_dummy.is.null,is_dummy.eq.false')
    .or('is_private.is.null,is_private.eq.false')
    .limit(5000); // ponytail: flat cap, raise if the player base ever gets close to it
  return (data ?? []).map(row => ({ username: row.username as string }));
}

export default async function PublicPlayerProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return <PlayerProfileClient username={username} />;
}
