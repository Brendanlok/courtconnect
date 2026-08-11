'use client';
import { ReactNode, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AuthModal } from '@/components/AuthModal';
import { AppProvider, useApp } from '@/context/AppContext';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { BottomNav } from '@/components/BottomNav';
import { ExitGuard } from '@/components/ExitGuard';
import { OnboardingModal } from '@/components/OnboardingModal';
import { ToastStack } from '@/components/ToastStack';
import { SeasonRecapModal } from '@/components/SeasonRecapModal';
import { captureReferralFromUrl } from '@/lib/utils';
import { PublicAuthProvider } from '@/context/PublicAuthContext';
import { PublicNav, PublicFooter } from '@/components/PublicNav';
import { MarketingHome } from '@/components/MarketingHome';

// Routes that render for logged-out visitors instead of falling straight to
// the login wall — the public, DUPR-style site (see DEVLOG 2026-08-12).
// Everything NOT in this list keeps the original all-gated behavior
// unchanged (still just AuthModal when signed out), so none of the existing
// authenticated routes/nav are affected.
const PUBLIC_ROUTES = ['/rankings', '/how-it-works', '/about', '/start-a-club'];
const norm = (p: string) => p.replace(/\/+$/, '') || '/';

export function AuthGate({ children }: { children: ReactNode }) {
  const { authUser, isLoading, needsEmailVerification, needsProfileSetup } = useAuth();
  const pathname = usePathname();
  const [onboardingDone, setOnboardingDone] = useState(() => {
    if (typeof window === 'undefined') return true;
    return !!localStorage.getItem('cc_onboarded');
  });
  const [authTab, setAuthTab] = useState<'login' | 'signup' | null>(null);

  // Runs on every boot regardless of auth state — a ?ref= link may land on
  // an already-signed-in device (nothing to do) or a brand new visitor
  // (captured for AuthContext to consume once they finish signing up).
  useEffect(() => { captureReferralFromUrl(); }, []);
  // Reset the auth-overlay flag once signed in, so a later logout lands back
  // on the marketing home instead of reopening straight into AuthModal.
  useEffect(() => { if (authUser) setAuthTab(null); }, [authUser]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-[#020817] flex items-center justify-center">
        <div className="text-4xl animate-pulse">🏸</div>
      </div>
    );
  }

  const loggedOut = !authUser || needsEmailVerification || needsProfileSetup;
  // Mid-signup (verify email / complete profile) always goes straight to
  // AuthModal, same as before — only a *fully* logged-out visitor sees the
  // public site, and only on a route that's actually public.
  const showPublicSite = !authUser && (PUBLIC_ROUTES.includes(norm(pathname)) || norm(pathname) === '/');

  if (loggedOut) {
    // authTab is only ever set from a public page's Log In / Sign Up CTA
    // (see PublicAuthProvider below), so this only fires where showPublicSite
    // was already true — onBack returns to that same page.
    if (authTab) return <AuthModal initialTab={authTab} onBack={() => setAuthTab(null)} />;
    if (showPublicSite) {
      return (
        <PublicAuthProvider value={setAuthTab}>
          <PublicNav />
          {norm(pathname) === '/' ? <MarketingHome /> : children}
          <PublicFooter />
        </PublicAuthProvider>
      );
    }
    return <AuthModal />;
  }

  return (
    <AppProvider>
      <AppShell onboardingDone={onboardingDone} setOnboardingDone={setOnboardingDone}>
        {children}
      </AppShell>
    </AppProvider>
  );
}

// Split out so it can read profileLoading from AppContext — AppProvider's own
// value isn't visible to AuthGate itself, only to components rendered inside
// it. Holds the same splash AuthGate shows for auth, so the app never paints
// the local seed profile's numbers before the real signed-in profile arrives.
function AppShell({ children, onboardingDone, setOnboardingDone }: {
  children: ReactNode; onboardingDone: boolean; setOnboardingDone: (v: boolean) => void;
}) {
  const { profileLoading } = useApp();

  if (profileLoading) {
    return (
      <div className="fixed inset-0 bg-[#020817] flex items-center justify-center">
        <div className="text-4xl animate-pulse">🏸</div>
      </div>
    );
  }

  return (
    <>
      {!onboardingDone && <OnboardingModal onComplete={() => setOnboardingDone(true)}/>}
      <ToastStack />
      <SeasonRecapModal />
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Topbar />
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 pb-20 md:pb-6">
            <div className="max-w-5xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
      <BottomNav />
      <ExitGuard />
    </>
  );
}
