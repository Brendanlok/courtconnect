/**
 * Supabase persistence layer (replaces src/lib/firestoreService.ts).
 * All writes go here; AppContext calls these alongside its local state updates.
 * Tables: users / matches / planned_matches / tournament_registrations / friends /
 * clubs / club_messages / conversations / conversation_messages / challenges /
 * endorsements / live_matches / court_sessions. Schema: supabase/migrations/.
 *
 * Same exported function names/signatures as firestoreService.ts on purpose —
 * call sites needed a one-line import swap, not a rewrite.
 */
import { supabase } from '@/lib/supabase';
import { getTier, maxClubsForTier, BASE_PATH, localDateISO } from '@/lib/utils';
import { resubmitRecipient } from '@/lib/matchDispute';
import type { Match, UserProfile, Club, ClubMessage, MalaysiaState, LiveMatchStats, Tier, AvailabilityEntry, Venue, Tournament, SeasonHistoryEntry } from '@/types';

// Every subscribeX function below names its channel deterministically from
// an id (e.g. `club_messages:${clubId}`) - fine when there's only ever one
// subscriber per id, but several ids (club messages, tournaments, clubs) are
// legitimately subscribed to from more than one place at once (e.g. a
// per-club notification listener that lives in AppContext for as long as
// you're a member, plus a page-specific listener while that club's detail
// page is open). supabase.removeChannel() is async, so a "remove the old
// one, then create a new one with the same name" approach still races - the
// client throws synchronously ("cannot add postgres_changes callbacks...
// after subscribe()") if the old one hasn't finished tearing down yet.
// Sidesteps the whole race: give every call its own uniquely-suffixed
// channel name so concurrent subscribers never share one to begin with.
let channelSeq = 0;
function freshChannel(topic: string) {
  return supabase.channel(`${topic}:${++channelSeq}`);
}

// ── User profile ──────────────────────────────────────────────────────────────
// users.stats is split across wins/losses/total_matches columns (not jsonb) —
// every user row read/write splits or re-joins that one field explicitly.

function userRowToProfile(row: Record<string, unknown>): Partial<UserProfile> {
  return {
    uid: row.uid as string,
    username: row.username as string,
    isDummy: row.is_dummy as boolean | undefined,
    displayName: row.display_name as string,
    email: row.email as string,
    mmr: row.mmr as number,
    tier: row.tier as UserProfile['tier'],
    seasonNumber: row.season_number as number | undefined,
    placementMatchesPlayed: row.placement_matches_played as number | null | undefined,
    recalibrationMatchesPlayed: row.recalibration_matches_played as number | null | undefined,
    lastRecalibrationAt: row.last_recalibration_at as string | undefined,
    inactivityReminderSentAt: row.inactivity_reminder_sent_at as string | null | undefined,
    referredBy: row.referred_by as string | null | undefined,
    globalRank: row.global_rank as number,
    state: row.state as MalaysiaState,
    area: row.area as string,
    stats: { wins: (row.wins as number) ?? 0, losses: (row.losses as number) ?? 0, totalMatches: (row.total_matches as number) ?? 0 },
    bio: row.bio as string | undefined,
    available: row.available as string | undefined,
    openToPlay: row.open_to_play as boolean | undefined,
    gender: row.gender as UserProfile['gender'],
    postcode: row.postcode as string | undefined,
    disciplineMMR: row.discipline_mmr as UserProfile['disciplineMMR'],
    lookingForPartner: row.looking_for_partner as boolean | undefined,
    joinedAt: row.joined_at as string,
    birthday: row.birthday as string | undefined,
    country: row.country as string | undefined,
    countryCode: row.country_code as UserProfile['countryCode'],
    region: row.region as string | undefined,
    endorsements: row.endorsements as Record<string, number> | undefined,
    photoURL: row.photo_url as string | null | undefined,
    isPrivate: row.is_private as boolean | undefined,
    followersCount: row.followers_count as number | undefined,
    followingCount: row.following_count as number | undefined,
    clipCredits: row.clip_credits as number | undefined,
    clipBadge: row.clip_badge as UserProfile['clipBadge'],
    courtProfile: row.court_profile as UserProfile['courtProfile'],
    privacy: row.privacy as UserProfile['privacy'],
  };
}

// patch → row, splitting `stats` and dropping fields with no column (uid, tier
// derived elsewhere is still writable directly since the column exists).
function profilePatchToRow(patch: Partial<UserProfile>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const map: Record<string, string> = {
    isDummy: 'is_dummy', displayName: 'display_name', mmr: 'mmr', tier: 'tier', seasonNumber: 'season_number',
    placementMatchesPlayed: 'placement_matches_played', globalRank: 'global_rank', state: 'state', area: 'area',
    recalibrationMatchesPlayed: 'recalibration_matches_played', lastRecalibrationAt: 'last_recalibration_at',
    inactivityReminderSentAt: 'inactivity_reminder_sent_at',
    bio: 'bio', available: 'available', openToPlay: 'open_to_play', gender: 'gender', postcode: 'postcode',
    disciplineMMR: 'discipline_mmr', lookingForPartner: 'looking_for_partner',
    joinedAt: 'joined_at', birthday: 'birthday', country: 'country', countryCode: 'country_code', region: 'region',
    endorsements: 'endorsements', photoURL: 'photo_url', isPrivate: 'is_private',
    followersCount: 'followers_count', followingCount: 'following_count', clipCredits: 'clip_credits',
    clipBadge: 'clip_badge', courtProfile: 'court_profile', privacy: 'privacy', username: 'username', email: 'email',
  };
  for (const [camel, snake] of Object.entries(map)) {
    if (camel in patch) row[snake] = (patch as Record<string, unknown>)[camel];
  }
  if (patch.stats) {
    row.wins = patch.stats.wins;
    row.losses = patch.stats.losses;
    row.total_matches = patch.stats.totalMatches;
  }
  return row;
}

export async function saveUserProfile(uid: string, patch: Partial<UserProfile>) {
  if (!uid || uid === 'me') return; // skip seed user
  await supabase.from('users').update(profilePatchToRow(patch)).eq('uid', uid);
}

export async function loadUserProfile(uid: string): Promise<Partial<UserProfile> | null> {
  const { data } = await supabase.from('users').select('*').eq('uid', uid).maybeSingle();
  return data ? userRowToProfile(data) : null;
}

// ── Ranked seasons ──────────────────────────────────────────────────────────
// Requires migration 0014_ranked_seasons.sql to be applied.

export async function saveSeasonHistoryEntry(uid: string, entry: SeasonHistoryEntry): Promise<void> {
  await supabase.from('season_history').upsert({
    uid, season_number: entry.seasonNumber, mmr_end: entry.mmrEnd, tier_end: entry.tierEnd, ended_at: entry.endedAt,
  }, { onConflict: 'uid,season_number' });
}

export async function loadSeasonHistory(uid: string): Promise<SeasonHistoryEntry[]> {
  const { data } = await supabase.from('season_history').select('*').eq('uid', uid).order('season_number', { ascending: false });
  return (data ?? []).map(row => ({
    seasonNumber: row.season_number as number,
    mmrEnd: row.mmr_end as number,
    tierEnd: row.tier_end as Tier,
    endedAt: row.ended_at as string,
  }));
}

