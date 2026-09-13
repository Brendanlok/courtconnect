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

// Firebase auth uids ("0aSDcrl...") aren't UUIDs, but Supabase auth.users.id must be —
// Supabase assigns its own UUID per user, so every reference to a Firebase uid elsewhere
// has to go through this map instead of being copied as-is.
const uidMap = new Map(); // firebase uid -> supabase uuid
const mapUid = fbUid => (fbUid ? uidMap.get(fbUid) ?? null : null);
const mapUids = arr => (arr ?? []).map(mapUid).filter(Boolean);

// Firestore Timestamp -> ISO string. Admin SDK gives real Timestamp objects with
// .toDate(); anything else (already a string, or missing) passes through as-is.
const ts = v => (v?.toDate ? v.toDate().toISOString() : (typeof v === 'string' ? v : null));

async function migrateAuthUsers() {
  // Existing Firebase Auth users → Supabase Auth (email only, password can't carry
  // over). Users get a password-reset email on first Supabase login (separate step).
  let pageToken, total = 0;
  do {
    const page = await fauth.listUsers(1000, pageToken);
    for (const u of page.users) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: u.email, email_confirm: true,
      });
      if (error) { console.error('auth', u.uid, error.message); continue; }
      uidMap.set(u.uid, data.user.id);
      total++;
    }
    pageToken = page.pageToken;
  } while (pageToken);
  console.log(`auth users: ${total} migrated`);
}

async function migrateUsers() {
  const snap = await fdb.collection('users').get();
  let n = 0;
  for (const doc of snap.docs) {
    const u = doc.data();
    const uid = mapUid(doc.id);
    if (!uid) { console.error('user', doc.id, 'no matching auth account, skipped'); continue; }
    const { error } = await supabase.from('users').upsert({
      uid,
      username: u.username, is_dummy: u.isDummy ?? null, display_name: u.displayName, email: u.email,
      mmr: u.mmr ?? 1200, tier: u.tier ?? 'Beginner',
      placement_matches_played: u.placementMatchesPlayed ?? null,
      global_rank: u.globalRank ?? null, state: u.state ?? null, area: u.area ?? null,
      wins: u.stats?.wins ?? 0, losses: u.stats?.losses ?? 0, total_matches: u.stats?.totalMatches ?? 0,
      bio: u.bio ?? null, available: u.available ?? null, open_to_play: u.openToPlay ?? null,
      gender: u.gender ?? null, postcode: u.postcode ?? null, discipline_mmr: u.disciplineMMR ?? null,
      looking_for_partner: u.lookingForPartner ?? null, preferred_formats: u.preferredFormats ?? null,
      joined_at: ts(u.joinedAt) ?? new Date().toISOString(), birthday: u.birthday ?? null,
      country: u.country ?? null, country_code: u.countryCode ?? null, region: u.region ?? null,
      endorsements: u.endorsements ?? null, photo_url: u.photoURL ?? null, is_private: u.isPrivate ?? null,
      followers_count: u.followersCount ?? null, following_count: u.followingCount ?? null,
      clip_credits: u.clipCredits ?? null, clip_badge: u.clipBadge ?? null,
      court_profile: u.courtProfile ?? null, privacy: u.privacy ?? null,
    });
    if (error) console.error('user', doc.id, error.message);
    else n++;

    await migrateSubcollection(doc.ref.collection('matches'), 'matches', matchRow);
    await migrateSubcollection(doc.ref.collection('plannedMatches'), 'planned_matches', row => ({
      id: row.id, host_uid: uid, format: row.format ?? null, venue: row.venue ?? null,
      date: ts(row.date), status: row.status ?? 'upcoming', live_match_id: row.liveMatchId ?? null,
      data: row,
    }));
    await migrateSubcollection(doc.ref.collection('tournamentRegs'), 'tournament_registrations', row => ({
      tournament_id: row.tournamentId ?? row.id, user_id: uid,
    }));
    await migrateSubcollection(doc.ref.collection('friends'), 'friends', row => ({
      user_id: uid, friend_id: mapUid(row.friendId ?? row.id),
    }), r => r.friend_id);
    await migrateSubcollection(doc.ref.collection('endorsements'), 'endorsements', row => ({
      to_uid: uid, from_uid: mapUid(row.fromUid), skill: row.skill,
    }), r => r.from_uid);
  }
  console.log(`users: ${n}/${snap.size} migrated`);
}

