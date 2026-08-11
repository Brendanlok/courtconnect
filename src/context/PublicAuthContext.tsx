'use client';
// Lets any logged-out public page (Rankings, marketing home, …) trigger the
// Log In / Sign Up overlay without prop-drilling — page.tsx components are
// rendered by Next's router itself, so AuthGate can't hand them props
// directly the way a normal parent component could.
import { createContext, useContext } from 'react';

type AuthTab = 'login' | 'signup';
const Ctx = createContext<(tab: AuthTab) => void>(() => {});

export const PublicAuthProvider = Ctx.Provider;
export const usePublicAuth = () => useContext(Ctx);
