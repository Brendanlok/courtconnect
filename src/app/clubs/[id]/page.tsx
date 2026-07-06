import { CLUBS } from '@/lib/data';
import { ClubDetailClient } from './ClubDetailClient';

export function generateStaticParams() {
  return CLUBS.map(c => ({ id: c.id }));
}

export default async function ClubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClubDetailClient clubId={id} />;
}
