'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { AuthUser } from '@/types';

interface AuthCtx {
  authUser: AuthUser | null;
  isLoading: boolean;
  login: (emailOrUsername: string, password: string) => string | null;
  signup: (displayName: string, username: string, email: string, password: string) => string | null;
  loginWithGoogle: () => void;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>({} as AuthCtx);

const USERS_KEY   = 'cc_auth_users';
const SESSION_KEY = 'cc_auth_session';

function getUsers(): AuthUser[] {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) ?? '[]'); } catch { return []; }
}
function saveUsers(users: AuthUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) setAuthUser(JSON.parse(raw));
    } catch {}
    setIsLoading(false);
  }, []);

  const persist = (u: AuthUser) => {
    setAuthUser(u);
    localStorage.setItem(SESSION_KEY, JSON.stringify(u));
  };

  const login = (emailOrUsername: string, password: string): string | null => {
    const users = getUsers();
    const found = users.find(u =>
      (u.email.toLowerCase() === emailOrUsername.toLowerCase() ||
       u.username.toLowerCase() === emailOrUsername.toLowerCase()) &&
      u.passwordHash === password
    );
    if (!found) return 'Invalid email/username or password.';
    persist(found);
    return null;
  };

  const signup = (displayName: string, username: string, email: string, password: string): string | null => {
    if (!displayName.trim()) return 'Name is required.';
    if (!/^[a-z0-9_]{3,20}$/.test(username)) return 'Username: 3–20 chars, letters/numbers/underscores only.';
    if (!email.includes('@')) return 'Enter a valid email.';
    if (password.length < 6) return 'Password must be at least 6 characters.';

    const users = getUsers();
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) return 'Email already registered.';
    if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) return 'Username already taken.';

    const newUser: AuthUser = {
      uid: `u_${Date.now()}`,
      displayName: displayName.trim(),
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      provider: 'email',
      passwordHash: password,
    };
    saveUsers([...users, newUser]);
    persist(newUser);
    return null;
  };

  const loginWithGoogle = () => {
    const users = getUsers();
    const googleEmail = 'lokkai@gmail.com';
    let gUser = users.find(u => u.email === googleEmail && u.provider === 'google');
    if (!gUser) {
      gUser = {
        uid: `g_${Date.now()}`,
        displayName: 'Lok Kai',
        username: 'lokkai',
        email: googleEmail,
        provider: 'google',
      };
      // ensure unique username
      let base = gUser.username; let i = 1;
      while (users.some(u => u.username === gUser!.username)) { gUser!.username = `${base}${i++}`; }
      saveUsers([...users, gUser]);
    }
    persist(gUser);
  };

  const logout = () => {
    setAuthUser(null);
    localStorage.removeItem(SESSION_KEY);
  };

  return (
    <Ctx.Provider value={{ authUser, isLoading, login, signup, loginWithGoogle, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