// Other-player lookups (opponent search, club members, chat contacts, shared
// profile links) read from the users_public view, not the users table — the
// table's RLS is owner-only as of migration 0003 since it holds email/
// birthday/postcode, none of which any of these call sites use.
export async function lookupUserByUsername(username: string): Promise<Partial<UserProfile> | null> {
  const { data } = await supabase.from('users_public').select('*').eq('username', username).maybeSingle();
  return data ? userRowToProfile(data) : null;
}

export async function lookupUserByUid(uid: string): Promise<Partial<UserProfile> | null> {
  const { data } = await supabase.from('users_public').select('*').eq('uid', uid).maybeSingle();
  return data ? userRowToProfile(data) : null;
}

// Count-only, computed on demand rather than a stored counter — see
// referred_by in 0021_referrals.sql for why.
export async function countReferrals(uid: string): Promise<number> {
  const { count } = await supabase.from('users_public').select('uid', { count: 'exact', head: true }).eq('referred_by', uid);
  return count ?? 0;
}

// One-shot fetch of every real signed-up account, for the leaderboard's ranking
// pool — read-only, no realtime subscription (same "fine at current scale"
// tradeoff already accepted in the Firestore version).
export async function loadAllRealUsers(excludeUid: string): Promise<UserProfile[]> {
  const { data } = await supabase.from('users_public').select('*').neq('uid', excludeUid);
  return (data ?? [])
    .map(userRowToProfile)
    .filter((p): p is Partial<UserProfile> & { username: string; displayName: string; mmr: number } =>
      !!p.username && !!p.displayName && typeof p.mmr === 'number')
    .map(p => ({
      ...p,
      tier: p.tier ?? getTier(p.mmr),
      state: p.state ?? 'Kuala Lumpur',
      area: p.area ?? '',
      globalRank: p.globalRank ?? 0,
      joinedAt: p.joinedAt ?? '',
      stats: p.stats ?? { wins: 0, losses: 0, totalMatches: 0 },
    } as UserProfile));
}

// ── Logged matches against non-real (demo/seed) opponents ─────────────────────
// ponytail: the shared `matches` table FK-references users(uid) on both player
// columns, so a match against a seed/demo player (never a real auth user) can't
// be written there. These stay local-only (AppContext already keeps a local
// `matches` array as the source of truth) — no cross-device persistence for
// demo-opponent matches specifically. Add a nullable/no-FK column if that's
// ever needed for real.
export async function saveMatch(_uid: string, _match: Match) { /* no-op, see note above */ }

// ── Planned matches ───────────────────────────────────────────────────────────
// planned_matches has real columns (host_uid, format, venue, date, status,
// live_match_id) plus a `data` jsonb catch-all — store the whole object there
// so arbitrary shapes from matches/page.tsx round-trip without a schema change.

export async function savePlannedMatch(uid: string, pm: object) {
  if (!uid || uid === 'me') return;
  const p = pm as { id: string; format?: string; venue?: string; date?: string; status?: string };
  await supabase.from('planned_matches').upsert({
    id: p.id, host_uid: uid, format: p.format, venue: p.venue, date: p.date, status: p.status ?? 'upcoming', data: pm,
  });
}

export async function loadPlannedMatches(uid: string): Promise<object[]> {
  const { data } = await supabase.from('planned_matches').select('data').eq('host_uid', uid);
  return (data ?? []).map(r => r.data as object);
}

// ── Tournament registrations ──────────────────────────────────────────────────

export async function saveTournamentReg(uid: string, tournamentId: string, data: { registeredAt?: string }) {
  if (!uid || uid === 'me') return;
  await supabase.from('tournament_registrations').insert({
    tournament_id: tournamentId, user_id: uid, created_at: data.registeredAt ?? new Date().toISOString(),
  });
}

export async function deleteTournamentReg(uid: string, tournamentId: string) {
  if (!uid || uid === 'me') return;
  await supabase.from('tournament_registrations').delete().eq('tournament_id', tournamentId).eq('user_id', uid);
}

export async function loadTournamentRegs(uid: string): Promise<Record<string, { registeredAt: string }>> {
  const { data } = await supabase.from('tournament_registrations').select('tournament_id, created_at').eq('user_id', uid);
  const result: Record<string, { registeredAt: string }> = {};
  (data ?? []).forEach(r => { result[r.tournament_id as string] = { registeredAt: (r.created_at as string) ?? new Date().toISOString() }; });
  return result;
}

// ── Account deletion ──────────────────────────────────────────────────────────

export async function deleteAccountData(uid: string): Promise<void> {
  if (!uid || uid === 'me') return;
  await Promise.all([
    supabase.from('planned_matches').delete().eq('host_uid', uid),
    supabase.from('tournament_registrations').delete().eq('user_id', uid),
    supabase.from('friends').delete().eq('user_id', uid),
  ]);
  await supabase.from('users').delete().eq('uid', uid);
  // ponytail: this deletes the profile row + owned rows above; it does not
  // remove `uid` from other rows' arrays (clubs.member_ids, matches, etc) or
  // delete the auth.users account — see deleteUser() gap noted in AuthContext.
}

// ── User settings ─────────────────────────────────────────────────────────────

export async function saveOpenToPlay(uid: string, value: boolean) {
  if (!uid || uid === 'me') return;
  await supabase.from('users').update({ open_to_play: value }).eq('uid', uid);
}

// ── Live matches ──────────────────────────────────────────────────────────────

import type { LiveMatch } from '@/types';

function liveMatchRowToObj(row: Record<string, unknown>): LiveMatch {
  return {
    id: row.id as string, joinCode: row.join_code as string, format: row.format as LiveMatch['format'],
    teamA: row.team_a as LiveMatch['teamA'], teamB: row.team_b as LiveMatch['teamB'],
    teamAName: row.team_a_name as string, teamBName: row.team_b_name as string, venue: row.venue as string,
    hostUid: row.host_uid as string, bestOf: row.best_of as LiveMatch['bestOf'], status: row.status as LiveMatch['status'],
    currentGame: row.current_game as number, games: row.games as LiveMatch['games'], gameWins: row.game_wins as LiveMatch['gameWins'],
    winningSide: row.winning_side as LiveMatch['winningSide'], createdAt: row.created_at as string,
    completedAt: row.completed_at as string | undefined, clipUrl: row.clip_url as string | undefined,
    recordMode: row.record_mode as LiveMatch['recordMode'], liveStats: row.live_stats as LiveMatch['liveStats'],
  };
}

function liveMatchObjToRow(m: LiveMatch): Record<string, unknown> {
  return {
    id: m.id, join_code: m.joinCode, format: m.format, team_a: m.teamA, team_b: m.teamB,
    team_a_name: m.teamAName, team_b_name: m.teamBName, venue: m.venue, host_uid: m.hostUid, best_of: m.bestOf,
    status: m.status, current_game: m.currentGame, games: m.games, game_wins: m.gameWins, winning_side: m.winningSide,
    clip_url: m.clipUrl, record_mode: m.recordMode, live_stats: m.liveStats,
  };
}

export async function createLiveMatch(match: LiveMatch): Promise<void> {
  await supabase.from('live_matches').insert(liveMatchObjToRow(match));
}

const LIVE_MATCH_KEY_MAP: Record<string, string> = {
  joinCode: 'join_code', format: 'format', teamA: 'team_a', teamB: 'team_b', teamAName: 'team_a_name',
  teamBName: 'team_b_name', venue: 'venue', hostUid: 'host_uid', bestOf: 'best_of', status: 'status',
  currentGame: 'current_game', games: 'games', gameWins: 'game_wins', winningSide: 'winning_side',
  completedAt: 'completed_at', clipUrl: 'clip_url', recordMode: 'record_mode', liveStats: 'live_stats',
};

