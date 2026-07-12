// One-time Firebase → Supabase data migration. Run with:
//   node scripts/migrate-to-supabase.mjs
// Needs env vars: FIREBASE_SERVICE_ACCOUNT_PATH, SUPABASE_URL, SUPABASE_SECRET_KEY
// (secret key bypasses RLS for bulk inserts, same as service_role).

import { readFileSync } from 'fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { createClient } from '@supabase/supabase-js';

const serviceAccount = JSON.parse(readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const fdb = getFirestore();
const fauth = getAuth();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);

async function migrateUsers() {
  const snap = await fdb.collection('users').get();
  let n = 0;
  for (const doc of snap.docs) {
    const u = doc.data();
    const { error } = await supabase.from('users').upsert({
      uid: doc.id,
      username: u.username, is_dummy: u.isDummy ?? null, display_name: u.displayName, email: u.email,
      mmr: u.mmr ?? 1200, tier: u.tier ?? 'Beginner',
      placement_matches_played: u.placementMatchesPlayed ?? null,
      global_rank: u.globalRank ?? null, state: u.state ?? null, area: u.area ?? null,
      wins: u.stats?.wins ?? 0, losses: u.stats?.losses ?? 0, total_matches: u.stats?.totalMatches ?? 0,
      bio: u.bio ?? null, available: u.available ?? null, open_to_play: u.openToPlay ?? null,
      gender: u.gender ?? null, postcode: u.postcode ?? null, discipline_mmr: u.disciplineMMR ?? null,
      looking_for_partner: u.lookingForPartner ?? null, preferred_formats: u.preferredFormats ?? null,
      joined_at: u.joinedAt ?? new Date().toISOString(), birthday: u.birthday ?? null,
      country: u.country ?? null, country_code: u.countryCode ?? null, region: u.region ?? null,
      endorsements: u.endorsements ?? null, photo_url: u.photoURL ?? null, is_private: u.isPrivate ?? null,
      followers_count: u.followersCount ?? null, following_count: u.followingCount ?? null,
      clip_credits: u.clipCredits ?? null, clip_badge: u.clipBadge ?? null,
      court_profile: u.courtProfile ?? null, privacy: u.privacy ?? null,
    });
    if (error) console.error('user', doc.id, error.message);
    else n++;

    // subcollections
    await migrateSubcollection(doc.ref.collection('matches'), 'matches', matchRow(doc.id));
    await migrateSubcollection(doc.ref.collection('plannedMatches'), 'planned_matches', row => ({ host_uid: doc.id, ...row }));
    await migrateSubcollection(doc.ref.collection('tournamentRegs'), 'tournament_registrations', row => ({ user_id: doc.id, tournament_id: row.tournamentId ?? row.id }));
    await migrateSubcollection(doc.ref.collection('friends'), 'friends', row => ({ user_id: doc.id, friend_id: row.friendId ?? row.id }));
    await migrateSubcollection(doc.ref.collection('endorsements'), 'endorsements', row => ({ to_uid: doc.id, from_uid: row.fromUid, skill: row.skill }));
  }
  console.log(`users: ${n}/${snap.size} migrated`);
}

function matchRow(ownerUid) {
  return m => ({
    id: m.id, type: m.type,
    player1_id: m.player1Id, player1_name: m.player1Name, player1_username: m.player1Username,
    player1_partner_id: m.player1PartnerId ?? null, player1_partner_name: m.player1PartnerName ?? null, player1_partner_username: m.player1PartnerUsername ?? null,
    player2_id: m.player2Id, player2_name: m.player2Name, player2_username: m.player2Username,
    player2_partner_id: m.player2PartnerId ?? null, player2_partner_name: m.player2PartnerName ?? null, player2_partner_username: m.player2PartnerUsername ?? null,
    winner_id: m.winnerId ?? null, games: m.games, status: m.status, mmr_change: m.mmrChange ?? null,
    played_at: m.playedAt, location: m.location ?? null, venue: m.venue ?? null,
    pending_confirmations: m.pendingConfirmations ?? null, planned_match_id: m.plannedMatchId ?? null,
    recorded_live: m.recordedLive ?? null, live_stats: m.liveStats ?? null,
  });
}

async function migrateSubcollection(ref, table, toRow) {
  const snap = await ref.get();
  for (const doc of snap.docs) {
    const row = toRow({ id: doc.id, ...doc.data() });
    const { error } = await supabase.from(table).upsert(row);
    if (error) console.error(table, doc.id, error.message);
  }
}

