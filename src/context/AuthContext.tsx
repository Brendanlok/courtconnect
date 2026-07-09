'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signInWithPopup, signOut, updateProfile, sendPasswordResetEmail, sendEmailVerification, User,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from '@/lib/firebase';
import { lookupUserByUsername } from '@/lib/firestoreService';

interface AuthCtx {
  authUser: User | null;
  isLoading: boolean;
  // authUser exists but hasn't confirmed their email yet (password accounts only — Google is pre-verified)
  needsEmailVerification: boolean;
  // authUser is verified/Google but has no Firestore profile yet — needs username + details
  needsProfileSetup: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  loginWithGoogle: () => Promise<string | null>;
  resendVerificationEmail: () => Promise<string | null>;
  refreshVerificationStatus: () => Promise<void>;
  checkUsernameAvailable: (username: string) => Promise<boolean>;
  completeProfile: (displayName: string, username: string, country: string, region: string) => Promise<string | null>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<string | null>;
}

const Ctx = createContext<AuthCtx>({} as AuthCtx);

async function userDocExists(uid: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists();
}

async function createUserDoc(user: User, extra: { username: string; displayName: string; country: string; region: string }) {
  await setDoc(doc(db, 'users', user.uid), {
    uid: user.uid,
    email: user.email,
    displayName: extra.displayName,
    username: extra.username,
    photoURL: user.photoURL ?? null,
    mmr: 1200,
    country: extra.country,
    region: extra.region,
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

const isGoogleUser = (u: User) => u.providerData.some(p => p.providerId === 'google.com');

const verificationRedirectUrl = () =>
  typeof window !== 'undefined' ? `${window.location.origin}/` : 'https://courtconnectcc.netlify.app/';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authUser,               setAuthUser]               = useState<User | null>(null);
  const [isLoading,               setIsLoading]              = useState(true);
  const [needsEmailVerification,  setNeedsEmailVerification] = useState(false);
  const [needsProfileSetup,       setNeedsProfileSetup]      = useState(false);

  const evaluateUser = async (user: User | null) => {
    if (!user) {
      setNeedsEmailVerification(false);
      setNeedsProfileSetup(false);
      return;
    }
    const verified = isGoogleUser(user) || user.emailVerified;
    setNeedsEmailVerification(!verified);
    if (!verified) { setNeedsProfileSetup(false); return; }
    const exists = await userDocExists(user.uid);
    setNeedsProfileSetup(!exists);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async user => {
      setAuthUser(user);
      await evaluateUser(user);
      setIsLoading(false);
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-check email verification when the user comes back to the tab (e.g. after
  // clicking the confirmation link in their email app) — no server needed.
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible' && auth.currentUser && !isGoogleUser(auth.currentUser)) {
        refreshVerificationStatus();
      }
    };
    document.addEventListener('visibilitychange', handler);
    window.addEventListener('focus', handler);
    return () => {
      document.removeEventListener('visibilitychange', handler);
      window.removeEventListener('focus', handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = async (email: string, password: string): Promise<string | null> => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return null;
    } catch (e: unknown) {
      return friendlyError((e as { code?: string }).code ?? '');
    }
  };

  const signUp = async (email: string, password: string): Promise<string | null> => {
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(user, { url: verificationRedirectUrl() });
      await evaluateUser(user);
      return null;
    } catch (e: unknown) {
      return friendlyError((e as { code?: string }).code ?? '');
    }
  };

  const loginWithGoogle = async (): Promise<string | null> => {
    try {
      const { user } = await signInWithPopup(auth, googleProvider);
      await evaluateUser(user);
      return null;
    } catch (e: unknown) {
      return friendlyError((e as { code?: string }).code ?? '');
    }
  };

  const resendVerificationEmail = async (): Promise<string | null> => {
    if (!auth.currentUser) return 'You need to be signed in.';
    try {
      await sendEmailVerification(auth.currentUser, { url: verificationRedirectUrl() });
      return null;
    } catch (e: unknown) {
      return friendlyError((e as { code?: string }).code ?? '');
    }
  };

  const refreshVerificationStatus = async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload().catch(() => {});
    await evaluateUser(auth.currentUser);
  };

  const checkUsernameAvailable = async (username: string): Promise<boolean> => {
    const existing = await lookupUserByUsername(username.toLowerCase());
    return !existing;
  };

  const completeProfile = async (displayName: string, username: string, country: string, region: string): Promise<string | null> => {
    if (!auth.currentUser) return 'Session expired. Please sign in again.';
    if (!displayName.trim()) return 'Name is required.';
    if (!country) return 'Country is required.';
    if (!region.trim()) return 'State / region is required.';
    const cleanUsername = username.toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) return 'Username: 3–20 chars, letters/numbers/underscores only.';
    try {
      const available = await checkUsernameAvailable(cleanUsername);
      if (!available) return 'That username is already taken.';
      await updateProfile(auth.currentUser, { displayName: displayName.trim() });
      await createUserDoc(auth.currentUser, { username: cleanUsername, displayName: displayName.trim(), country, region: region.trim() });
      setNeedsProfileSetup(false);
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
    await signOut(auth);
  };

  return (
    <Ctx.Provider value={{
      authUser, isLoading, needsEmailVerification, needsProfileSetup,
      signIn, signUp, loginWithGoogle, resendVerificationEmail, refreshVerificationStatus,
      checkUsernameAvailable, completeProfile, logout, resetPassword,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
