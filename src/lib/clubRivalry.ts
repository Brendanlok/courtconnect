// Club vs club rivalry record: aggregate win/loss between this club's
// members and every other club's members, computed purely from existing
// confirmed singles matches — same "no new ranking system" pattern as the
// club ladder (clubLadder.ts), just grouped by opposing club instead of by
// opposing player.
export interface RivalryEntry {
  clubId: string;
  wins: number;   // this club's wins vs that club
  losses: number;
  played: number;
}

interface RivalryMatch {
  player1Id: string;
  player2Id: string;
  winnerId: string;
}

interface RivalClub {
  id: string;
  memberIds: string[];
}

// A player in more than one club (higher tiers can join several) makes a
// single cross-club match count toward every one of their clubs' rivalry
// records against the opponent's club — consistent with membership itself
// already allowing that overlap, not a bug to guard against here.
export function computeClubRivalries(
  matches: RivalryMatch[],
  thisClubMemberIds: string[],
  otherClubs: RivalClub[],
): RivalryEntry[] {
  const table = new Map<string, RivalryEntry>();
  for (const m of matches) {
    const p1InThis = thisClubMemberIds.includes(m.player1Id);
    const p2InThis = thisClubMemberIds.includes(m.player2Id);
    if (p1InThis === p2InThis) continue; // both or neither in this club — not a rivalry match
    const oppId = p1InThis ? m.player2Id : m.player1Id;
    const won = p1InThis ? m.winnerId === m.player1Id : m.winnerId === m.player2Id;
    for (const club of otherClubs) {
      if (club.id === undefined || !club.memberIds.includes(oppId)) continue;
      const e = table.get(club.id) ?? { clubId: club.id, wins: 0, losses: 0, played: 0 };
      e.played++;
      if (won) e.wins++; else e.losses++;
      table.set(club.id, e);
    }
  }
  return [...table.values()].sort((a, b) => b.played - a.played);
}
