'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase, auth, onAuthStateChanged, type CompatUser } from '@/lib/supabase';
import { lookupUserByUsername } from '@/lib/supabaseService';
import { BASE_PATH } from '@/lib/utils';

interface AuthCtx {
  authUser: CompatUser | null;
  isLoading: boolean;
  // authUser exists but hasn't confirmed their email yet (password accounts only — Google is pre-verified)
  needsEmailVerification: boolean;
  // authUser is verified/Google but has no `users` row yet — needs username + details
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

async function userRowExists(uid: string): Promise<boolean> {
  const { data } = await supabase.from('users').select('uid').eq('uid', uid).maybeSingle();
  return !!data;
}

async function createUserRow(user: CompatUser, extra: { username: string; displayName: string; country: string; region: string }) {
  await supabase.from('users').insert({
    uid: user.uid,
    email: user.email,
    display_name: extra.displayName,
    username: extra.username,
    photo_url: user.photoURL,
    mmr: 1200,
    tier: 'Beginner',
    country: extra.country,
    region: extra.region,
    wins: 0, losses: 0, total_matches: 0,
    open_to_play: false,
  });
}

function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('already registered') || m.includes('already exists'))     return 'Email already registered.';
  if (m.includes('invalid email') || m.includes('unable to validate'))      return 'Enter a valid email address.';
  if (m.includes('password') && m.includes('character'))                   return 'Password must be at least 6 characters.';
  if (m.includes('invalid login') || m.includes('invalid credentials'))    return 'Invalid email or password.';
  if (m.includes('rate limit') || m.includes('too many') || m.includes('security purposes')) return 'Too many attempts. Try again in a minute.';
  return 'Something went wrong. Please try again.';
}

// Supabase's compat CompatUser.providerData covers the one thing this app
// needs: was this account created via Google (pre-verified email)?
const isGoogleUser = (u: CompatUser) => u.providerData.some(p => p.providerId === 'google.com');

const verificationRedirectUrl = () =>
  typeof window !== 'undefined' ? `${window.location.origin}${BASE_PATH}/` : 'https://brendanlok.github.io/courtconnect/';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authUser,               setAuthUser]               = useState<CompatUser | null>(null);
  const [isLoading,               setIsLoading]              = useState(true);
  const [needsEmailVerification,  setNeedsEmailVerification] = useState(false);
  const [needsProfileSetup,       setNeedsProfileSetup]      = useState(false);

  const evaluateUser = async (user: CompatUser | null, confirmed: boolean) => {
    if (!user) {
      setNeedsEmailVerification(false);
      setNeedsProfileSetup(false);
      return;
    }
    const verified = isGoogleUser(user) || confirmed;
    setNeedsEmailVerification(!verified);
    if (!verified) { setNeedsProfileSetup(false); return; }
    const exists = await userRowExists(user.uid);
    setNeedsProfileSetup(!exists);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async user => {
      setAuthUser(user);
      const { data } = await supabase.auth.getSession();
      const confirmed = !!data.session?.user?.email_confirmed_at;
      await evaluateUser(user, confirmed);
      setIsLoading(false);
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? friendlyError(error.message) : null;
  };

  const signUp = async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: verificationRedirectUrl() },
    });
    return error ? friendlyError(error.message) : null;
  };

  const loginWithGoogle = async (): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: verificationRedirectUrl() } });
    return error ? friendlyError(error.message) : null;
  };

  const resendVerificationEmail = async (): Promise<string | null> => {
    if (!authUser?.email) return 'You need to be signed in.';
    const { error } = await supabase.auth.resend({ type: 'signup', email: authUser.email, options: { emailRedirectTo: verificationRedirectUrl() } });
    return error ? friendlyError(error.message) : null;
  };

  const refreshVerificationStatus = async () => {
    const { data } = await supabase.auth.refreshSession();
    const confirmed = !!data.session?.user?.email_confirmed_at;
    await evaluateUser(auth.currentUser, confirmed);
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
    const available = await checkUsernameAvailable(cleanUsername);
    if (!available) return 'That username is already taken.';
    try {
      await supabase.auth.updateUser({ data: { display_name: displayName.trim() } });
      await createUserRow(auth.currentUser, { username: cleanUsername, displayName: displayName.trim(), country, region: region.trim() });
      setNeedsProfileSetup(false);
      return null;
    } catch (e: unknown) {
      return friendlyError(e instanceof Error ? e.message : '');
    }
  };

  const resetPassword = async (email: string): Promise<string | null> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: verificationRedirectUrl() });
    return error ? friendlyError(error.message) : null;
  };

  const logout = async () => {
    await supabase.auth.signOut();
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