function matchRow(m) {
  return {
    id: m.id, type: m.type,
    player1_id: mapUid(m.player1Id), player1_name: m.player1Name, player1_username: m.player1Username,
    player1_partner_id: mapUid(m.player1PartnerId), player1_partner_name: m.player1PartnerName ?? null, player1_partner_username: m.player1PartnerUsername ?? null,
    player2_id: mapUid(m.player2Id), player2_name: m.player2Name, player2_username: m.player2Username,
    player2_partner_id: mapUid(m.player2PartnerId), player2_partner_name: m.player2PartnerName ?? null, player2_partner_username: m.player2PartnerUsername ?? null,
    winner_id: mapUid(m.winnerId), games: m.games, status: m.status, mmr_change: m.mmrChange ?? null,
    played_at: ts(m.playedAt) ?? new Date().toISOString(), location: m.location ?? null, venue: m.venue ?? null,
    pending_confirmations: mapUids(m.pendingConfirmations), planned_match_id: m.plannedMatchId ?? null,
    recorded_live: m.recordedLive ?? null, live_stats: m.liveStats ?? null,
  };
}

// requiredField lets callers skip rows whose only foreign key (e.g. a friend/endorser
// uid) didn't resolve through uidMap — inserting null there would violate a not-null FK.
async function migrateSubcollection(ref, table, toRow, requiredField = () => true) {
  const snap = await ref.get();
  for (const doc of snap.docs) {
    const row = toRow({ id: doc.id, ...doc.data() });
    if (!requiredField(row)) { console.error(table, doc.id, 'unresolved uid, skipped'); continue; }
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
    const adminId = mapUid(c.adminId);
    if (!adminId) { console.error('club', doc.id, 'admin uid unresolved, skipped'); continue; }
    const { error } = await supabase.from('clubs').upsert({
      id: doc.id, is_dummy: c.isDummy ?? null, name: c.name, short_name: c.shortName, description: c.description,
      purpose: c.purpose, state: c.state ?? null, area: c.area ?? null, logo_initials: c.logoInitials,
      color: c.color, max_members: c.maxMembers, min_mmr: c.minMMR ?? null, is_private: c.isPrivate,
      admin_id: adminId, moderator_ids: mapUids(c.moderatorIds), member_ids: mapUids(c.memberIds),
      pending_ids: mapUids(c.pendingIds), avg_mmr: c.avgMMR ?? null, top_players: mapUids(c.topPlayers),
      tags: c.tags ?? null, founded_year: c.foundedYear ?? null, announcement: c.announcement ?? null,
    });
    if (error) console.error('club', doc.id, error.message);
    else n++;
    const msgs = await doc.ref.collection('messages').get();
    for (const m of msgs.docs) {
      const d = m.data();
      const { error: e2 } = await supabase.from('club_messages').upsert({
        id: m.id, club_id: doc.id, sender_id: mapUid(d.senderId), sender_name: d.senderName,
        text: d.text, sent_at: ts(d.sentAt) ?? new Date().toISOString(),
      });
      if (e2) console.error('club_message', m.id, e2.message);
    }
  }
  console.log(`clubs: ${n}/${snap.size} migrated`);
}

async function main() {
  console.log('Starting migration (idempotent — safe to re-run)...');
  await migrateAuthUsers();
  await migrateUsers();
  await migrateClubs();
  await migrateTopLevel('liveMatches', 'live_matches', d => ({
    id: d.id, join_code: d.joinCode, format: d.format, team_a: d.teamA, team_b: d.teamB,
    team_a_name: d.teamAName, team_b_name: d.teamBName, venue: d.venue ?? null, host_uid: mapUid(d.hostUid),
    best_of: d.bestOf, status: d.status, current_game: d.currentGame, games: d.games,
    game_wins: d.gameWins, winning_side: d.winningSide ?? null, created_at: ts(d.createdAt) ?? new Date().toISOString(),
    completed_at: ts(d.completedAt), clip_url: d.clipUrl ?? null, record_mode: d.recordMode ?? null,
    live_stats: d.liveStats ?? null, active_seconds_accumulated: d.activeSecondsAccumulated != null ? Math.round(d.activeSecondsAccumulated) : null,
  }));
  await migrateTopLevel('courtSessions', 'court_sessions', d => ({
    id: d.id, join_code: d.joinCode, host_uid: mapUid(d.hostUid), status: d.status, positions: d.positions ?? [],
    created_at: ts(d.createdAt) ?? new Date().toISOString(), planned_match_id: d.plannedMatchId ?? null, venue: d.venue ?? null,
  }));
  await migrateTopLevel('challenges', 'challenges', d => ({
    id: d.id, from_id: mapUid(d.fromId), from_name: d.fromName, from_username: d.fromUsername,
    to_id: mapUid(d.toId), to_name: d.toName, to_username: d.toUsername, format: d.format, venue: d.venue,
    date: ts(d.date) ?? d.date, message: d.message ?? null, status: d.status, created_at: ts(d.createdAt) ?? new Date().toISOString(),
  }));
  await migrateTopLevel('matches', 'matches', matchRow);
  console.log('Done. Storage files (photos/clips) are migrated separately — see migrate-storage.mjs.');
}

main().catch(e => { console.error(e); process.exit(1); });
