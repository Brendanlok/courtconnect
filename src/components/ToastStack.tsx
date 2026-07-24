'use client';
import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { NOTIF_ICON } from '@/components/NotificationPanel';
import { pickFreshToasts, enqueueToasts } from '@/lib/toastQueue';
import type { Notification } from '@/types';

const AUTO_DISMISS_MS = 5000;
const MAX_VISIBLE = 3;

// Only these feel worth interrupting the user for with a transient banner —
// everything else still lands in the bell, just without the popup.
const TOAST_TYPES = new Set<Notification['type']>([
  'challenge_received', 'challenge_accepted', 'challenge_declined',
  'friend_request', 'friend_accepted', 'club_invite',
]);

export function ToastStack() {
  const { notifications, markNotifRead } = useApp();
  const [toasts, setToasts] = useState<Notification[]>([]);
  const seenIds = useRef<Set<string> | null>(null);
  const dismiss = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  useEffect(() => {
    if (seenIds.current === null) {
      // First render: seed with whatever already exists so history doesn't toast.
      seenIds.current = new Set(notifications.map(n => n.id));
      return;
    }
    const fresh = pickFreshToasts(notifications, seenIds.current, TOAST_TYPES);
    if (!fresh.length) return;
    fresh.forEach(n => seenIds.current!.add(n.id));
    setToasts(prev => enqueueToasts(prev, fresh, MAX_VISIBLE));
    fresh.forEach(n => setTimeout(() => dismiss(n.id), AUTO_DISMISS_MS));
  }, [notifications]);

  if (!toasts.length) return null;

  return (
    <div className="fixed top-3 inset-x-3 z-[70] flex flex-col gap-2 items-center pointer-events-none">
      {toasts.map(n => (
        <div key={n.id}
          className="toast-anim pointer-events-auto w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl shadow-black/50 flex items-start gap-3 px-4 py-3 cursor-pointer"
          onClick={() => { markNotifRead(n.id); dismiss(n.id); if (n.linkTo) window.location.href = n.linkTo; }}>
          <span className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 mt-0.5">
            {NOTIF_ICON[n.type]}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-200">{n.title}</p>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{n.body}</p>
          </div>
          <button onClick={e => { e.stopPropagation(); dismiss(n.id); }} aria-label="Dismiss"
            className="p-1 -mt-1 -mr-1 text-slate-500 hover:text-slate-300 shrink-0">
            <X size={14}/>
          </button>
        </div>
      ))}
    </div>
  );
}