async function migrateTopLevel(collectionName, table, toRow) {
  const snap = await fdb.collection(collectionName).get();
  let n = 0;
  for (const doc of snap.docs) {
    const { error } = await supabase.from(table).upsert(toRow({ id: doc.id, ...doc.data() }));
    if (error) console.error(table, doc.id, error.message);
    else n++;
  }
  console.log(`${collectionName}: ${n}/${snap.size} migrated`);
}

async function migrateClubs() {
  const snap = await fdb.collection('clubs').get();
  let n = 0;
  for (const doc of snap.docs) {
    const c = doc.data();
    const { error } = await supabase.from('clubs').upsert({
      id: doc.id, is_dummy: c.isDummy ?? null, name: c.name, short_name: c.shortName, description: c.description,
      purpose: c.purpose, state: c.state ?? null, area: c.area ?? null, logo_initials: c.logoInitials,
      color: c.color, max_members: c.maxMembers, min_mmr: c.minMMR ?? null, is_private: c.isPrivate,
      admin_id: c.adminId, moderator_ids: c.moderatorIds ?? null, member_ids: c.memberIds ?? [],
      pending_ids: c.pendingIds ?? [], avg_mmr: c.avgMMR ?? null, top_players: c.topPlayers ?? null,
      tags: c.tags ?? null, founded_year: c.foundedYear ?? null, announcement: c.announcement ?? null,
    });
    if (error) console.error('club', doc.id, error.message);
    else n++;
    const msgs = await doc.ref.collection('messages').get();
    for (const m of msgs.docs) {
      const d = m.data();
      const { error: e2 } = await supabase.from('club_messages').upsert({
        id: m.id, club_id: doc.id, sender_id: d.senderId, sender_name: d.senderName, text: d.text, sent_at: d.sentAt,
      });
      if (e2) console.error('club_message', m.id, e2.message);
    }
  }
  console.log(`clubs: ${n}/${snap.size} migrated`);
}

async function migrateAuthUsers() {
  // Records existing Firebase Auth users into Supabase Auth (email only — password
  // cannot be carried over). Users get a password-reset email on first Supabase login.
  let pageToken, total = 0;
  do {
    const page = await fauth.listUsers(1000, pageToken);
    for (const u of page.users) {
      const { error } = await supabase.auth.admin.createUser({
        uid: u.uid, email: u.email, email_confirm: true,
      });
      if (error && !error.message.includes('already been registered')) console.error('auth', u.uid, error.message);
      else total++;
    }
    pageToken = page.pageToken;
  } while (pageToken);
  console.log(`auth users: ${total} migrated`);
}

async function main() {
  console.log('Starting migration (idempotent — safe to re-run)...');
  await migrateAuthUsers();
  await migrateUsers();
  await migrateClubs();
  await migrateTopLevel('liveMatches', 'live_matches', d => ({
    id: d.id, join_code: d.joinCode, format: d.format, team_a: d.teamA, team_b: d.teamB,
    team_a_name: d.teamAName, team_b_name: d.teamBName, venue: d.venue ?? null, host_uid: d.hostUid,
    best_of: d.bestOf, status: d.status, current_game: d.currentGame, games: d.games,
    game_wins: d.gameWins, winning_side: d.winningSide ?? null, created_at: d.createdAt,
    completed_at: d.completedAt ?? null, clip_url: d.clipUrl ?? null, record_mode: d.recordMode ?? null,
    live_stats: d.liveStats ?? null, active_seconds_accumulated: d.activeSecondsAccumulated ?? null,
  }));
  await migrateTopLevel('courtSessions', 'court_sessions', d => ({
    id: d.id, join_code: d.joinCode, host_uid: d.hostUid, status: d.status, positions: d.positions ?? [],
    created_at: d.createdAt, planned_match_id: d.plannedMatchId ?? null, venue: d.venue ?? null,
  }));
  await migrateTopLevel('challenges', 'challenges', d => ({
    id: d.id, from_id: d.fromId, from_name: d.fromName, from_username: d.fromUsername,
    to_id: d.toId, to_name: d.toName, to_username: d.toUsername, format: d.format, venue: d.venue,
    date: d.date, message: d.message ?? null, status: d.status, created_at: d.createdAt,
  }));
  await migrateTopLevel('matches', 'matches', matchRow(null));
  console.log('Done. Storage files (photos/clips) are migrated separately — see migrate-storage.mjs.');
}

main().catch(e => { console.error(e); process.exit(1); });
