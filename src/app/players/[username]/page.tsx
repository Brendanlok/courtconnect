import { ME, PLAYERS } from '@/lib/data';
import { PlayerProfileClient } from './PlayerProfileClient';

export function generateStaticParams() {
  return [ME, ...PLAYERS].map(p => ({ username: p.username }));
}

export default async function PlayerProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  return <PlayerProfileClient username={username} />;
}
