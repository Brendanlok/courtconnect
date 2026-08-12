// Reads for the logged-out public site (marketing home, Rankings, player
// lookup, Events). Backed by anon-readable views only: `users_public`
// (supabase/migrations/0003) and `tournaments_public`
// (supabase/migrations/0023) — matches/clubs/club_messages/live_matches
// still have no anon-safe view, so the public site doesn't surface those.
// migrations/0023 MUST be run manually in the Supabase SQL editor (this
// project has no automated migration runner, see every other file in that
// folder) before tournaments_public exists — fetchPublicTournaments fails
// closed (returns []) until then, same as every other fetch* here on error.
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

export interface PublicTournament {
  id: string; name: string; type: string; status: string; venue: string; state?: string;
  country?: string; date: string; time?: string; entryFee: number; prizePool: number;
  maxPlayers: number; currentPlayers: number; minMmr?: number; maxMmr?: number;
  tags?: string[]; description?: string; organiser?: string;
}

function mapTournamentRow(row: Record<string, unknown>): PublicTournament {
  return {
    id: row.id as string,
    name: row.name as string,
    type: row.type as string,
    status: row.status as string,
    venue: row.venue as string,
    state: row.state as string | undefined,
    country: row.country as string | undefined,
    date: row.date as string,
    time: row.time as string | undefined,
    entryFee: row.entry_fee as number,
    prizePool: row.prize_pool as number,
    maxPlayers: row.max_players as number,
    currentPlayers: row.current_players as number,
    minMmr: row.min_mmr as number | undefined,
    maxMmr: row.max_mmr as number | undefined,
    tags: row.tags as string[] | undefined,
    description: row.description as string | undefined,
    organiser: row.organiser as string | undefined,
  };
}

// Upcoming public tournaments for the Events page. tournaments_public
// already excludes dummy/private rows at the view level (migration 0023),
// so this only needs the status filter.
export async function fetchPublicTournaments(limit = 50): Promise<PublicTournament[]> {
  const { data, error } = await supabase
    .from('tournaments_public')
    .select('id, name, type, status, venue, state, country, date, time, entry_fee, prize_pool, max_players, current_players, min_mmr, max_mmr, tags, description, organiser')
    .eq('status', 'Upcoming')
    .order('date', { ascending: true })
    .limit(limit);
  if (error || !data) return [];
  return data.map(mapTournamentRow);
}
