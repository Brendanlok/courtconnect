// Reads for the logged-out public site (marketing home, Rankings, player
// lookup). Backed by the `users_public` view (supabase/migrations/0003),
// already granted to the `anon` role — no auth required, no new RLS needed.
// Matches/clubs/tournaments tables are NOT anon-readable, so the public site
// only ever surfaces player rankings/lookup, not match history or events —
// see DEVLOG for that scope call.
import { supabase } from './supabase';
import { isCalibrating } from './utils';
import type { Tier } from '@/types';

// Deliberately its own type, not Pick<UserProfile, ...> — UserProfile's
// `state` is narrowed to MalaysiaState and this view can return players from
// any country, so a standalone shape is simpler than fighting that narrowing.
export interface PublicPlayer {
  uid: string; username: string; displayName: string; mmr: number; tier: Tier;
  placementMatchesPlayed?: number; globalRank: number; state: string;
  bio?: string; gender?: 'Male' | 'Female'; country?: string; photoURL?: string | null;
  isPrivate?: boolean; isDummy?: boolean;
  wins: number; losses: number; totalMatches: number;
  stats: { wins: number; losses: number; totalMatches: number };
}

function mapRow(row: Record<string, unknown>): PublicPlayer {
  return {
    uid: row.uid as string,
    username: row.username as string,
    displayName: row.display_name as string,
    mmr: row.mmr as number,
    tier: row.tier as Tier,
    placementMatchesPlayed: row.placement_matches_played as number | undefined,
    globalRank: (row.global_rank as number | undefined) ?? 0,
    state: row.state as string,
    wins: row.wins as number,
    losses: row.losses as number,
    totalMatches: row.total_matches as number,
    bio: row.bio as string | undefined,
    gender: row.gender as 'Male' | 'Female' | undefined,
    country: row.country as string | undefined,
    photoURL: row.photo_url as string | undefined,
    isPrivate: row.is_private as boolean | undefined,
    isDummy: row.is_dummy as boolean | undefined,
    stats: { wins: row.wins as number, losses: row.losses as number, totalMatches: row.total_matches as number },
  };
}

// Top players by MMR for the public Rankings page. Excludes seed/demo
// accounts, private profiles, and still-calibrating players — same filters
// the authenticated in-app leaderboard already applies (see app/leaderboard).
// Real accounts have is_dummy/is_private as SQL NULL, not `false` — `.eq(col,
// false)` never matches NULL, so it would silently hide every real player.
// `.is.null,.eq.false` in one or() group is the "not explicitly true" check.
const NOT_DUMMY = 'is_dummy.is.null,is_dummy.eq.false';
const NOT_PRIVATE = 'is_private.is.null,is_private.eq.false';
const SELECT_COLS = 'uid, username, display_name, mmr, tier, placement_matches_played, global_rank, state, wins, losses, total_matches, bio, gender, country, photo_url, is_private, is_dummy';

export async function fetchPublicRankings(limit = 50): Promise<PublicPlayer[]> {
  const { data, error } = await supabase
    .from('users_public')
    .select(SELECT_COLS)
    .or(NOT_DUMMY)
    .or(NOT_PRIVATE)
    .order('mmr', { ascending: false })
    .limit(limit * 2); // over-fetch: isCalibrating isn't a DB column, filtered client-side below
  if (error || !data) return [];
  return data.map(mapRow).filter(p => !isCalibrating(p)).slice(0, limit);
}

// Single-player lookup by exact username for the public search box. Dummy/
// private profiles come back as "not found" rather than exposing them.
export async function fetchPublicPlayer(username: string): Promise<PublicPlayer | null> {
  const { data, error } = await supabase
    .from('users_public')
    .select(SELECT_COLS)
    .ilike('username', username.trim())
    .or(NOT_DUMMY)
    .or(NOT_PRIVATE)
    .maybeSingle();
  if (error || !data) return null;
  return mapRow(data);
}

// Total ranked (non-calibrating, non-dummy) player count for the marketing
// home's stats teaser. head:true + count:'exact' avoids pulling any rows.
export async function fetchPublicPlayerCount(): Promise<number | null> {
  const { count, error } = await supabase
    .from('users_public')
    .select('uid', { count: 'exact', head: true })
    .or(NOT_DUMMY)
    .or(NOT_PRIVATE)
    .gte('placement_matches_played', 10); // "ranked" = past calibration, matches isCalibrating's own threshold
  if (error) return null;
  return count ?? null;
}
