'use client';
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { UserProfile, Match } from '@/types';
import { ME, MATCHES as SEED_MATCHES } from '@/lib/data';

interface AppCtx {
  user: UserProfile;
  matches: Match[];
  addMatch: (m: Match) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

const Ctx = createContext<AppCtx>({} as AppCtx);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user]              = useState<UserProfile>(ME);
  const [matches, setMatches] = useState<Match[]>(SEED_MATCHES);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const addMatch    = useCallback((m: Match) => setMatches(p => [m, ...p]), []);
  const toggleSidebar = useCallback(() => setSidebarCollapsed(c => !c), []);

  return (
    <Ctx.Provider value={{ user, matches, addMatch, sidebarCollapsed, toggleSidebar }}>
      {children}
    </Ctx.Provider>
  );
}

export const useApp = () => useContext(Ctx);
