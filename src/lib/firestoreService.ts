/**
 * Firestore persistence layer.
 * All writes go here; AppContext calls these alongside its local state updates.
 * Collections: users / matches / plannedMatches / tournamentRegistrations / clubMemberships / friendships
 */
import {
  doc, setDoc, deleteDoc, getDoc, getDocs, collection,
  query, where, orderBy, limit as fsLimit, serverTimestamp, updateDoc, deleteField, writeBatch,
  Timestamp, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Match, UserProfile, Tournament, Club, ClubMessage } from '@/types';

// ── User profile ──────────────────────────────────────────────────────────────

export async function saveUserProfile(uid: string, patch: Partial<UserProfile>) {
  if (!uid || uid === 'me') return; // skip seed user
  await updateDoc(doc(db, 'users', uid), { ...patch, updatedAt: serverTimestamp() });
}

export async function loadUserProfile(uid: string): Promise<Partial<UserProfile> | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? snap.data() as Partial<UserProfile> : null;
}

export async function lookupUserByUsername(username: string): Promise<Partial<UserProfile> | null> {
  const q = query(collection(db, 'users'), where('username', '==', username));
  const snaps = await getDocs(q);
  if (snaps.empty) return null;
  return snaps.docs[0].data() as Partial<UserProfile>;
}

export async function lookupUserByUid(uid: string): Promise<Partial<UserProfile> | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as Partial<UserProfile>) : null;
}

// ── Logged matches ────────────────────────────────────────────────────────────

export async function saveMatch(uid: string, match: Match) {
  if (!uid || uid === 'me') return;
  await setDoc(doc(db, 'users', uid, 'matches', match.id), {
    ...match,
    savedAt: serverTimestamp(),
  });
}

export async function loadMatches(uid: string): Promise<Match[]> {
  const snaps = await getDocs(collection(db, 'users', uid, 'matches'));
  return snaps.docs.map(d => d.data() as Match);
}

// ── Planned matches ───────────────────────────────────────────────────────────

export async function savePlannedMatch(uid: string, pm: object) {
  if (!uid || uid === 'me') return;
  const pmWithId = pm as { id: string };
  await setDoc(doc(db, 'users', uid, 'plannedMatches', pmWithId.id), {
    ...pm,
    savedAt: serverTimestamp(),
  });
}

export async function deletePlannedMatch(uid: string, matchId: string) {
  if (!uid || uid === 'me') return;
  await deleteDoc(doc(db, 'users', uid, 'plannedMatches', matchId));
}

export async function loadPlannedMatches(uid: string): Promise<object[]> {
  const snaps = await getDocs(collection(db, 'users', uid, 'plannedMatches'));
  return snaps.docs.map(d => d.data());
}

// ── Tournament registrations ──────────────────────────────────────────────────

export async function saveTournamentReg(uid: string, tournamentId: string, data: object) {
  if (!uid || uid === 'me') return;
  await setDoc(doc(db, 'users', uid, 'tournamentRegs', tournamentId), {
    ...data,
    tournamentId,
    savedAt: serverTimestamp(),
  });
}

export async function deleteTournamentReg(uid: string, tournamentId: string) {
  if (!uid || uid === 'me') return;
  await deleteDoc(doc(db, 'users', uid, 'tournamentRegs', tournamentId));
}

export async function loadTournamentRegs(uid: string): Promise<Record<string, { registeredAt: string }>> {
  const snaps = await getDocs(collection(db, 'users', uid, 'tournamentRegs'));
  const result: Record<string, { registeredAt: string }> = {};
  snaps.docs.forEach(d => {
    const data = d.data();
    result[d.id] = { registeredAt: data.registeredAt ?? new Date().toISOString() };
  });
  return result;
}

// ── Club membership ───────────────────────────────────────────────────────────

export async function saveClubMembership(uid: string, clubIds: string[]) {
  if (!uid || uid === 'me') return;
  await updateDoc(doc(db, 'users', uid), { myClubIds: clubIds, updatedAt: serverTimestamp() });
}

// ── Account deletion ──────────────────────────────────────────────────────────

