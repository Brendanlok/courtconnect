// Offline proof of ToastStack's queue logic. Run with: npx tsx src/lib/toastQueue.selfcheck.ts
import assert from 'node:assert';
import { pickFreshToasts, enqueueToasts } from './toastQueue';

const ALLOWED = new Set(['friend_request', 'challenge_received']);

// 1. Already-seen ids are never re-toasted, even if their type is allowed.
{
  const notifs = [{ id: 'a', type: 'friend_request' }, { id: 'b', type: 'friend_request' }];
  const fresh = pickFreshToasts(notifs, new Set(['a']), ALLOWED);
  assert.deepStrictEqual(fresh.map(n => n.id), ['b']);
}
console.log('PASS pickFreshToasts skips already-seen ids');

// 2. Types outside the allowlist (e.g. new_message spam) never toast even if unseen.
{
  const notifs = [{ id: 'a', type: 'new_message' }, { id: 'b', type: 'challenge_received' }];
  const fresh = pickFreshToasts(notifs, new Set(), ALLOWED);
  assert.deepStrictEqual(fresh.map(n => n.id), ['b']);
}
console.log('PASS pickFreshToasts filters out disallowed types');

// 3. enqueueToasts puts new arrivals at the front (most recent first).
{
  const current = [{ id: 'old', type: 'friend_request' }];
  const fresh = [{ id: 'new', type: 'friend_request' }];
  assert.deepStrictEqual(enqueueToasts(current, fresh, 3).map(n => n.id), ['new', 'old']);
}
console.log('PASS enqueueToasts prepends fresh arrivals');

// 4. enqueueToasts caps the stack so a burst of notifications can't fill the screen.
{
  const current = [{ id: '1', type: 't' }, { id: '2', type: 't' }];
  const fresh = [{ id: '3', type: 't' }, { id: '4', type: 't' }];
  assert.deepStrictEqual(enqueueToasts(current, fresh, 3).map(n => n.id), ['3', '4', '1']);
}
console.log('PASS enqueueToasts caps the visible stack size');

console.log('ALL PASS toastQueue');
