import { createClient, type User as SupaUser } from '@supabase/supabase-js';

// flowType: 'implicit' — the default 'pkce' flow does an async crypto.subtle
// hash between the button tap and the redirect to Google/Facebook. Strict
// mobile browsers (iOS Safari, in-app WebViews) can silently drop a redirect
// that happens even slightly after the tap, since it no longer reads as
// directly tied to the touch — no error, the button just does nothing.
// Implicit flow redirects immediately, no crypto step in between.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  { auth: { flowType: 'implicit' } }
);

// ── Firebase-Auth compat shim ──────────────────────────────────────────────
// ponytail: this exists so every call site written against `auth.currentUser`
// / `onAuthStateChanged(auth, cb)` needed a one-line import swap instead of a
// rewrite. If a screen needs more than uid/email/photo/isGoogle, read
// `supabase.auth.getSession()` directly instead of growing this shim.
export interface CompatUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  providerData: { providerId: string }[];
  emailConfirmedAt: string | null;
}

export function toCompatUser(u: SupaUser | null | undefined): CompatUser | null {
  if (!u) return null;
  const providers = (u.app_metadata?.providers as string[] | undefined) ?? [u.app_metadata?.provider].filter(Boolean) as string[];
  return {
    uid: u.id,
    email: u.email ?? null,
    displayName: (u.user_metadata?.full_name as string | undefined) ?? (u.user_metadata?.name as string | undefined) ?? null,
    photoURL: (u.user_metadata?.avatar_url as string | undefined) ?? null,
    providerData: providers.map(p => ({ providerId: p === 'google' ? 'google.com' : p })),
    emailConfirmedAt: u.email_confirmed_at ?? null,
  };
}

let currentUser: CompatUser | null = null;
let initialized = false;
type Listener = (u: CompatUser | null) => void;
const listeners = new Set<Listener>();

supabase.auth.onAuthStateChange((_event, session) => {
  currentUser = toCompatUser(session?.user);
  initialized = true;
  listeners.forEach(l => l(currentUser));
});

export const auth = {
  get currentUser() { return currentUser; },
};

export function onAuthStateChanged(_auth: typeof auth, cb: Listener): () => void {
  listeners.add(cb);
  if (initialized) cb(currentUser);
  return () => listeners.delete(cb);
}
