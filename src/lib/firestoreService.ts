/**
 * Firestore persistence layer.
 * All writes go here; AppContext calls these alongside its local state updates.
 * Collections: users / matches / plannedMatches / tournamentRegistrations / clubMemberships / friendships
 */
import {
  doc, setDoc, deleteDoc, getDoc, getDocs, collection,
  query, where, serverTimestamp, updateDoc, Timestamp, arrayUnion,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Match, UserProfile, Tournament, Club } from '@/types';

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

// ── Timestamp helpers ─────────────────────────────────────────────────────────

export function toISOString(ts: unknown): string {
  if (!ts) return new Date().toISOString();
  if (ts instanceof Timestamp) return ts.toDate().toISOString();
  if (typeof ts === 'string') return ts;
  return new Date().toISOString();
}
