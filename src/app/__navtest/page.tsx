'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ExitGuard } from '@/components/ExitGuard';

const TABS = ['/__navtest', '/__navtest/matches', '/__navtest/players'];

export default function NavTest() {
  const path = usePathname();
  return (
    <div style={{ padding: 20, fontFamily: 'monospace' }}>
      <h1>NAV TEST — {path}</h1>
      <p id="hlen">history.length: {typeof window !== 'undefined' ? window.history.length : '?'}</p>
      <nav style={{ display: 'flex', gap: 8 }}>
        {TABS.map(t => <Link key={t} href={t} replace style={{ border: '1px solid #888', padding: 8 }}>{t}</Link>)}
      </nav>
      <p><Link href="/__navtest/drill" style={{ border: '1px solid #0a0', padding: 8 }}>drill down (push)</Link></p>
      <ExitGuard />
    </div>
  );
}
