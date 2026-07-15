// Offline proof the disputed-match re-submit logic is correct.
// Run with: npx tsx src/lib/matchDispute.selfcheck.ts
import assert from 'node:assert';
import { resubmitWinner, resignedMmrChange, resubmitRecipient } from './matchDispute';

// 1. resubmitWinner picks whoever actually won more games in the corrected score.
{
  assert.strictEqual(resubmitWinner([{ p1: 21, p2: 15 }, { p1: 18, p2: 21 }, { p1: 21, p2: 12 }], 'p1', 'p2'), 'p1');
  assert.strictEqual(resubmitWinner([{ p1: 10, p2: 21 }, { p1: 15, p2: 21 }], 'p1', 'p2'), 'p2');
}
console.log('PASS resubmitWinner picks the side with more games won');

// 2. resignedMmrChange keeps the original magnitude, re-signed for the
// (possibly new) winner relative to the fixed original reporter.
{
  // Reporter (p1) is still the winner after correction -> positive, same magnitude.
  assert.strictEqual(resignedMmrChange(14, 'p1', 'p1'), 14);
  // Winner flipped away from the reporter -> negative, same magnitude.
  assert.strictEqual(resignedMmrChange(14, 'p2', 'p1'), -14);
  // Original mmrChange stored as a negative (reporter had lost) but the
  // magnitude is what matters, not the original sign.
  assert.strictEqual(resignedMmrChange(-9, 'p1', 'p1'), 9);
  assert.strictEqual(resignedMmrChange(-9, 'p2', 'p1'), -9);
  // No original mmrChange recorded -> magnitude 0, always 0 regardless of winner.
  assert.strictEqual(resignedMmrChange(undefined, 'p1', 'p1'), 0);
}
console.log('PASS resignedMmrChange keeps magnitude, re-signs for the corrected winner');

// 3. resubmitRecipient — the bug caught by hand before shipping: it must NOT
// always be player1. First round (player2 disputes and resubmits) sends the
// correction to player1; if player1 then disputes THAT and resubmits their
// own correction, it must go back to player2, not player1 again.
{
  assert.strictEqual(resubmitRecipient('p2', 'p1', 'p2'), 'p1', 'player2 resubmitting should route to player1');
  assert.strictEqual(resubmitRecipient('p1', 'p1', 'p2'), 'p2', 'player1 resubmitting (2nd round) should route to player2, not player1 again');
}
console.log('PASS resubmitRecipient routes to whichever side ISN\'T resubmitting, both rounds');

console.log('\nAll checks passed.');
