// Offline proof of MMR math. Run with: npx tsx src/lib/utils.selfcheck.ts
import assert from 'node:assert';
import { calcMMRChange, previewMMRChange } from './utils';

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

console.log('ALL PASS utils (MMR)');
