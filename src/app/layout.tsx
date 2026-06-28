import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';
import { AppProvider } from '@/context/AppContext';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { BottomNav } from '@/components/BottomNav';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });

export const metadata: Metadata = {
  title: 'CourtConnect – Badminton Rank Tracker',
  description: 'Track your MMR, find matches, and compete in tournaments — Malaysia',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geist.variable} font-[var(--font-geist)] bg-[#020817] text-slate-100 min-h-screen`}>
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
      </body>
    </html>
  );
}