// Deletes every known subcollection under this user plus the user doc itself.
// Firestore doesn't cascade-delete subcollections automatically, so each is
// cleared explicitly. Call before auth.deleteUser() so data isn't orphaned if
// the auth deletion succeeds but this fails partway.
export async function deleteAccountData(uid: string): Promise<void> {
  if (!uid || uid === 'me') return;
  const subcollections = ['matches', 'plannedMatches', 'tournamentRegs', 'friends', 'conversations'];
  for (const sub of subcollections) {
    const snaps = await getDocs(collection(db, 'users', uid, sub));
    await Promise.all(snaps.docs.map(d => deleteDoc(d.ref)));
  }
  await deleteDoc(doc(db, 'users', uid));
}

// ── Friends ───────────────────────────────────────────────────────────────────

export async function saveFriend(uid: string, friendUid: string) {
  if (!uid || uid === 'me') return;
  await setDoc(doc(db, 'users', uid, 'friends', friendUid), {
    friendUid,
    addedAt: serverTimestamp(),
  });
}

export async function removeFriendRecord(uid: string, friendUid: string) {
  if (!uid || uid === 'me') return;
  await deleteDoc(doc(db, 'users', uid, 'friends', friendUid));
}

export async function loadFriends(uid: string): Promise<string[]> {
  const snaps = await getDocs(collection(db, 'users', uid, 'friends'));
  return snaps.docs.map(d => d.id);
}

// ── User settings ─────────────────────────────────────────────────────────────

export async function saveOpenToPlay(uid: string, value: boolean) {
  if (!uid || uid === 'me') return;
  await updateDoc(doc(db, 'users', uid), { openToPlay: value, updatedAt: serverTimestamp() });
}

// ── Live matches ──────────────────────────────────────────────────────────────

import { onSnapshot } from 'firebase/firestore';
import type { LiveMatch } from '@/types';

export async function createLiveMatch(match: LiveMatch): Promise<void> {
  await setDoc(doc(db, 'liveMatches', match.id), {
    ...match,
    createdAt: serverTimestamp(),
  });
}

export async function updateLiveMatch(id: string, patch: Partial<LiveMatch>): Promise<void> {
  await updateDoc(doc(db, 'liveMatches', id), patch as Record<string, unknown>);
}

export async function getLiveMatchByCode(code: string): Promise<LiveMatch | null> {
  const q = query(collection(db, 'liveMatches'), where('joinCode', '==', code.toUpperCase()), where('status', '==', 'active'));
  const snaps = await getDocs(q);
  if (snaps.empty) return null;
  return snaps.docs[0].data() as LiveMatch;
}

export function subscribeLiveMatch(id: string, cb: (m: LiveMatch | null) => void): () => void {
  return onSnapshot(doc(db, 'liveMatches', id), snap => {
    cb(snap.exists() ? (snap.data() as LiveMatch) : null);
  });
}

// ── Conversations (chat messages) ─────────────────────────────────────────────

interface StoredConversation {
  id: string;
  participantUid: string;
  lastMessage: string;
  lastAt: string;
  unread: number;
  messages: Array<{ id: string; senderId: string; text: string; sentAt: string }>;
}

export async function saveConversation(uid: string, conv: StoredConversation) {
  if (!uid || uid === 'me') return;
  await setDoc(doc(db, 'users', uid, 'conversations', conv.id), {
    ...conv,
    savedAt: serverTimestamp(),
  });
}

export async function loadConversations(uid: string): Promise<StoredConversation[]> {
  const snaps = await getDocs(collection(db, 'users', uid, 'conversations'));
  return snaps.docs.map(d => d.data() as StoredConversation);
}

// ── Real chat between two real accounts (one shared doc, not per-user copies) ─

export function chatIdFor(a: string, b: string): string {
  return [a, b].sort().join('_');
}

export interface ChatMessage { id: string; senderId: string; text: string; sentAt: string }

export interface SharedParticipant { displayName: string; username: string; tier: string; mmr: number; photoURL?: string | null }

export interface SharedConversation {
  id: string;
  participantUids: string[];
  participants: Record<string, SharedParticipant>;
  messages: ChatMessage[];
  lastMessage: string;
  lastAt: string;
}

export function subscribeSharedConversation(chatId: string, cb: (c: SharedConversation | null) => void): () => void {
  return onSnapshot(doc(db, 'conversations', chatId), snap => {
    cb(snap.exists() ? (snap.data() as SharedConversation) : null);
  });
}

