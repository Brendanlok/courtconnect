import { createClient, type User as SupaUser } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
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
}

function toCompatUser(u: SupaUser | null | undefined): CompatUser | null {
  if (!u) return null;
  const providers = (u.app_metadata?.providers as string[] | undefined) ?? [u.app_metadata?.provider].filter(Boolean) as string[];
  return {
    uid: u.id,
    email: u.email ?? null,
    displayName: (u.user_metadata?.full_name as string | undefined) ?? (u.user_metadata?.name as string | undefined) ?? null,
    photoURL: (u.user_metadata?.avatar_url as string | undefined) ?? null,
    providerData: providers.map(p => ({ providerId: p === 'google' ? 'google.com' : p })),
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
