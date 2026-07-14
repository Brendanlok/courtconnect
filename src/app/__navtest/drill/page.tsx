'use client';

export default function P() {
  return (
    <div style={{ padding: 20, fontFamily: 'monospace' }}>
      <h1>NAV TEST — drill-down page</h1>
      <p>history.length: {typeof window !== 'undefined' ? window.history.length : '?'}</p>
      <p>Press back to return to /__navtest (should be a normal one-step undo, no exit toast).</p>
    </div>
  );
}