export function subscribeMySharedConversations(myUid: string, cb: (cs: SharedConversation[]) => void): () => void {
  const q = query(collection(db, 'conversations'), where('participantUids', 'array-contains', myUid));
  return onSnapshot(q, snap => cb(snap.docs.map(d => d.data() as SharedConversation)));
}

export async function sendSharedMessage(
  chatId: string, participantUids: string[], participants: Record<string, SharedParticipant>, msg: ChatMessage,
) {
  await setDoc(doc(db, 'conversations', chatId), {
    id: chatId,
    participantUids,
    participants,
    messages: arrayUnion(msg),
    lastMessage: msg.text,
    lastAt: msg.sentAt,
  }, { merge: true });
}

// ── Real challenges between two real accounts (shared collection) ─────────────

export interface StoredChallenge {
  id: string;
  fromUid: string; fromName: string; fromUsername: string;
  toUid: string; toName: string; toUsername: string;
  format: string; venue: string; date: string; message?: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  createdAt: string;
}

export function subscribeChallengesFor(field: 'fromUid' | 'toUid', myUid: string, cb: (docs: StoredChallenge[]) => void): () => void {
  const q = query(collection(db, 'challenges'), where(field, '==', myUid));
  return onSnapshot(q, snap => cb(snap.docs.map(d => d.data() as StoredChallenge)));
}

export async function sendChallengeDoc(c: StoredChallenge) {
  await setDoc(doc(db, 'challenges', c.id), c);
}

export async function updateChallengeStatus(id: string, status: StoredChallenge['status']) {
  await updateDoc(doc(db, 'challenges', id), { status });
}

// ── Real endorsements between real accounts (subcollection per target user) ───

export async function setEndorsementDoc(targetUid: string, fromUid: string, skills: string[]) {
  await setDoc(doc(db, 'users', targetUid, 'endorsements', fromUid), { skills, updatedAt: serverTimestamp() });
}

export function subscribeEndorsementsReceived(myUid: string, cb: (bySkill: Record<string, number>) => void): () => void {
  return onSnapshot(collection(db, 'users', myUid, 'endorsements'), snap => {
    const counts: Record<string, number> = {};
    snap.docs.forEach(d => {
      const skills = (d.data().skills as string[] | undefined) ?? [];
      skills.forEach(s => { counts[s] = (counts[s] ?? 0) + 1; });
    });
    cb(counts);
  });
}

export async function loadEndorsementGiven(targetUid: string, fromUid: string): Promise<string[]> {
  const snap = await getDoc(doc(db, 'users', targetUid, 'endorsements', fromUid));
  return snap.exists() ? ((snap.data().skills as string[] | undefined) ?? []) : [];
}

// ── Clubs (real, shared collection — membership/moderation visible to everyone) ─

export function subscribeClubs(cb: (clubs: Club[]) => void): () => void {
  return onSnapshot(collection(db, 'clubs'), snap => cb(snap.docs.map(d => d.data() as Club)));
}

// Seeds the static demo clubs into Firestore once, so real accounts can
// actually join them (a club that only ever existed in local state can't
// have two real members who both see each other in it).
export async function ensureSeedClubsExist(seedClubs: Club[]): Promise<void> {
  await Promise.all(seedClubs.map(async c => {
    const ref = doc(db, 'clubs', c.id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      // Seed data (src/lib/data.ts) was authored for pure local/single-player
      // state, where the literal string 'me' unambiguously meant "the
      // current device's user" — one seed club hardcodes 'me' into
      // memberIds and one chat message's senderId. Writing that verbatim
      // into a real shared Firestore doc would make every real account look
      // like it's already a member of a demo club it never joined. Strip it.
      await setDoc(ref, {
        ...c,
        memberIds: c.memberIds.filter(uid => uid !== 'me'),
        pendingIds: (c.pendingIds ?? []).filter(uid => uid !== 'me'),
        moderatorIds: (c.moderatorIds ?? []).filter(uid => uid !== 'me'),
        clubMessages: (c.clubMessages ?? []).filter(m => m.senderId !== 'me'),
      });
      return;
    }
    // Repair path: in case an earlier deploy already seeded the bad 'me'
    // placeholder before this fix — idempotent, no-ops once cleaned up.
    const existing = snap.data() as Club;
    const hasMePlaceholder = existing.memberIds?.includes('me')
      || existing.pendingIds?.includes('me')
      || (existing.moderatorIds ?? []).includes('me');
    if (hasMePlaceholder) {
      await updateDoc(ref, {
        memberIds: arrayRemove('me'),
        pendingIds: arrayRemove('me'),
        moderatorIds: arrayRemove('me'),
      });
    }
  }));
}

