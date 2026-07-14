'use client';
import Link from 'next/link';
import { ExitGuard } from '@/components/ExitGuard';

export default function P() {
  return (
    <div style={{ padding: 20, fontFamily: 'monospace' }}>
      <h1>NAV TEST — /matches</h1>
      <p>history.length: {typeof window !== 'undefined' ? window.history.length : '?'}</p>
      <nav style={{ display: 'flex', gap: 8 }}>
        <Link href="/__navtest" replace style={{ border: '1px solid #888', padding: 8 }}>/__navtest</Link>
        <Link href="/__navtest/players" replace style={{ border: '1px solid #888', padding: 8 }}>/__navtest/players</Link>
      </nav>
      <ExitGuard />
    </div>
  );
}
