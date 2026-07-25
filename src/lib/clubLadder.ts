// Club ladder: a club-internal win/loss record, computed purely from
// existing confirmed singles matches between two club members — no new
// ranking system, just an aggregation over data that already exists.
export interface LadderEntry {
  uid: string; // whatever id convention the caller's toLocalId resolves to
  wins: number;
  losses: number;
  played: number;
}

interface LadderMatch {
  player1Id: string;
  player2Id: string;
  winnerId: string;
}

export function computeLadder(matches: LadderMatch[], toLocalId: (realUid: string) => string): LadderEntry[] {
  const table = new Map<string, LadderEntry>();
  const bump = (uid: string, won: boolean) => {
    const e = table.get(uid) ?? { uid, wins: 0, losses: 0, played: 0 };
    e.played += 1;
    if (won) e.wins += 1; else e.losses += 1;
    table.set(uid, e);
  };
  for (const m of matches) {
    const a = toLocalId(m.player1Id);
    const b = toLocalId(m.player2Id);
    const winner = toLocalId(m.winnerId);
    bump(a, winner === a);
    bump(b, winner === b);
  }
  return [...table.values()].sort((x, y) => (y.wins / y.played) - (x.wins / x.played) || y.wins - x.wins);
}
