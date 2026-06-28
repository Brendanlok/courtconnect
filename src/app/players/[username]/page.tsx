import { ME, PLAYERS } from '@/lib/data';
import { PlayerProfileClient } from './PlayerProfileClient';

export function generateStaticParams() {
  return [ME, ...PLAYERS].map(p => ({ username: p.username }));
}

export default function PlayerProfilePage({ params }: { params: { username: string } }) {
  return <PlayerProfileClient username={params.username} />;
}
