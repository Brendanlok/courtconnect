// Pure logic for the disputed-match re-submit flow — extracted so it can be
// checked without a live device/login (see matchDispute.selfcheck.ts).
// Used by AppContext.tsx (local matches) and indirectly by
// supabaseService.ts's resubmitSharedMatch (real matches).

// Winner from the corrected scores, in whatever p1/p2 orientation the caller
// passed the games in.
export function resubmitWinner<T extends string>(games: { p1: number; p2: number }[], p1Id: T, p2Id: T): T {
  const p1Wins = games.filter(g => g.p1 > g.p2).length;
  const p2Wins = games.filter(g => g.p2 > g.p1).length;
  return p1Wins > p2Wins ? p1Id : p2Id;
}

// mmrChange is always stored from the ORIGINAL reporter's perspective (see
// StoredMatch.reporterUid) regardless of who resubmits — keeps the same
// magnitude as the disputed match and just re-signs it for whichever side
// the corrected scores say actually won.
export function resignedMmrChange(originalMmrChange: number | undefined, newWinnerId: string, reporterUid: string): number {
  const magnitude = Math.abs(originalMmrChange ?? 0);
  return newWinnerId === reporterUid ? magnitude : -magnitude;
}

// The correction always goes to whichever side ISN'T the one resubmitting —
// not always player1, since a second dispute round can flip who's proposing
// it (caught by hand before shipping; this pins it down).
export function resubmitRecipient(resubmittingUid: string, player1Id: string, player2Id: string): string {
  return resubmittingUid === player1Id ? player2Id : player1Id;
}
