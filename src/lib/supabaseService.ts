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
import { getTier } from '@/lib/utils';
import type { Match, UserProfile, Club, ClubMessage, MalaysiaState, LiveMatchStats } from '@/types';

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
    placementMatchesPlayed: row.placement_matches_played as number | undefined,
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
    preferredFormats: row.preferred_formats as UserProfile['preferredFormats'],
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
    isDummy: 'is_dummy', displayName: 'display_name', mmr: 'mmr', tier: 'tier',
    placementMatchesPlayed: 'placement_matches_played', globalRank: 'global_rank', state: 'state', area: 'area',
    bio: 'bio', available: 'available', openToPlay: 'open_to_play', gender: 'gender', postcode: 'postcode',
    disciplineMMR: 'discipline_mmr', lookingForPartner: 'looking_for_partner', preferredFormats: 'preferred_formats',
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
export async function loadMatches(_uid: string): Promise<Match[]> { return []; }

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

export async function deletePlannedMatch(uid: string, matchId: string) {
  if (!uid || uid === 'me') return;
  await supabase.from('planned_matches').delete().eq('id', matchId).eq('host_uid', uid);
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

// ── Club membership ───────────────────────────────────────────────────────────

export async function saveClubMembership(_uid: string, _clubIds: string[]) {
  // no-op: club membership lives on the club row's member_ids (see clubs
  // section below), not a field on the user — nothing to write here.
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

// ── Friends ───────────────────────────────────────────────────────────────────

export async function saveFriend(uid: string, friendUid: string) {
  if (!uid || uid === 'me') return;
  await supabase.from('friends').upsert({ user_id: uid, friend_id: friendUid });
}

export async function removeFriendRecord(uid: string, friendUid: string) {
  if (!uid || uid === 'me') return;
  await supabase.from('friends').delete().eq('user_id', uid).eq('friend_id', friendUid);
}

export async function loadFriends(uid: string): Promise<string[]> {
  const { data } = await supabase.from('friends').select('friend_id').eq('user_id', uid);
  return (data ?? []).map(r => r.friend_id as string);
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
  const channel = supabase.channel(`live_match:${id}`)
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
  const channel = supabase.channel(`court_session:${id}`)
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
export interface SharedParticipant { displayName: string; username: string; tier: string; mmr: number; photoURL?: string | null }
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
  const { data } = await supabase.from('users').select('uid, display_name, username, tier, mmr, photo_url').in('uid', uids);
  const out: Record<string, SharedParticipant> = {};
  (data ?? []).forEach(r => {
    out[r.uid as string] = { displayName: r.display_name as string, username: r.username as string, tier: r.tier as string, mmr: r.mmr as number, photoURL: r.photo_url as string | null };
  });
  return out;
}

async function buildSharedConversation(row: { id: string; participant_ids: string[]; last_message: string | null; last_at: string | null }): Promise<SharedConversation> {
  const [messages, participants] = await Promise.all([loadConversationMessages(row.id), loadParticipantsMap(row.participant_ids ?? [])]);
  return { id: row.id, participantUids: row.participant_ids ?? [], participants, messages, lastMessage: row.last_message ?? '', lastAt: row.last_at ?? '' };
}

export function subscribeSharedConversation(chatId: string, cb: (c: SharedConversation | null) => void): () => void {
  let cancelled = false;
  const load = async () => {
    const { data } = await supabase.from('conversations').select('*').eq('id', chatId).maybeSingle();
    if (cancelled) return;
    cb(data ? await buildSharedConversation(data as never) : null);
  };
  load();
  const channel = supabase.channel(`conversation:${chatId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: `id=eq.${chatId}` }, load)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_messages', filter: `conversation_id=eq.${chatId}` }, load)
    .subscribe();
  return () => { cancelled = true; supabase.removeChannel(channel); };
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
  const channel = supabase.channel(`my_conversations:${myUid}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, load)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_messages' }, load)
    .subscribe();
  return () => { cancelled = true; supabase.removeChannel(channel); };
}

export async function sendSharedMessage(
  chatId: string, participantUids: string[], _participants: Record<string, SharedParticipant>, msg: ChatMessage,
) {
  await supabase.from('conversations').upsert({ id: chatId, participant_ids: participantUids, last_message: msg.text, last_at: msg.sentAt });
  await supabase.from('conversation_messages').insert({ id: msg.id, conversation_id: chatId, sender_id: msg.senderId, text: msg.text, sent_at: msg.sentAt });
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
  const channel = supabase.channel(`challenges:${col}:${myUid}`)
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
  const channel = supabase.channel(`endorsements:${myUid}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'endorsements', filter: `to_uid=eq.${myUid}` }, load)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

export async function loadEndorsementGiven(targetUid: string, fromUid: string): Promise<string[]> {
  const { data } = await supabase.from('endorsements').select('skill').eq('from_uid', fromUid).eq('to_uid', targetUid);
  return (data ?? []).map(r => r.skill as string);
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
    announcement: row.announcement as string | undefined,
  };
}

function clubObjToRow(c: Club): Record<string, unknown> {
  return {
    id: c.id, is_dummy: c.isDummy, name: c.name, short_name: c.shortName, description: c.description, purpose: c.purpose,
    state: c.state, area: c.area, logo_initials: c.logoInitials, color: c.color, max_members: c.maxMembers, min_mmr: c.minMMR,
    is_private: c.isPrivate, admin_id: c.adminId, moderator_ids: c.moderatorIds ?? [], member_ids: c.memberIds, pending_ids: c.pendingIds,
    avg_mmr: c.avgMMR, top_players: c.topPlayers, tags: c.tags, founded_year: c.foundedYear, announcement: c.announcement,
  };
}

export function subscribeClubs(cb: (clubs: Club[]) => void): () => void {
  const load = async () => {
    const { data } = await supabase.from('clubs').select('*');
    cb((data ?? []).map(clubRowToObj));
  };
  load();
  const channel = supabase.channel('clubs')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'clubs' }, load)
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// Seeds the static demo clubs into Supabase once, so real accounts can
// actually join them. club_messages is a separate table now — any seed
// clubMessages go there, not on the clubs row.
export async function ensureSeedClubsExist(seedClubs: Club[]): Promise<void> {
  await Promise.all(seedClubs.map(async c => {
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

export async function addClubMember(id: string, uid: string) {
  // Every path that adds a member (self-join, accept request, admin invite,
  // accept invite) routes through here — enforce max_members once, in the
  // one place all of them share, instead of duplicating the check at each
  // call site.
  const { data } = await supabase.from('clubs').select('member_ids, max_members').eq('id', id).maybeSingle();
  const row = data as { member_ids?: string[]; max_members?: number } | null;
  const alreadyMember = (row?.member_ids ?? []).includes(uid);
  if (!alreadyMember && row?.max_members != null && (row.member_ids?.length ?? 0) >= row.max_members) return;
  await mutateClubArray(id, 'member_ids', [uid], []);
  await mutateClubArray(id, 'pending_ids', [], [uid]);
}
export async function removeClubMember(id: string, uid: string) {
  await mutateClubArray(id, 'member_ids', [], [uid]);
  await mutateClubArray(id, 'moderator_ids', [], [uid]);
}
export async function addClubPending(id: string, uid: string) {
  await mutateClubArray(id, 'pending_ids', [uid], []);
}
export async function removeClubPending(id: string, uid: string) {
  await mutateClubArray(id, 'pending_ids', [], [uid]);
}
export async function setClubModerator(id: string, uid: string, isModerator: boolean) {
  await mutateClubArray(id, 'moderator_ids', isModerator ? [uid] : [], isModerator ? [] : [uid]);
}

export async function sendClubMessageDoc(clubId: string, msg: ClubMessage) {
  await supabase.from('club_messages').insert({ id: msg.id, club_id: clubId, sender_id: msg.senderId, sender_name: msg.senderName, text: msg.text, sent_at: msg.sentAt });
}

export function subscribeClubMessages(clubId: string, cb: (msgs: ClubMessage[]) => void, max = 50): () => void {
  const load = async () => {
    const { data } = await supabase.from('club_messages').select('*').eq('club_id', clubId).order('sent_at', { ascending: false }).limit(max);
    cb((data ?? []).map(r => ({ id: r.id as string, senderId: r.sender_id as string, senderName: r.sender_name as string, text: r.text as string, sentAt: r.sent_at as string })).reverse());
  };
  load();
  const channel = supabase.channel(`club_messages:${clubId}`)
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
  mmrChange?: number; playedAt: string; location?: string;
  pendingConfirmations: string[]; mmrAppliedBy: string[]; pointLog?: ('a' | 'b')[][];
  recordedLive?: boolean; liveStats?: LiveMatchStats;
}

// mmrAppliedBy, reporterUid, pointLog, recordedLive, and liveStats have no
// columns in the `matches` table (0002) — stored inside `live_stats` jsonb
// (unused for these plain reported matches) as a small side-channel rather
// than adding new columns.
interface ExtraMeta {
  reporterUid: string; mmrAppliedBy: string[]; pointLog?: ('a' | 'b')[][];
  recordedLive?: boolean; liveStats?: LiveMatchStats;
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
    mmrChange: row.mmr_change as number | undefined, playedAt: row.played_at as string, location: row.location as string | undefined,
    pendingConfirmations: (row.pending_confirmations as string[]) ?? [], mmrAppliedBy: extra.mmrAppliedBy ?? [],
    pointLog: extra.pointLog, recordedLive: extra.recordedLive, liveStats: extra.liveStats,
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
  const channel = supabase.channel(`my_matches:${myUid}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, load)
    .subscribe();
  return () => { cancelled = true; supabase.removeChannel(channel); };
}

export async function sendMatchDoc(m: StoredMatch) {
  const extra: ExtraMeta = {
    reporterUid: m.reporterUid, mmrAppliedBy: m.mmrAppliedBy, pointLog: m.pointLog,
    recordedLive: m.recordedLive, liveStats: m.liveStats,
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
  await supabase.from('matches').update({ pending_confirmations: remaining, status: 'Confirmed' }).eq('id', id);
}

export async function disputeSharedMatch(id: string) {
  await supabase.from('matches').update({ status: 'Disputed' }).eq('id', id);
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

// ── Timestamp helpers ─────────────────────────────────────────────────────────
// Postgres/PostgREST already returns timestamptz columns as ISO strings, so
// there's no Timestamp class to unwrap here (unlike Firestore) — kept as a
// pass-through for call-site compat.
export function toISOString(ts: unknown): string {
  if (!ts) return new Date().toISOString();
  if (typeof ts === 'string') return ts;
  return new Date().toISOString();
}
