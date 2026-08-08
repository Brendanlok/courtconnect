'use client';
import { ReactNode, useEffect, useState } from 'react';
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

export function AuthGate({ children }: { children: ReactNode }) {
  const { authUser, isLoading, needsEmailVerification, needsProfileSetup } = useAuth();
  const [onboardingDone, setOnboardingDone] = useState(() => {
    if (typeof window === 'undefined') return true;
    return !!localStorage.getItem('cc_onboarded');
  });

  // Runs on every boot regardless of auth state — a ?ref= link may land on
  // an already-signed-in device (nothing to do) or a brand new visitor
  // (captured for AuthContext to consume once they finish signing up).
  useEffect(() => { captureReferralFromUrl(); }, []);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-[#020817] flex items-center justify-center">
        <div className="text-4xl animate-pulse">🏸</div>
      </div>
    );
  }

  if (!authUser || needsEmailVerification || needsProfileSetup) {
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
