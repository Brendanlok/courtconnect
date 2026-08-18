// Single-elimination bracket generation + result progression. Pure functions
// over the existing flat BracketMatch[] shape (round + player1/player2/winner
// strings) that the seed demo tournaments already used — real tournaments
// never had anything populating this until now.
//
// player1/player2/winner store each participant's *username*, not their
// display name — usernames are guaranteed unique, display names aren't, and
// two participants sharing a display name used to let a bracket result
// silently advance/credit the wrong account. Callers resolve username ->
// display name for rendering (tournament.participants already has both).
import type { BracketMatch } from '@/types';

interface Participant { displayName: string; username: string }

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Random seeding (not MMR-based) — simplest default for a casual/club event,
// and there's no seeding UI to feed a smarter ordering in anyway.
export function generateBracket(participants: Participant[]): BracketMatch[] {
  if (participants.length < 2) return [];
  const shuffled = shuffle(participants);
  const size = 2 ** Math.ceil(Math.log2(shuffled.length));
  const byes = size - shuffled.length;
  // Byes must be spread one-per-pair (never two to a pair) — byes is always
  // < size/2, so giving the first `byes` participants a bye slot each covers
  // every bye without ever pairing null with null.
  const slots: (Participant | null)[] = [];
  for (let i = 0; i < shuffled.length; i++) {
    slots.push(shuffled[i]);
    if (i < byes) slots.push(null); // null = bye
  }

  const round1: BracketMatch[] = [];
  let prevNames: (string | null)[] = [];
  for (let i = 0; i < slots.length; i += 2) {
    const p1 = slots[i], p2 = slots[i + 1];
    const id = `b1_${i / 2}`;
    if (!p1 || !p2) {
      // Bye — the real side auto-advances, no live match to play.
      const winnerUsername = (p1 ?? p2)!.username;
      round1.push({ id, round: 1, player1: p1?.username ?? 'BYE', player2: p2?.username ?? 'BYE', winner: winnerUsername, score: undefined });
      prevNames.push(winnerUsername);
    } else {
      round1.push({ id, round: 1, player1: p1.username, player2: p2.username, winner: undefined, score: undefined });
      prevNames.push(null);
    }
  }

  const rounds: BracketMatch[][] = [round1];
  let roundNum = 2;
  while (prevNames.length > 1) {
    const thisRound: BracketMatch[] = [];
    const thisNames: (string | null)[] = [];
    for (let i = 0; i < prevNames.length; i += 2) {
      thisRound.push({
        id: `b${roundNum}_${i / 2}`, round: roundNum,
        player1: prevNames[i] ?? 'TBD', player2: prevNames[i + 1] ?? 'TBD',
        winner: undefined, score: undefined,
      });
      thisNames.push(null);
    }
    rounds.push(thisRound);
    prevNames = thisNames;
    roundNum++;
  }

  return rounds.flat();
}

// Records a live match's result and propagates the winner's username into
// the correct slot of the next round (index/2 within the round, same
// pairing convention generateBracket lays out). Returns the whole updated
// bracket.
export function reportBracketResult(bracket: BracketMatch[], matchId: string, winnerUsername: string, score?: string): BracketMatch[] {
  const match = bracket.find(b => b.id === matchId);
  if (!match) return bracket;
  const updated = bracket.map(b => b.id === matchId ? { ...b, winner: winnerUsername, score } : b);

  const roundMatches = updated.filter(b => b.round === match.round);
  const posInRound = roundMatches.findIndex(b => b.id === matchId);
  const nextMatch = updated.filter(b => b.round === match.round + 1)[Math.floor(posInRound / 2)];
  if (!nextMatch) return updated; // that was the final

  const isFirstSlot = posInRound % 2 === 0;
  return updated.map(b => b.id === nextMatch.id ? { ...b, [isFirstSlot ? 'player1' : 'player2']: winnerUsername } : b);
}

// Reverts a reported result — host misclick recovery (no undo existed
// before). Returns null (blocked, caller should no-op) rather than throwing:
// a bye match auto-advanced itself and was never "reported", and a match
// whose winner has already been reported further down the bracket can't be
// safely undone without cascading — host must undo that later match first.
export function undoBracketResult(bracket: BracketMatch[], matchId: string): BracketMatch[] | null {
  const match = bracket.find(b => b.id === matchId);
  if (!match?.winner || match.player1 === 'BYE' || match.player2 === 'BYE') return null;

  const roundMatches = bracket.filter(b => b.round === match.round);
  const posInRound = roundMatches.findIndex(b => b.id === matchId);
  const nextMatch = bracket.filter(b => b.round === match.round + 1)[Math.floor(posInRound / 2)];
  if (nextMatch?.winner) return null;

  const cleared = bracket.map(b => b.id === matchId ? { ...b, winner: undefined, score: undefined } : b);
  if (!nextMatch) return cleared;
  const isFirstSlot = posInRound % 2 === 0;
  return cleared.map(b => b.id === nextMatch.id ? { ...b, [isFirstSlot ? 'player1' : 'player2']: 'TBD' } : b);
}

// Returns the champion's username (not display name) - resolve to a
// display name via tournament.participants at render/notify time.
export function bracketChampion(bracket: BracketMatch[]): string | null {
  if (bracket.length === 0) return null;
  const maxRound = Math.max(...bracket.map(b => b.round));
  return bracket.find(b => b.round === maxRound)?.winner ?? null;
}