export async function updateLiveMatch(id: string, patch: Partial<LiveMatch>): Promise<void> {
  const row: Record<string, unknown> = {};
  for (const [camel, snake] of Object.entries(LIVE_MATCH_KEY_MAP)) {
    if (camel in patch) row[snake] = (patch as Record<string, unknown>)[camel];
  }
  await supabase.from('live_matches').update(row).eq('id', id);
}

export async function getLiveMatchByCode(code: string): Promise<LiveMatch | null> {
  const { data } = await supabase.from('live_matches').select('*').eq('join_code', code.toUpperCase()).eq('status', 'active').maybeSingle();
  return data ? liveMatchRowToObj(data) : null;
}

export function subscribeLiveMatch(id: string, cb: (m: LiveMatch | null) => void): () => void {
  const load = async () => {
    const { data } = await supabase.from('live_matches').select('*').eq('id', id).maybeSingle();
    cb(data ? liveMatchRowToObj(data) : null);
  };
  load();
  const channel = freshChannel(`live_match:${id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'live_matches', filter: `id=eq.${id}` }, load)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// ── Court tracking sessions (two devices, one shared heatmap) ─────────────────

import type { CourtSession, CourtPosition } from '@/types';

function courtSessionRowToObj(row: Record<string, unknown>): CourtSession {
  return {
    id: row.id as string, joinCode: row.join_code as string, hostUid: row.host_uid as string,
    status: row.status as CourtSession['status'], positions: (row.positions as CourtPosition[]) ?? [],
    createdAt: row.created_at as string, plannedMatchId: row.planned_match_id as string | undefined,
    venue: row.venue as string | undefined,
  };
}

export async function createCourtSession(session: CourtSession): Promise<void> {
  await supabase.from('court_sessions').insert({
    id: session.id, join_code: session.joinCode, host_uid: session.hostUid, status: session.status,
    positions: session.positions, planned_match_id: session.plannedMatchId, venue: session.venue,
  });
}

// ponytail: read-modify-write, not atomic — two devices tapping in the exact
// same instant could clobber one row's positions. Acceptable for a two-device
// casual tracking session; move to a Postgres function (array append) if this
// ever needs to be airtight.
export async function addCourtSessionPositions(id: string, positions: CourtPosition[]): Promise<void> {
  const { data } = await supabase.from('court_sessions').select('positions').eq('id', id).maybeSingle();
  const existing = (data?.positions as CourtPosition[] | undefined) ?? [];
  await supabase.from('court_sessions').update({ positions: [...existing, ...positions] }).eq('id', id);
}

export async function getCourtSessionByCode(code: string): Promise<CourtSession | null> {
  const { data } = await supabase.from('court_sessions').select('*').eq('join_code', code.toUpperCase()).eq('status', 'active').maybeSingle();
  return data ? courtSessionRowToObj(data) : null;
}

export function subscribeCourtSession(id: string, cb: (s: CourtSession | null) => void): () => void {
  const load = async () => {
    const { data } = await supabase.from('court_sessions').select('*').eq('id', id).maybeSingle();
    cb(data ? courtSessionRowToObj(data) : null);
  };
  load();
  const channel = freshChannel(`court_session:${id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'court_sessions', filter: `id=eq.${id}` }, load)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

export async function completeCourtSession(id: string): Promise<void> {
  await supabase.from('court_sessions').update({ status: 'completed' }).eq('id', id);
}

// ── Legacy per-user demo conversations (kept local-only, see saveMatch note) ──

interface StoredConversation {
  id: string; participantUid: string; lastMessage: string; lastAt: string; unread: number;
  messages: Array<{ id: string; senderId: string; text: string; sentAt: string }>;
}
export async function saveConversation(_uid: string, _conv: StoredConversation) { /* no-op, demo conversations stay local-only */ }
export async function loadConversations(_uid: string): Promise<StoredConversation[]> { return []; }

// ── Real chat between two real accounts ───────────────────────────────────────
// conversations/conversation_messages are separate tables (not one doc with an
// embedded array + participants map like Firestore) — participant display info
// is looked up from `users` live instead of being denormalized onto the row.

export function chatIdFor(a: string, b: string): string {
  return [a, b].sort().join('_');
}

export interface ChatMessage { id: string; senderId: string; text: string; sentAt: string }
export interface SharedParticipant { displayName: string; username: string; tier: string; mmr: number; photoURL?: string | null; placementMatchesPlayed?: number | null }
export interface SharedConversation {
  id: string; participantUids: string[]; participants: Record<string, SharedParticipant>;
  messages: ChatMessage[]; lastMessage: string; lastAt: string;
}

async function loadConversationMessages(conversationId: string): Promise<ChatMessage[]> {
  const { data } = await supabase.from('conversation_messages').select('*').eq('conversation_id', conversationId).order('sent_at');
  return (data ?? []).map(r => ({ id: r.id as string, senderId: r.sender_id as string, text: r.text as string, sentAt: r.sent_at as string }));
}

async function loadParticipantsMap(uids: string[]): Promise<Record<string, SharedParticipant>> {
  if (!uids.length) return {};
  // users_public, not users — chat participants are frequently NOT the
  // caller, and users' RLS is owner-only (see lookupUserByUsername above).
  const { data } = await supabase.from('users_public').select('uid, display_name, username, tier, mmr, photo_url, placement_matches_played').in('uid', uids);
  const out: Record<string, SharedParticipant> = {};
  (data ?? []).forEach(r => {
    out[r.uid as string] = {
      displayName: r.display_name as string, username: r.username as string, tier: r.tier as string, mmr: r.mmr as number,
      photoURL: r.photo_url as string | null, placementMatchesPlayed: r.placement_matches_played as number | null | undefined,
    };
  });
  return out;
}

async function buildSharedConversation(row: { id: string; participant_ids: string[]; last_message: string | null; last_at: string | null }): Promise<SharedConversation> {
  const [messages, participants] = await Promise.all([loadConversationMessages(row.id), loadParticipantsMap(row.participant_ids ?? [])]);
  return { id: row.id, participantUids: row.participant_ids ?? [], participants, messages, lastMessage: row.last_message ?? '', lastAt: row.last_at ?? '' };
}

// ponytail: Realtime postgres_changes filters only support column=eq, not
// array-contains — subscribe unfiltered and re-run the (indexed) query
// client-side on every change. Fine at current scale; move to a Postgres
// function + broadcast channel if the conversations table gets large.
export function subscribeMySharedConversations(myUid: string, cb: (cs: SharedConversation[]) => void): () => void {
  let cancelled = false;
  const load = async () => {
    const { data } = await supabase.from('conversations').select('*').contains('participant_ids', [myUid]);
    if (cancelled) return;
    const built = await Promise.all((data ?? []).map(r => buildSharedConversation(r as never)));
    if (!cancelled) cb(built);
  };
  load();
  const channel = freshChannel(`my_conversations:${myUid}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, load)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_messages' }, load)
    .subscribe();
  return () => { cancelled = true; supabase.removeChannel(channel); };
}

// Writes a real row into the (previously unused) notifications table so a
// push webhook has something to fire on even if the recipient's app is fully
// closed — see the comment on the "any signed-in insert" policy in
// 0010_push_subscriptions.sql. Best-effort: a failed insert (e.g. migration
// not yet applied) shouldn't block the actual message/challenge send.
export async function notifyUser(userId: string, n: { type: string; title: string; body: string; linkTo?: string }) {
  try {
    await supabase.from('notifications').insert({ user_id: userId, type: n.type, title: n.title, body: n.body, link_to: n.linkTo });
  } catch { /* ignore */ }
}

export async function sendSharedMessage(
  chatId: string, participantUids: string[], participants: Record<string, SharedParticipant>, msg: ChatMessage,
) {
  await supabase.from('conversations').upsert({ id: chatId, participant_ids: participantUids, last_message: msg.text, last_at: msg.sentAt });
  await supabase.from('conversation_messages').insert({ id: msg.id, conversation_id: chatId, sender_id: msg.senderId, text: msg.text, sent_at: msg.sentAt });
  const senderName = participants[msg.senderId]?.displayName ?? 'Someone';
  participantUids.filter(uid => uid !== msg.senderId).forEach(uid =>
    notifyUser(uid, { type: 'new_message', title: `New message from ${senderName}`, body: msg.text, linkTo: `${BASE_PATH}/chat/?realUid=${msg.senderId}` }));
}

// ── Real challenges between two real accounts ─────────────────────────────────

export interface StoredChallenge {
  id: string; fromUid: string; fromName: string; fromUsername: string;
  toUid: string; toName: string; toUsername: string;
  format: string; venue: string; date: string; message?: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled'; createdAt: string;
}

function challengeRowToObj(row: Record<string, unknown>): StoredChallenge {
  return {
    id: row.id as string, fromUid: row.from_id as string, fromName: row.from_name as string, fromUsername: row.from_username as string,
    toUid: row.to_id as string, toName: row.to_name as string, toUsername: row.to_username as string,
    format: row.format as string, venue: row.venue as string, date: row.date as string, message: row.message as string | undefined,
    status: row.status as StoredChallenge['status'], createdAt: row.created_at as string,
  };
}

export function subscribeChallengesFor(field: 'fromUid' | 'toUid', myUid: string, cb: (docs: StoredChallenge[]) => void): () => void {
  const col = field === 'fromUid' ? 'from_id' : 'to_id';
  const load = async () => {
    const { data } = await supabase.from('challenges').select('*').eq(col, myUid);
    cb((data ?? []).map(challengeRowToObj));
  };
  load();
  const channel = freshChannel(`challenges:${col}:${myUid}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'challenges', filter: `${col}=eq.${myUid}` }, load)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

export async function sendChallengeDoc(c: StoredChallenge) {
  await supabase.from('challenges').insert({
    id: c.id, from_id: c.fromUid, from_name: c.fromName, from_username: c.fromUsername,
    to_id: c.toUid, to_name: c.toName, to_username: c.toUsername,
    format: c.format, venue: c.venue, date: c.date, message: c.message, status: c.status, created_at: c.createdAt,
  });
  notifyUser(c.toUid, { type: 'challenge_received', title: 'Challenge Received', body: `${c.fromName} challenged you to a ${c.format} match.` });
}

export async function updateChallengeStatus(id: string, status: StoredChallenge['status']) {
  await supabase.from('challenges').update({ status }).eq('id', id);
}

// ── Real endorsements between real accounts ───────────────────────────────────
// endorsements is one row per (from_uid, to_uid, skill), not one doc with a
// skills[] array — set/replace = delete this pair's rows then re-insert.

export async function setEndorsementDoc(targetUid: string, fromUid: string, skills: string[]) {
  await supabase.from('endorsements').delete().eq('from_uid', fromUid).eq('to_uid', targetUid);
  if (skills.length > 0) {
    await supabase.from('endorsements').insert(skills.map(skill => ({ from_uid: fromUid, to_uid: targetUid, skill })));
  }
}

export function subscribeEndorsementsReceived(myUid: string, cb: (bySkill: Record<string, number>) => void): () => void {
  const load = async () => {
    const { data } = await supabase.from('endorsements').select('skill').eq('to_uid', myUid);
    const counts: Record<string, number> = {};
    (data ?? []).forEach(r => { const s = r.skill as string; counts[s] = (counts[s] ?? 0) + 1; });
    cb(counts);
  };
  load();
  const channel = freshChannel(`endorsements:${myUid}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'endorsements', filter: `to_uid=eq.${myUid}` }, load)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// All skills a real account has endorsed on anyone, grouped by target — the
// counterpart to setEndorsementDoc's writes, which nothing was ever loading
// back (myEndorsements silently reset to empty on every reload before this).
export async function loadEndorsementsGiven(fromUid: string): Promise<Record<string, string[]>> {
  const { data } = await supabase.from('endorsements').select('to_uid, skill').eq('from_uid', fromUid);
  const result: Record<string, string[]> = {};
  (data ?? []).forEach(r => {
    const targetUid = r.to_uid as string;
    (result[targetUid] ??= []).push(r.skill as string);
  });
  return result;
}

// ── Real follows between real accounts ─────────────────────────────────────────
// `friends` (user_id follows friend_id) existed since 0001_init.sql but nothing
// ever wrote to it — see 0016_follow_requests.sql for the status column + RLS
// this needs. Following a public account works today on the original policy;
// a private target's row lands 'pending' until they accept via respondToFollowRequest.

export async function followUser(myUid: string, myName: string, targetUid: string, targetIsPrivate: boolean) {
  const status = targetIsPrivate ? 'pending' : 'accepted';
  await supabase.from('friends').upsert({ user_id: myUid, friend_id: targetUid, status }, { onConflict: 'user_id,friend_id' });
  notifyUser(targetUid, status === 'pending'
    ? { type: 'friend_request', title: 'Follow Request', body: `${myName} wants to follow you.` }
    : { type: 'friend_request', title: 'New Follower', body: `${myName} started following you.` });
}

export async function unfollowUser(myUid: string, targetUid: string) {
  await supabase.from('friends').delete().eq('user_id', myUid).eq('friend_id', targetUid);
}

export async function respondToFollowRequest(myUid: string, myName: string, requesterUid: string, accept: boolean) {
  if (accept) {
    await supabase.from('friends').update({ status: 'accepted' }).eq('user_id', requesterUid).eq('friend_id', myUid);
    notifyUser(requesterUid, { type: 'friend_accepted', title: 'Follow Request Accepted', body: `${myName} accepted your follow request.` });
  } else {
    await supabase.from('friends').delete().eq('user_id', requesterUid).eq('friend_id', myUid);
  }
}

// Who I follow (accepted) and who I've requested to follow (pending) — the
// real-account counterpart to the local cc_following/cc_followRequestsSent state.
export function subscribeFollowing(myUid: string, cb: (accepted: string[], pending: string[]) => void): () => void {
  const load = async () => {
    const { data } = await supabase.from('friends').select('friend_id, status').eq('user_id', myUid);
    const rows = data ?? [];
    cb(rows.filter(r => r.status === 'accepted').map(r => r.friend_id as string),
       rows.filter(r => r.status === 'pending').map(r => r.friend_id as string));
  };
  load();
  const channel = freshChannel(`friends_out:${myUid}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'friends', filter: `user_id=eq.${myUid}` }, load)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// Real accounts with a pending request to follow me — degrades to empty until
// 0016_follow_requests.sql's "see incoming follows" policy is applied.
export function subscribeIncomingFollowRequests(myUid: string, cb: (requesterUids: string[]) => void): () => void {
  const load = async () => {
    const { data } = await supabase.from('friends').select('user_id').eq('friend_id', myUid).eq('status', 'pending');
    cb((data ?? []).map(r => r.user_id as string));
  };
  load();
  const channel = freshChannel(`friends_in:${myUid}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'friends', filter: `friend_id=eq.${myUid}` }, load)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// ── Presence (who's currently online) ──────────────────────────────────────
// Every signed-in client joins the same fixed-name channel (not freshChannel —
// presence only works when everyone shares one channel) and tracks itself
// under its own uid. Supabase Realtime removes a client from the shared state
// automatically on disconnect (tab close, network drop), so there's no
// heartbeat or last-seen column to maintain.
export function subscribeOnlinePresence(myUid: string, cb: (onlineUids: Set<string>) => void): () => void {
  const channel = supabase.channel('presence:online', { config: { presence: { key: myUid } } });
  channel
    .on('presence', { event: 'sync' }, () => {
      cb(new Set(Object.keys(channel.presenceState())));
    })
    .subscribe(status => {
      if (status === 'SUBSCRIBED') channel.track({ online_at: new Date().toISOString() }).catch(() => {});
    });
  return () => { supabase.removeChannel(channel); };
}

// ── Clubs (real, shared rows — membership/moderation visible to everyone) ─────

function clubRowToObj(row: Record<string, unknown>): Club {
  return {
    id: row.id as string, isDummy: row.is_dummy as boolean | undefined, name: row.name as string, shortName: row.short_name as string,
    description: row.description as string, purpose: row.purpose as Club['purpose'], state: row.state as MalaysiaState, area: row.area as string,
    logoInitials: row.logo_initials as string, color: row.color as string, maxMembers: row.max_members as number, minMMR: row.min_mmr as number | undefined,
    isPrivate: row.is_private as boolean, adminId: row.admin_id as string, moderatorIds: (row.moderator_ids as string[]) ?? [],
    memberIds: (row.member_ids as string[]) ?? [], pendingIds: (row.pending_ids as string[]) ?? [], avgMMR: row.avg_mmr as number,
    topPlayers: (row.top_players as string[]) ?? [], tags: (row.tags as string[]) ?? [], foundedYear: row.founded_year as number,
    announcement: row.announcement as string | undefined, isPro: (row.is_pro as boolean | undefined) ?? false,
  };
}

function clubObjToRow(c: Club): Record<string, unknown> {
  return {
    id: c.id, is_dummy: c.isDummy, name: c.name, short_name: c.shortName, description: c.description, purpose: c.purpose,
    state: c.state, area: c.area, logo_initials: c.logoInitials, color: c.color, max_members: c.maxMembers, min_mmr: c.minMMR,
    is_private: c.isPrivate, admin_id: c.adminId, moderator_ids: c.moderatorIds, member_ids: c.memberIds, pending_ids: c.pendingIds,
    avg_mmr: c.avgMMR, top_players: c.topPlayers, tags: c.tags, founded_year: c.foundedYear, announcement: c.announcement,
    is_pro: c.isPro,
  };
}

export function subscribeClubs(cb: (clubs: Club[]) => void): () => void {
  const load = async () => {
    const { data } = await supabase.from('clubs').select('*');
    cb((data ?? []).map(clubRowToObj));
  };
  load();
  const channel = freshChannel('clubs')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'clubs' }, load)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// Seeds the static demo clubs into Supabase once, so real accounts can
// actually join them. club_messages is a separate table now — any seed
// clubMessages go there, not on the clubs row.
// ponytail: clubs.admin_id is `uuid not null references users(uid)` — seed
// clubs authored for local/single-player mode use dummy admin ids ('p1' etc,
// see src/lib/data.ts) that were never real Supabase users, so the insert
// below can never succeed for them (confirmed: every load has been 400ing
// on this since the 2026-07-12 migration, clubs never actually created).
// Skip those rather than retry a write that's permanently doomed. Real fix
// needs a product decision (nullable admin_id + RLS update, or a real system
// user) — flagged to Lok, not done here since it's a schema change.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function ensureSeedClubsExist(seedClubs: Club[]): Promise<void> {
  await Promise.all(seedClubs.filter(c => UUID_RE.test(c.adminId)).map(async c => {
    const { data: existing } = await supabase.from('clubs').select('id, member_ids, pending_ids, moderator_ids').eq('id', c.id).maybeSingle();
    if (!existing) {
      // Seed data (src/lib/data.ts) was authored for pure local/single-player
      // state, where 'me' meant "the current device's user" — strip it so a
      // real shared row doesn't make every real account look pre-joined.
      await supabase.from('clubs').insert(clubObjToRow({
        ...c,
        memberIds: c.memberIds.filter(uid => uid !== 'me'),
        pendingIds: (c.pendingIds ?? []).filter(uid => uid !== 'me'),
        moderatorIds: (c.moderatorIds ?? []).filter(uid => uid !== 'me'),
      }));
      const legacyMsgs = (c.clubMessages ?? []).filter(m => m.senderId !== 'me');
      if (legacyMsgs.length) await supabase.from('club_messages').insert(legacyMsgs.map(m => ({ id: m.id, club_id: c.id, sender_id: m.senderId, sender_name: m.senderName, text: m.text, sent_at: m.sentAt })));
      return;
    }
    const hasMePlaceholder = (existing.member_ids as string[] | null)?.includes('me')
      || (existing.pending_ids as string[] | null)?.includes('me')
      || (existing.moderator_ids as string[] | null)?.includes('me');
    if (hasMePlaceholder) {
      await supabase.from('clubs').update({
        member_ids: ((existing.member_ids as string[]) ?? []).filter(u => u !== 'me'),
        pending_ids: ((existing.pending_ids as string[]) ?? []).filter(u => u !== 'me'),
        moderator_ids: ((existing.moderator_ids as string[]) ?? []).filter(u => u !== 'me'),
      }).eq('id', c.id);
    }
  }));
}

export async function createClubDoc(club: Club) {
  const { error } = await supabase.from('clubs').insert(clubObjToRow(club));
  if (error) throw error;
}

export async function updateClubDoc(id: string, patch: Partial<Club>) {
  await supabase.from('clubs').update(clubObjToRow(patch as Club)).eq('id', id);
}

export async function deleteClubDoc(id: string) {
  await supabase.from('clubs').delete().eq('id', id);
}

// ponytail: read-modify-write, not atomic (Postgres array columns have no
// arrayUnion/arrayRemove equivalent via the query builder). Two people
// joining/requesting the exact same instant could clobber each other's
// change — acceptable at current scale; move to a Postgres function
// (array_append/array_remove in one UPDATE) if that ever becomes real.
async function mutateClubArray(id: string, column: 'member_ids' | 'pending_ids' | 'moderator_ids', add: string[], remove: string[]) {
  const { data } = await supabase.from('clubs').select(column).eq('id', id).maybeSingle();
  const row = data as Record<string, string[] | undefined> | null;
  const existing = (row?.[column] ?? []).filter(u => !remove.includes(u));
  const next = [...new Set([...existing, ...add])];
  await supabase.from('clubs').update({ [column]: next }).eq('id', id);
}

// Returns true if uid ends up a member (including "already was"), false if
// rejected (club full / uid over their tier's club limit) - callers that show
// their own optimistic "Joined!" feedback (e.g. AppContext.joinClub) need
// this to avoid claiming success on a silent server-side rejection.
export async function addClubMember(id: string, uid: string): Promise<boolean> {
  // Every path that adds a member (self-join, accept request, admin invite,
  // accept invite) routes through here — enforce max_members AND the
  // per-user tier club limit once, in the one place all of them share,
  // instead of duplicating the checks at each call site.
  const { data } = await supabase.from('clubs').select('name, member_ids, max_members').eq('id', id).maybeSingle();
  const row = data as { name?: string; member_ids?: string[]; max_members?: number } | null;
  const alreadyMember = (row?.member_ids ?? []).includes(uid);
  if (!alreadyMember) {
    if (row?.max_members != null && (row.member_ids?.length ?? 0) >= row.max_members) return false;
    // users_public (not users) — the actor here is often a club admin, not
    // the target user themselves, and the base users table is owner-read-only.
    const [{ data: userRow }, { data: memberOfRows }] = await Promise.all([
      supabase.from('users_public').select('tier').eq('uid', uid).maybeSingle(),
      supabase.from('clubs').select('id').contains('member_ids', [uid]),
    ]);
    const tier = ((userRow as { tier?: Tier } | null)?.tier) ?? 'Beginner';
    if ((memberOfRows?.length ?? 0) >= maxClubsForTier(tier)) return false;
  }
  await mutateClubArray(id, 'member_ids', [uid], []);
  await mutateClubArray(id, 'pending_ids', [], [uid]);
  // Reaches the new member even with their app fully closed — same write-time
  // pattern as notifyUser calls in sendSharedMessage/sendChallengeDoc, since
  // the joiner's own client (if it's even open) has no way to know an admin
  // just accepted/added them from their side.
  if (!alreadyMember) notifyUser(uid, { type: 'club_accepted', title: 'Joined Club', body: row?.name ? `You joined ${row.name}!` : 'You joined a new club!' });
  return true;
}
export async function removeClubMember(id: string, uid: string) {
  await mutateClubArray(id, 'member_ids', [], [uid]);
  await mutateClubArray(id, 'moderator_ids', [], [uid]);
}
export async function addClubPending(id: string, uid: string) {
  await mutateClubArray(id, 'pending_ids', [uid], []);
}
// notifyDecline distinguishes an admin declining someone else's request (push
// them the bad news) from a requester cancelling their own — same underlying
// mutation either way, called from two different AppContext callbacks.
export async function removeClubPending(id: string, uid: string, notifyDecline = false) {
  await mutateClubArray(id, 'pending_ids', [], [uid]);
  if (notifyDecline) notifyUser(uid, { type: 'club_declined', title: 'Request Declined', body: 'Your request to join a club was declined.' });
}
export async function setClubModerator(id: string, uid: string, isModerator: boolean) {
  await mutateClubArray(id, 'moderator_ids', isModerator ? [uid] : [], isModerator ? [] : [uid]);
}

export async function sendClubMessageDoc(clubId: string, msg: ClubMessage) {
  await supabase.from('club_messages').insert({ id: msg.id, club_id: clubId, sender_id: msg.senderId, sender_name: msg.senderName, text: msg.text, sent_at: msg.sentAt });
}

// ── Tournaments ─────────────────────────────────────────────────────────────
// Was local-React-state-only until now (see DEVLOG) — a hosted event never
// left the tab that created it. Mirrors the clubs pattern above: real row in
// Supabase, host_uid is a real uid (AppContext translates it to/from the
// local 'me' convention), realtime subscription is the source of truth.

function tournamentRowToObj(row: Record<string, unknown>): Tournament {
  return {
    id: row.id as string, isDummy: row.is_dummy as boolean | undefined, country: row.country as string | undefined,
    name: row.name as string, type: row.type as Tournament['type'], status: row.status as Tournament['status'],
    prizePool: row.prize_pool as number, entryFee: row.entry_fee as number, minMMR: row.min_mmr as number | undefined,
    maxMMR: row.max_mmr as number | undefined, maxPlayers: row.max_players as number, currentPlayers: row.current_players as number,
    state: row.state as MalaysiaState, venue: row.venue as string, date: row.date as string, time: row.time as string | undefined,
    isPrivate: row.is_private as boolean | undefined, bracket: row.bracket as Tournament['bracket'], tags: (row.tags as string[]) ?? [],
    description: row.description as string | undefined, organiser: row.organiser as string | undefined,
    hostUid: row.host_uid as string | undefined, participants: row.participants as Tournament['participants'],
    pendingRequesterIds: (row.pending_requester_ids as string[]) ?? [],
    championUsername: row.champion_username as string | undefined,
    championDisplayName: row.champion_display_name as string | undefined,
  };
}

function tournamentObjToRow(t: Tournament): Record<string, unknown> {
  return {
    id: t.id, is_dummy: t.isDummy, country: t.country, name: t.name, type: t.type, status: t.status,
    prize_pool: t.prizePool, entry_fee: t.entryFee, min_mmr: t.minMMR, max_mmr: t.maxMMR,
    max_players: t.maxPlayers, current_players: t.currentPlayers, state: t.state, venue: t.venue,
    date: t.date, time: t.time, is_private: t.isPrivate, bracket: t.bracket, tags: t.tags,
    description: t.description, organiser: t.organiser, host_uid: t.hostUid, participants: t.participants,
    pending_requester_ids: t.pendingRequesterIds,
    champion_username: t.championUsername, champion_display_name: t.championDisplayName,
  };
}

export function subscribeTournaments(cb: (tournaments: Tournament[]) => void): () => void {
  const load = async () => {
    const { data } = await supabase.from('tournaments').select('*');
    cb((data ?? []).map(tournamentRowToObj));
  };
  load();
  const channel = freshChannel('tournaments')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tournaments' }, load)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// Seeds the static demo tournaments into Supabase once, so they're visible
// to every real account instead of only the browser tab that happened to
// initialize local state first.
export async function ensureSeedTournamentsExist(seedTournaments: Tournament[]): Promise<void> {
  await Promise.all(seedTournaments.map(async t => {
    const { data: existing } = await supabase.from('tournaments').select('id').eq('id', t.id).maybeSingle();
    if (!existing) await supabase.from('tournaments').insert(tournamentObjToRow(t));
  }));
}

export async function createTournamentDoc(t: Tournament) {
  const { error } = await supabase.from('tournaments').insert(tournamentObjToRow(t));
  if (error) throw error;
}

export async function updateTournamentDoc(id: string, patch: Partial<Tournament>) {
  await supabase.from('tournaments').update(tournamentObjToRow(patch as Tournament)).eq('id', id);
}

// "Request to Join" for private tournaments — mirrors mutateClubArray/
// addClubPending/removeClubPending above (same read-modify-write tradeoff).
async function mutateTournamentPending(id: string, add: string[], remove: string[]) {
  const { data } = await supabase.from('tournaments').select('pending_requester_ids').eq('id', id).maybeSingle();
  const row = data as { pending_requester_ids?: string[] } | null;
  const existing = (row?.pending_requester_ids ?? []).filter(u => !remove.includes(u));
  const next = [...new Set([...existing, ...add])];
  await supabase.from('tournaments').update({ pending_requester_ids: next }).eq('id', id);
}

export async function addTournamentPending(id: string, uid: string) {
  await mutateTournamentPending(id, [uid], []);
}
// notifyDecline distinguishes a host declining someone else's request from a
// requester cancelling their own — same shape as removeClubPending above.
export async function removeTournamentPending(id: string, uid: string, notifyDecline = false) {
  await mutateTournamentPending(id, [], [uid]);
  if (notifyDecline) notifyUser(uid, { type: 'tournament_declined', title: 'Request Declined', body: 'Your request to join an event was declined.' });
}

// Approve = add to participants/increment currentPlayers (same as
// registerTournament) + drop from the pending list, in one call.
export async function approveTournamentRequest(id: string, uid: string) {
  const [{ data }, profile] = await Promise.all([
    supabase.from('tournaments').select('name, current_players, participants').eq('id', id).maybeSingle(),
    lookupUserByUid(uid),
  ]);
  const row = data as { name?: string; current_players?: number; participants?: { displayName: string; username: string }[] } | null;
  if (profile?.displayName && profile?.username) {
    await supabase.from('tournaments').update({
      current_players: (row?.current_players ?? 0) + 1,
      participants: [...(row?.participants ?? []), { displayName: profile.displayName, username: profile.username }],
    }).eq('id', id);
  }
  await mutateTournamentPending(id, [], [uid]);
  notifyUser(uid, { type: 'tournament_accepted', title: 'Request Approved', body: row?.name ? `Your request to join ${row.name} was accepted!` : 'Your request to join an event was accepted!' });
}

export function subscribeClubMessages(clubId: string, cb: (msgs: ClubMessage[]) => void, max = 50): () => void {
  const load = async () => {
    const { data } = await supabase.from('club_messages').select('*').eq('club_id', clubId).order('sent_at', { ascending: false }).limit(max);
    cb((data ?? []).map(r => ({ id: r.id as string, senderId: r.sender_id as string, senderName: r.sender_name as string, text: r.text as string, sentAt: r.sent_at as string })).reverse());
  };
  load();
  const channel = freshChannel(`club_messages:${clubId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'club_messages', filter: `club_id=eq.${clubId}` }, load)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// Legacy embedded-clubMessages migration is no longer relevant — club_messages
// has always been its own table in the Supabase schema (no `clubMessages`
// column on `clubs` to migrate off of). Kept as a no-op for call-site compat.
export async function migrateLegacyClubMessages(_clubId: string, _legacyMessages: ClubMessage[]): Promise<void> { /* no-op, see note above */ }

// ── Real matches between two real accounts ─────────────────────────────────────

export interface StoredMatch {
  id: string; type: string; participantUids: string[]; reporterUid: string;
  player1Id: string; player1Name: string; player1Username: string;
  player2Id: string; player2Name: string; player2Username: string;
  winnerId: string; games: { p1: number; p2: number }[]; status: 'Pending' | 'Confirmed' | 'Disputed' | 'Cancelled';
  mmrChange?: number; mode?: 'ranked' | 'casual'; playedAt: string; location?: string;
  pendingConfirmations: string[]; mmrAppliedBy: string[]; pointLog?: ('a' | 'b')[][];
  recordedLive?: boolean; liveStats?: LiveMatchStats; disputedBy?: string;
  clipUrl?: string; shuttleHits?: number[];
}

// mmrAppliedBy, reporterUid, pointLog, recordedLive, liveStats, disputedBy,
// clipUrl, shuttleHits, and mode have no columns in the `matches` table (0002)
// — stored inside `live_stats` jsonb (unused for these plain reported matches)
// as a small side-channel rather than adding new columns.
interface ExtraMeta {
  reporterUid: string; mmrAppliedBy: string[]; pointLog?: ('a' | 'b')[][];
  recordedLive?: boolean; liveStats?: LiveMatchStats; disputedBy?: string;
  clipUrl?: string; shuttleHits?: number[]; mode?: 'ranked' | 'casual';
}

function matchRowToStored(row: Record<string, unknown>): StoredMatch {
  const extra = (row.live_stats as ExtraMeta | null) ?? { reporterUid: row.player1_id as string, mmrAppliedBy: [] };
  return {
    id: row.id as string, type: row.type as string,
    participantUids: [row.player1_id as string, row.player2_id as string],
    reporterUid: extra.reporterUid,
    player1Id: row.player1_id as string, player1Name: row.player1_name as string, player1Username: row.player1_username as string,
    player2Id: row.player2_id as string, player2Name: row.player2_name as string, player2Username: row.player2_username as string,
    winnerId: row.winner_id as string, games: row.games as StoredMatch['games'], status: row.status as StoredMatch['status'],
    mmrChange: row.mmr_change as number | undefined, mode: extra.mode, playedAt: row.played_at as string, location: row.location as string | undefined,
    pendingConfirmations: (row.pending_confirmations as string[]) ?? [], mmrAppliedBy: extra.mmrAppliedBy ?? [],
    pointLog: extra.pointLog, recordedLive: extra.recordedLive, liveStats: extra.liveStats, disputedBy: extra.disputedBy,
    clipUrl: extra.clipUrl, shuttleHits: extra.shuttleHits,
  };
}

// ponytail: Realtime can't filter "player1_id = me OR player2_id = me" — same
// unfiltered-subscribe-then-refetch tradeoff as conversations.
export function subscribeMyRealMatches(myUid: string, cb: (docs: StoredMatch[]) => void): () => void {
  let cancelled = false;
  const load = async () => {
    const { data } = await supabase.from('matches').select('*').or(`player1_id.eq.${myUid},player2_id.eq.${myUid}`);
    if (!cancelled) cb((data ?? []).map(matchRowToStored));
  };
  load();
  const channel = freshChannel(`my_matches:${myUid}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, load)
    .subscribe();
  return () => { cancelled = true; supabase.removeChannel(channel); };
}

// Confirmed singles matches between two members of the same set of uids —
// powers the club ladder (a club-internal win/loss record, computed from
// matches that already exist rather than a new parallel ranking system).
// `matches` has public-read RLS, so this isn't limited to "my" matches like
// subscribeMyRealMatches above — .in() on both columns correctly requires
// BOTH players of a match to be in the given uid set.
export function subscribeMatchesAmong(uids: string[], cb: (docs: StoredMatch[]) => void): () => void {
  if (uids.length === 0) { cb([]); return () => {}; }
  let cancelled = false;
  const load = async () => {
    const { data } = await supabase.from('matches').select('*')
      .in('player1_id', uids).in('player2_id', uids)
      .in('type', ['MS', 'WS']).eq('status', 'Confirmed');
    if (!cancelled) cb((data ?? []).map(matchRowToStored));
  };
  load();
  const channel = freshChannel(`club_ladder:${uids.slice().sort().join(',')}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, load)
    .subscribe();
  return () => { cancelled = true; supabase.removeChannel(channel); };
}

// Confirmed singles matches involving ANY of the given uids on either side —
// unlike subscribeMatchesAmong, the other side doesn't have to be in the same
// set. Powers club-vs-club rivalry records (clubRivalry.ts computes the
// per-rival-club breakdown from this raw list client-side).
export function subscribeMatchesForClubMembers(uids: string[], cb: (docs: StoredMatch[]) => void): () => void {
  if (uids.length === 0) { cb([]); return () => {}; }
  let cancelled = false;
  const list = uids.join(',');
  const load = async () => {
    const { data } = await supabase.from('matches').select('*')
      .or(`player1_id.in.(${list}),player2_id.in.(${list})`)
      .in('type', ['MS', 'WS']).eq('status', 'Confirmed');
    if (!cancelled) cb((data ?? []).map(matchRowToStored));
  };
  load();
  const channel = freshChannel(`club_rivalry:${uids.slice().sort().join(',')}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, load)
    .subscribe();
  return () => { cancelled = true; supabase.removeChannel(channel); };
}

export async function sendMatchDoc(m: StoredMatch) {
  const extra: ExtraMeta = {
    reporterUid: m.reporterUid, mmrAppliedBy: m.mmrAppliedBy, pointLog: m.pointLog,
    recordedLive: m.recordedLive, liveStats: m.liveStats, disputedBy: m.disputedBy,
    clipUrl: m.clipUrl, shuttleHits: m.shuttleHits, mode: m.mode,
  };
  await supabase.from('matches').insert({
    id: m.id, type: m.type, player1_id: m.player1Id, player1_name: m.player1Name, player1_username: m.player1Username,
    player2_id: m.player2Id, player2_name: m.player2Name, player2_username: m.player2Username, winner_id: m.winnerId,
    games: m.games, status: m.status, mmr_change: m.mmrChange, played_at: m.playedAt, location: m.location,
    pending_confirmations: m.pendingConfirmations, live_stats: extra,
  });
}

export async function confirmSharedMatch(id: string, confirmingUid: string) {
  const { data } = await supabase.from('matches').select('pending_confirmations').eq('id', id).maybeSingle();
  const remaining = ((data?.pending_confirmations as string[] | undefined) ?? []).filter(u => u !== confirmingUid);
  // Only finalize once every other confirmer has signed off too - matches
  // the local-match multi-party path in AppContext.confirmMatch, which stays
  // 'Pending' (and doesn't apply MMR) until remaining.length === 0. Real
  // cross-account matches only ever have one pending confirmer today (addMatch
  // routes doubles/multi-party matches to the local path), so this is
  // currently a no-op in practice - but it stops the first confirmer from
  // finalizing a match while a second confirmation is still outstanding, the
  // moment that changes.
  const patch: { pending_confirmations: string[]; status?: string } = { pending_confirmations: remaining };
  if (remaining.length === 0) patch.status = 'Confirmed';
  await supabase.from('matches').update(patch).eq('id', id);
}

async function patchExtra(id: string, patch: Partial<ExtraMeta>) {
  const { data } = await supabase.from('matches').select('live_stats').eq('id', id).maybeSingle();
  const extra = { ...(data?.live_stats as ExtraMeta | null), ...patch };
  await supabase.from('matches').update({ live_stats: extra }).eq('id', id);
}

export async function disputeSharedMatch(id: string, disputingUid: string) {
  await patchExtra(id, { disputedBy: disputingUid });
  await supabase.from('matches').update({ status: 'Disputed' }).eq('id', id);
}

// Re-submit model: disputing an existing result doesn't require an admin —
// the disputer proposes a corrected score, which goes back to the original
// reporter to confirm or dispute in turn (same pendingConfirmations flow
// already used for the initial report). Keeps the mmr delta's MAGNITUDE as
// originally computed and just re-signs it for the (possibly new) winner —
// ponytail: doesn't re-run calcMMRChange with live current MMRs, which would
// need an extra fetch; revisit if a winner-flip on a lopsided original MMR
// gap turns out to matter in practice.
export async function resubmitSharedMatch(id: string, resubmittingUid: string, games: { p1: number; p2: number }[], winnerId: string, reporterMmrChange: number) {
  const { data } = await supabase.from('matches').select('player1_id, player2_id').eq('id', id).maybeSingle();
  const player1Id = data?.player1_id as string | undefined;
  const player2Id = data?.player2_id as string | undefined;
  if (!player1Id || !player2Id) return;
  const recipient = resubmitRecipient(resubmittingUid, player1Id, player2Id);
  await patchExtra(id, { disputedBy: undefined });
  await supabase.from('matches').update({
    games, winner_id: winnerId, mmr_change: reporterMmrChange,
    status: 'Pending', pending_confirmations: [recipient],
  }).eq('id', id);
}

export async function cancelSharedMatch(id: string) {
  await supabase.from('matches').update({ status: 'Cancelled', pending_confirmations: [] }).eq('id', id);
}

export async function markMatchMmrApplied(id: string, uid: string) {
  const { data } = await supabase.from('matches').select('live_stats').eq('id', id).maybeSingle();
  const extra = (data?.live_stats as ExtraMeta | null) ?? { reporterUid: uid, mmrAppliedBy: [] };
  if (!extra.mmrAppliedBy.includes(uid)) extra.mmrAppliedBy = [...extra.mmrAppliedBy, uid];
  await supabase.from('matches').update({ live_stats: extra }).eq('id', id);
}

// ── Availability ("who's playing this week") ───────────────────────────────
// Requires migration 0007_availability.sql to be applied — see that file.

function availabilityRowToEntry(row: Record<string, unknown>): AvailabilityEntry {
  return {
    id: row.id as string, uid: row.uid as string,
    displayName: row.display_name as string, username: row.username as string,
    day: row.day as string, timeLabel: row.time_label as AvailabilityEntry['timeLabel'],
    venue: row.venue as string | undefined, note: row.note as string | undefined,
    createdAt: row.created_at as string,
  };
}

// Only ever queries today-forward — past entries just age out of every
// result set, no cleanup job needed.
export function subscribeAvailability(cb: (entries: AvailabilityEntry[]) => void): () => void {
  const load = async () => {
    const today = localDateISO();
    const { data } = await supabase.from('availability').select('*').gte('day', today).order('day', { ascending: true });
    cb((data ?? []).map(availabilityRowToEntry));
  };
  load();
  const channel = freshChannel('availability')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'availability' }, load)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

export async function createAvailabilityEntry(e: Omit<AvailabilityEntry, 'id' | 'createdAt'>): Promise<void> {
  const { error } = await supabase.from('availability').insert({
    uid: e.uid, display_name: e.displayName, username: e.username,
    day: e.day, time_label: e.timeLabel, venue: e.venue || null, note: e.note || null,
  });
  if (error) throw error;
}

export async function deleteAvailabilityEntry(id: string): Promise<void> {
  const { error } = await supabase.from('availability').delete().eq('id', id);
  if (error) throw error;
}

// ── Venues (crowd-sourced court/venue directory) ────────────────────────────
// Requires migration 0008_venues.sql to be applied — see that file.

function venueRowToVenue(row: Record<string, unknown>): Venue {
  return {
    id: row.id as string, name: row.name as string,
    state: row.state as MalaysiaState, addedBy: row.added_by as string,
    createdAt: row.created_at as string,
  };
}

export function subscribeVenues(cb: (venues: Venue[]) => void): () => void {
  const load = async () => {
    const { data } = await supabase.from('venues').select('*').order('name', { ascending: true });
    cb((data ?? []).map(venueRowToVenue));
  };
  load();
  const channel = freshChannel('venues')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'venues' }, load)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

export async function createVenue(v: Omit<Venue, 'id' | 'createdAt'>): Promise<void> {
  const { error } = await supabase.from('venues').insert({ name: v.name, state: v.state, added_by: v.addedBy });
  if (error) throw error;
}
