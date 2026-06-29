'use client';
import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import type { UserProfile, Match, Conversation } from '@/types';
import { ME, MATCHES as SEED_MATCHES, CONVERSATIONS as SEED_CONVS } from '@/lib/data';

interface AppCtx {
  user: UserProfile;
  matches: Match[];
  addMatch: (m: Match) => void;
  confirmMatch: (id: string) => void;
  disputeMatch: (id: string) => void;
  updateUser: (patch: Partial<UserProfile>) => void;
  conversations: Conversation[];
  setConversations: (c: Conversation[] | ((prev: Conversation[]) => Conversation[])) => void;
  totalUnread: number;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

const Ctx = createContext<AppCtx>({} as AppCtx);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser]               = useState<UserProfile>(() => {
    // Rehydrate openToPlay from localStorage on first render
    if (typeof window !== 'undefined') {
      const otp = localStorage.getItem('cc_openToPlay');
      if (otp !== null) return { ...ME, openToPlay: otp === 'true' };
    }
    return ME;
  });
  const [matches, setMatches]         = useState<Match[]>(SEED_MATCHES);
  const [conversations, setConversations] = useState<Conversation[]>(SEED_CONVS);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Persist openToPlay across page navigations
  useEffect(() => {
    localStorage.setItem('cc_openToPlay', String(user.openToPlay ?? false));
  }, [user.openToPlay]);

  const addMatch = useCallback((m: Match) => setMatches(p => [m, ...p]), []);

  const confirmMatch = useCallback((id: string) => {
    setMatches(prev => prev.map(m => {
      if (m.id !== id || m.status !== 'Pending') return m;
      // Apply stats + MMR to the user
      const iWon = m.winnerId === 'me';
      const delta = m.mmrChange ?? 0;
      setUser(u => ({
        ...u,
        mmr: u.mmr + delta,
        stats: {
          wins:         u.stats.wins   + (iWon ? 1 : 0),
          losses:       u.stats.losses + (iWon ? 0 : 1),
          totalMatches: u.stats.totalMatches + 1,
        },
      }));
      return { ...m, status: 'Confirmed' as const };
    }));
  }, []);

  const disputeMatch = useCallback((id: string) => {
    setMatches(prev => prev.map(m =>
      m.id === id ? { ...m, status: 'Disputed' as const } : m
    ));
  }, []);

  const updateUser    = useCallback((patch: Partial<UserProfile>) => setUser(u => ({ ...u, ...patch })), []);
  const toggleSidebar = useCallback(() => setSidebarCollapsed(c => !c), []);
  const totalUnread   = conversations.reduce((s, c) => s + c.unread, 0);

  return (
    <Ctx.Provider value={{
      user, matches, addMatch, confirmMatch, disputeMatch, updateUser,
      conversations, setConversations, totalUnread, sidebarCollapsed, toggleSidebar,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useApp = () => useContext(Ctx);
