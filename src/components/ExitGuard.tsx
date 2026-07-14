'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

// The 5 BottomNav tab roots. Landing on one of these collapses history to a
// single guarded entry (see below) instead of stacking one per tab visited.
const TAB_ROOTS = new Set(['/', '/matches', '/tournaments', '/players', '/chat', '/__navtest', '/__navtest/matches', '/__navtest/players']); // TEMP-TEST-LINE
const norm = (p: string) => p.replace(/\/+$/, '') || '/';
const TOAST_MS = 2000;

// Mobile back-gesture / hardware back button fires a `popstate`, not a click.
// While resting on a tab root we keep one extra guard entry pushed on top so
// the first back-press can be intercepted (shown as a toast) instead of
// silently leaving the app. Tab switches use <Link replace> (see BottomNav /
// Sidebar) so re-tagging that same guard entry in place never grows the
// history stack, no matter how many tabs get tapped.
//
// ponytail: a confirmed exit only guarantees landing on Home before a further
// press truly exits — walking past an arbitrary number of already-collapsed
// tab entries in one shot isn't possible with the History API. Good enough
// for real usage; upgrade only if users report needing 3+ back-presses.
export function ExitGuard() {
  const pathname = usePathname();
  const [showToast, setShowToast] = useState(false);

  const viaPopRef = useRef(false);
  const guardOnTopRef = useRef(false);
  const armedRef = useRef(false);
  const suppressRearmRef = useRef(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const onPopState = () => { viaPopRef.current = true; };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const wasPop = viaPopRef.current;
    viaPopRef.current = false;
    const atTabRoot = TAB_ROOTS.has(norm(pathname));

    if (wasPop) {
      if (guardOnTopRef.current) {
        guardOnTopRef.current = false;
        if (armedRef.current) {
          // Confirmed second back-press — let it through, don't re-arm yet.
          armedRef.current = false;
          suppressRearmRef.current = true;
          setShowToast(false);
          clearTimeout(toastTimer.current);
          setTimeout(() => { suppressRearmRef.current = false; }, 500);
          return;
        }
        history.pushState({ exitGuard: true }, '');
        guardOnTopRef.current = true;
        armedRef.current = true;
        setShowToast(true);
        clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => { armedRef.current = false; setShowToast(false); }, TOAST_MS);
        return;
      }
      // Stepped back out of a drill-down page — a normal one-step undo.
      if (atTabRoot && !suppressRearmRef.current) {
        history.pushState({ exitGuard: true }, '');
        guardOnTopRef.current = true;
      }
      return;
    }

    // Forward navigation (a Link click, including tab switches).
    if (atTabRoot) {
      if (guardOnTopRef.current) {
        history.replaceState({ exitGuard: true }, '');
      } else {
        history.pushState({ exitGuard: true }, '');
        guardOnTopRef.current = true;
      }
    } else {
      guardOnTopRef.current = false;
    }
  }, [pathname]);

  if (!showToast) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-800/95 backdrop-blur border border-slate-700 text-slate-100 text-sm font-medium px-4 py-2 rounded-full shadow-lg pointer-events-none">
      Tap back again to exit
    </div>
  );
}
