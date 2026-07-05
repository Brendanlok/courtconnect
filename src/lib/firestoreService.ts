/**
 * Firestore persistence layer.
 * All writes go here; AppContext calls these alongside its local state updates.
 * Collections: users / matches / plannedMatches / tournamentRegistrations / clubMemberships / friendships
 */
import {
  doc, setDoc, deleteDoc, getDoc, getDocs, collection,
  query, where, serverTimestamp, updateDoc, Timestamp,
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

export async function saveClubMembership(uid: string, clubId: string | null) {
  if (!uid || uid === 'me') return;
  await updateDoc(doc(db, 'users', uid), { myClubId: clubId, updatedAt: serverTimestamp() });
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

// ── Timestamp helpers ─────────────────────────────────────────────────────────

export function toISOString(ts: unknown): string {
  if (!ts) return new Date().toISOString();
  if (ts instanceof Timestamp) return ts.toDate().toISOString();
  if (typeof ts === 'string') return ts;
  return new Date().toISOString();
}
