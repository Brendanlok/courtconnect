'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signInWithPopup, signOut, updateProfile, sendPasswordResetEmail, User,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from '@/lib/firebase';

interface AuthCtx {
  authUser: User | null;
  isLoading: boolean;
  // null = no pending onboarding; User = google user awaiting username/name
  pendingGoogleUser: User | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (displayName: string, username: string, email: string, password: string, country: string, region: string) => Promise<string | null>;
  loginWithGoogle: () => Promise<string | null>;
  completeGoogleOnboarding: (displayName: string, username: string, country: string, region: string) => Promise<string | null>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<string | null>;
}

const Ctx = createContext<AuthCtx>({} as AuthCtx);

async function userDocExists(uid: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists();
}

async function createUserDoc(user: User, extra: { username: string; displayName: string; country?: string; region?: string }) {
  await setDoc(doc(db, 'users', user.uid), {
    uid: user.uid,
    email: user.email,
    displayName: extra.displayName,
    username: extra.username,
    photoURL: user.photoURL ?? null,
    mmr: 1200,
    country: extra.country ?? 'Malaysia',
    region: extra.region ?? '',
    stats: { wins: 0, losses: 0, totalMatches: 0 },
    openToPlay: false,
    createdAt: serverTimestamp(),
  });
}

function friendlyError(code: string): string {
  switch (code) {
    case 'auth/email-already-in-use':    return 'Email already registered.';
    case 'auth/invalid-email':           return 'Enter a valid email address.';
    case 'auth/weak-password':           return 'Password must be at least 6 characters.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':      return 'Invalid email or password.';
    case 'auth/too-many-requests':       return 'Too many attempts. Try again later.';
    case 'auth/popup-closed-by-user':    return 'Sign-in popup was closed.';
    default: return 'Something went wrong. Please try again.';
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authUser,           setAuthUser]           = useState<User | null>(null);
  const [isLoading,          setIsLoading]          = useState(true);
  const [pendingGoogleUser,  setPendingGoogleUser]  = useState<User | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      setAuthUser(user);
      setIsLoading(false);
    });
    return unsub;
  }, []);

  const signIn = async (email: string, password: string): Promise<string | null> => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return null;
    } catch (e: unknown) {
      return friendlyError((e as { code?: string }).code ?? '');
    }
  };

  const signUp = async (displayName: string, username: string, email: string, password: string, country: string, region: string): Promise<string | null> => {
    if (!displayName.trim()) return 'Name is required.';
    if (!/^[a-z0-9_]{3,20}$/.test(username)) return 'Username: 3–20 chars, letters/numbers/underscores only.';
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(user, { displayName: displayName.trim() });
      await createUserDoc(user, { username, displayName: displayName.trim(), country, region });
      return null;
    } catch (e: unknown) {
      return friendlyError((e as { code?: string }).code ?? '');
    }
  };

  const loginWithGoogle = async (): Promise<string | null> => {
    try {
      const { user } = await signInWithPopup(auth, googleProvider);
      const exists = await userDocExists(user.uid);
      if (!exists) {
        // New Google user — need username & display name before entering app
        setPendingGoogleUser(user);
        // Sign them back out so AuthGate still shows the modal
        await signOut(auth);
      }
      // If exists, onAuthStateChanged already set authUser — they're in
      return null;
    } catch (e: unknown) {
      const code = (e as { code?: string }).code ?? '';
      return friendlyError(code);
    }
  };

  const completeGoogleOnboarding = async (displayName: string, username: string, country: string, region: string): Promise<string | null> => {
    if (!pendingGoogleUser) return 'Session expired. Please try signing in again.';
    if (!displayName.trim()) return 'Name is required.';
    if (!/^[a-z0-9_]{3,20}$/.test(username)) return 'Username: 3–20 chars, letters/numbers/underscores only.';
    try {
      await updateProfile(pendingGoogleUser, { displayName: displayName.trim() });
      await createUserDoc(pendingGoogleUser, { username, displayName: displayName.trim(), country, region });
      setPendingGoogleUser(null);
      return null;
    } catch (e: unknown) {
      return friendlyError((e as { code?: string }).code ?? '');
    }
  };

  const resetPassword = async (email: string): Promise<string | null> => {
    try {
      await sendPasswordResetEmail(auth, email);
      return null;
    } catch (e: unknown) {
      return friendlyError((e as { code?: string }).code ?? '');
    }
  };

  const logout = async () => {
    setPendingGoogleUser(null);
    await signOut(auth);
  };

  return (
    <Ctx.Provider value={{
      authUser, isLoading, pendingGoogleUser,
      signIn, signUp, loginWithGoogle, completeGoogleOnboarding, logout, resetPassword,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
