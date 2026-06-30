'use client';
import { ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { AuthModal } from '@/components/AuthModal';
import { AppProvider } from '@/context/AppContext';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { BottomNav } from '@/components/BottomNav';

export function AuthGate({ children }: { children: ReactNode }) {
  const { authUser, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-[#020817] flex items-center justify-center">
        <div className="text-4xl animate-pulse">🏸</div>
      </div>
    );
  }

  if (!authUser) {
    return <AuthModal />;
  }

  return (
    <AppProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Topbar />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
            <div className="max-w-5xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
      <BottomNav />
    </AppProvider>
  );
}
