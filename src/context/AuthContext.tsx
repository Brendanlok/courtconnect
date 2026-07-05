'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signInWithPopup, signInWithRedirect, getRedirectResult, signOut, updateProfile, User,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from '@/lib/firebase';

interface AuthCtx {
  authUser: User | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (displayName: string, username: string, email: string, password: string) => Promise<string | null>;
  loginWithGoogle: () => Promise<string | null>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({} as AuthCtx);

async function createUserDoc(user: User, extra?: { username?: string; displayName?: string }) {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const username = extra?.username ?? user.email?.split('@')[0] ?? 'player';
    await setDoc(ref, {
      uid: user.uid,
      email: user.email,
      displayName: extra?.displayName ?? user.displayName ?? 'Player',
      username,
      photoURL: user.photoURL ?? null,
      mmr: 1200,
      stats: { wins: 0, losses: 0, totalMatches: 0 },
      openToPlay: false,
      createdAt: serverTimestamp(),
    });
  }
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
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Handle redirect result from Google sign-in
    getRedirectResult(auth).then(result => {
      if (result?.user) createUserDoc(result.user);
    }).catch(() => {});

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

  const signUp = async (displayName: string, username: string, email: string, password: string): Promise<string | null> => {
    if (!displayName.trim()) return 'Name is required.';
    if (!/^[a-z0-9_]{3,20}$/.test(username)) return 'Username: 3–20 chars, letters/numbers/underscores only.';
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(user, { displayName: displayName.trim() });
      await createUserDoc(user, { username, displayName: displayName.trim() });
      return null;
    } catch (e: unknown) {
      return friendlyError((e as { code?: string }).code ?? '');
    }
  };

  const loginWithGoogle = async (): Promise<string | null> => {
    try {
      // Try popup first; fall back to redirect if blocked
      const { user } = await signInWithPopup(auth, googleProvider);
      await createUserDoc(user);
      return null;
    } catch (e: unknown) {
      const code = (e as { code?: string }).code ?? '';
      if (code === 'auth/popup-blocked' || code === 'auth/cancelled-popup-request') {
        await signInWithRedirect(auth, googleProvider);
        return null;
      }
      return `${friendlyError(code)} (${code})`;
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <Ctx.Provider value={{ authUser, isLoading, signIn, signUp, loginWithGoogle, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
