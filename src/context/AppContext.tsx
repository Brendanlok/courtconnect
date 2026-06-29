'use client';
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { UserProfile, Match, Conversation } from '@/types';
import { ME, MATCHES as SEED_MATCHES, CONVERSATIONS as SEED_CONVS } from '@/lib/data';

interface AppCtx {
  user: UserProfile;
  matches: Match[];
  addMatch: (m: Match) => void;
  updateUser: (patch: Partial<UserProfile>) => void;
  conversations: Conversation[];
  setConversations: (c: Conversation[] | ((prev: Conversation[]) => Conversation[])) => void;
  totalUnread: number;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

const Ctx = createContext<AppCtx>({} as AppCtx);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser]               = useState<UserProfile>(ME);
  const [matches, setMatches]         = useState<Match[]>(SEED_MATCHES);
  const [conversations, setConversations] = useState<Conversation[]>(SEED_CONVS);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const addMatch      = useCallback((m: Match) => setMatches(p => [m, ...p]), []);
  const updateUser    = useCallback((patch: Partial<UserProfile>) => setUser(u => ({ ...u, ...patch })), []);
  const toggleSidebar = useCallback(() => setSidebarCollapsed(c => !c), []);
  const totalUnread   = conversations.reduce((s, c) => s + c.unread, 0);

  return (
    <Ctx.Provider value={{ user, matches, addMatch, updateUser, conversations, setConversations, totalUnread, sidebarCollapsed, toggleSidebar }}>
      {children}
    </Ctx.Provider>
  );
}

export const useApp = () => useContext(Ctx);
