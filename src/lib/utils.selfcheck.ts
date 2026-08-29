// Offline proof of MMR math. Run with: npx tsx src/lib/utils.selfcheck.ts
import assert from 'node:assert';

// localStorage/window shim so the pending-signup helpers run under Node.
const store = new Map<string, string>();
(globalThis as Record<string, unknown>).window = {};
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

import { calcMMRChange, previewMMRChange, marginMultiplier, savePendingSignup, peekPendingSignup, sharedAvailabilitySlots } from './utils';

// 1. calcMMRChange is zero-sum for the actual outcome it's given: the
//    winner's gain and loser's loss are always equal magnitude.
{
  const { gain, loss } = calcMMRChange(1500, 1400, 32);
  assert.strictEqual(gain, -loss);
}
console.log('PASS calcMMRChange is zero-sum for a given actual outcome');

// 2. An underdog who loses as expected should barely lose anything — not get
//    charged a near-max penalty (regression: Log a Match used to always pass
//    "my side" as calcMMRChange's winnerMMR arg, which silently swapped this).
{
  const { loss } = calcMMRChange(2000, 1000, 32); // actual winner=2000, loser=1000
  assert.ok(Math.abs(loss) <= 1, `expected underdog's loss ~0, got ${loss}`);
}
console.log('PASS a huge underdog losing as expected loses almost nothing');

// 3. A favorite who suffers an upset loss should take close to the full K
//    penalty — not get off almost free.
{
  const { loss } = calcMMRChange(1000, 2000, 32); // actual winner=1000 (underdog won)
  assert.ok(Math.abs(loss) >= 28, `expected favorite's upset loss near-max K, got ${loss}`);
}
console.log('PASS a favorite upset loses close to the full K penalty');

// 4. previewMMRChange (outcome not yet known, e.g. Log a Match's "Win: +X /
//    Loss: -Y" preview) must give each side of that same asymmetry correctly,
//    for both the underdog's and the favorite's own perspective.
{
  const underdog = previewMMRChange(1000, 2000, 32); // I'm the underdog
  assert.ok(underdog.gain >= 28, `underdog's win should gain close to full K, got ${underdog.gain}`);
  assert.ok(Math.abs(underdog.loss) <= 1, `underdog's expected loss should be ~0, got ${underdog.loss}`);

  const favorite = previewMMRChange(2000, 1000, 32); // I'm the favorite
  assert.ok(favorite.gain <= 1, `favorite's expected win should gain ~0, got ${favorite.gain}`);
  assert.ok(Math.abs(favorite.loss) >= 28, `favorite's upset loss should be near-max K, got ${favorite.loss}`);
}
console.log('PASS previewMMRChange gives each side its own correct gain/loss before the outcome is known');

// 5. marginMultiplier: a razor-close match sits near the floor, a blowout
//    sweep tops out at the cap — and it's clamped both ends so one lopsided
//    game can't swing MMR further than a big rating gap already allows.
{
  const close = marginMultiplier([{ p1: 21, p2: 19 }, { p1: 19, p2: 21 }, { p1: 21, p2: 19 }]);
  assert.ok(close >= 0.85 && close <= 1.0, `expected close match near floor, got ${close}`);

  const blowout = marginMultiplier([{ p1: 30, p2: 0 }, { p1: 30, p2: 0 }]);
  assert.strictEqual(blowout, 1.3, `expected blowout capped at 1.3x, got ${blowout}`);

  const dominant = calcMMRChange(1500, 1500, 32, marginMultiplier([{ p1: 21, p2: 5 }, { p1: 21, p2: 8 }]));
  const narrow   = calcMMRChange(1500, 1500, 32, marginMultiplier([{ p1: 22, p2: 20 }, { p1: 22, p2: 20 }]));
  assert.ok(dominant.gain > narrow.gain, 'a dominant win should gain more MMR than a narrow one at equal MMR');
}
console.log('PASS marginMultiplier scales MMR by how lopsided the score was, capped both ends');

// 6. Pending signup survives a fresh round-trip but a stale blob is dropped,
//    so the next account created on a shared browser can't inherit it.
{
  const quiz = { username: 'aaa', displayName: 'A', country: 'Malaysia', region: 'Selangor', availability: '', homeVenue: '' };
  savePendingSignup(quiz);
  assert.strictEqual(peekPendingSignup()?.username, 'aaa', 'fresh pending signup should be readable');

  const raw = JSON.parse(store.get('cc_pending_signup')!);
  raw.savedAt = Date.now() - 2 * 60 * 60 * 1000; // 2h ago
  store.set('cc_pending_signup', JSON.stringify(raw));
  assert.strictEqual(peekPendingSignup(), null, 'stale pending signup should be ignored');
  assert.ok(!store.has('cc_pending_signup'), 'stale pending signup should be cleared on read');
}
console.log('PASS pending signup expires so a shared browser cannot leak a stranger\'s quiz');

// 7. sharedAvailabilitySlots counts only cells both sides ticked; 0 when
//    either grid is empty/unset, and whitespace in the stored string is tolerated.
{
  assert.strictEqual(sharedAvailabilitySlots('mon_6_9pm,wed_6_9pm,sat_9am_12pm', 'wed_6_9pm, sat_9am_12pm ,sun_3_6pm'), 2);
  assert.strictEqual(sharedAvailabilitySlots('mon_6_9pm', 'tue_6_9pm'), 0);
  assert.strictEqual(sharedAvailabilitySlots('', 'mon_6_9pm'), 0);
  assert.strictEqual(sharedAvailabilitySlots(undefined, undefined), 0);
}
console.log('PASS sharedAvailabilitySlots counts the weekly slots two players both marked free');

console.log('ALL PASS utils (MMR)');