export async function createClubDoc(club: Club) {
  await setDoc(doc(db, 'clubs', club.id), club);
}

export async function updateClubDoc(id: string, patch: Partial<Club>) {
  await updateDoc(doc(db, 'clubs', id), patch as Record<string, unknown>);
}

export async function deleteClubDoc(id: string) {
  await deleteDoc(doc(db, 'clubs', id));
}

// Array mutations use arrayUnion/arrayRemove (not read-modify-write) so two
// people joining/requesting at the same moment can't silently clobber each
// other's change — a real concern now that clubs have real concurrent users.
export async function addClubMember(id: string, uid: string) {
  await updateDoc(doc(db, 'clubs', id), { memberIds: arrayUnion(uid), pendingIds: arrayRemove(uid) });
}

export async function removeClubMember(id: string, uid: string) {
  await updateDoc(doc(db, 'clubs', id), { memberIds: arrayRemove(uid), moderatorIds: arrayRemove(uid) });
}

export async function addClubPending(id: string, uid: string) {
  await updateDoc(doc(db, 'clubs', id), { pendingIds: arrayUnion(uid) });
}

export async function removeClubPending(id: string, uid: string) {
  await updateDoc(doc(db, 'clubs', id), { pendingIds: arrayRemove(uid) });
}

export async function setClubModerator(id: string, uid: string, isModerator: boolean) {
  await updateDoc(doc(db, 'clubs', id), { moderatorIds: isModerator ? arrayUnion(uid) : arrayRemove(uid) });
}

// Club chat — a subcollection, not an array field on the club doc. The old
// `arrayUnion`-on-the-club-doc design grows the SAME document forever with
// every message from every member, in a collection every signed-in client
// already subscribes to in full (subscribeClubs) — a genuinely active club
// would eventually hit Firestore's 1MB single-document limit, and every
// unrelated club update re-downloads that entire message history to every
// user. A subcollection has no such document-size ceiling, supports
// pagination, and isn't touched at all by the club-metadata listener.
export async function sendClubMessageDoc(clubId: string, msg: ClubMessage) {
  await setDoc(doc(db, 'clubs', clubId, 'messages', msg.id), msg);
}

export function subscribeClubMessages(clubId: string, cb: (msgs: ClubMessage[]) => void, max = 50): () => void {
  const q = query(collection(db, 'clubs', clubId, 'messages'), orderBy('sentAt', 'desc'), fsLimit(max));
  return onSnapshot(q, snap => cb(snap.docs.map(d => d.data() as ClubMessage).reverse()));
}

// One-time migration for clubs created before this change: moves the old
// embedded `clubMessages` array into the subcollection, then clears the
// field off the club doc so it stops counting toward that document's size.
// Idempotent — once the field is cleared, later calls are a no-op — so it's
// safe to call from every client that opens a club's chat without needing a
// separate "already migrated" flag or worrying about two clients racing.
export async function migrateLegacyClubMessages(clubId: string, legacyMessages: ClubMessage[]): Promise<void> {
  if (legacyMessages.length === 0) return;
  const batch = writeBatch(db);
  legacyMessages.forEach(m => batch.set(doc(db, 'clubs', clubId, 'messages', m.id), m));
  batch.update(doc(db, 'clubs', clubId), { clubMessages: deleteField() });
  await batch.commit();
}

// ── Timestamp helpers ─────────────────────────────────────────────────────────

export function toISOString(ts: unknown): string {
  if (!ts) return new Date().toISOString();
  if (ts instanceof Timestamp) return ts.toDate().toISOString();
  if (typeof ts === 'string') return ts;
  return new Date().toISOString();
}
