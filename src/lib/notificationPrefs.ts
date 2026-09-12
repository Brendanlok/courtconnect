// Per-category in-app notification muting. Client-side only (localStorage) —
// this gates what the NotificationPanel/foreground banner show on this
// device, not the server-side push pipeline (send-push Edge Function fires
// off the `notifications` DB row regardless). A user who wants zero pushes
// for anything already has the master Push Notifications toggle in Settings.
// ponytail: per-device only, add a `muted_categories` column + check it in
// the send-push function if muting needs to follow a user across devices.
import { useEffect, useState } from 'react';
import type { Notification } from '@/types';

type NotificationType = Notification['type'];
export type NotifCategory = 'matches' | 'clubsTournaments' | 'messages' | 'social' | 'reminders';

export const NOTIF_CATEGORIES: { key: NotifCategory; label: string; description: string }[] = [
  { key: 'matches',          label: 'Matches & Challenges', description: 'Challenges, confirmations, upcoming-match reminders.' },
  { key: 'clubsTournaments', label: 'Clubs & Tournaments',  description: 'Join requests, brackets, results.' },
  { key: 'messages',         label: 'Messages',             description: 'New chat messages.' },
  { key: 'social',           label: 'Social',               description: 'Follows, achievements, referrals.' },
  { key: 'reminders',        label: 'Reminders',            description: 'Inactivity and weekly digest nudges.' },
];

const CATEGORY_OF: Record<NotificationType, NotifCategory> = {
  challenge_received: 'matches', challenge_accepted: 'matches', challenge_declined: 'matches',
  partner_request: 'matches', match_pending: 'matches', match_invite: 'matches',
  match_confirmed: 'matches', match_reminder: 'matches',
  club_request: 'clubsTournaments', club_join_request: 'clubsTournaments', club_accepted: 'clubsTournaments',
  club_declined: 'clubsTournaments', club_message: 'clubsTournaments',
  tournament_request: 'clubsTournaments', tournament_join_request: 'clubsTournaments',
  tournament_accepted: 'clubsTournaments', tournament_declined: 'clubsTournaments',
  tournament_win: 'clubsTournaments', tournament_cancelled: 'clubsTournaments',
  event_invite: 'clubsTournaments', event_registered: 'clubsTournaments',
  new_message: 'messages',
  friend_request: 'social', friend_accepted: 'social', badge_earned: 'social', referral_joined: 'social',
  inactivity_reminder: 'reminders', weekly_digest: 'reminders',
};

const KEY = 'cc_muted_notif_categories';
// Same-tab localStorage writes don't fire 'storage' (see pausedMatch.ts) —
// this lets Settings and AppContext react to a toggle without a reload.
const CHANGE_EVENT = 'cc-muted-notif-categories-change';

export function loadMutedCategories(): NotifCategory[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) as NotifCategory[] : [];
  } catch { return []; }
}

export function saveMutedCategories(cats: NotifCategory[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(cats));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch { /* ignore */ }
}

// Accepts a plain string too (DB rows aren't narrowed to NotificationType) —
// an unrecognized type just falls through as unmuted.
export function isNotificationMuted(type: string): boolean {
  const cat = CATEGORY_OF[type as NotificationType];
  return !!cat && loadMutedCategories().includes(cat);
}

export function useMutedCategories(): [NotifCategory[], (cats: NotifCategory[]) => void] {
  const [muted, setMuted] = useState<NotifCategory[]>([]);
  useEffect(() => {
    const check = () => setMuted(loadMutedCategories());
    check();
    window.addEventListener(CHANGE_EVENT, check);
    window.addEventListener('storage', check);
    return () => {
      window.removeEventListener(CHANGE_EVENT, check);
      window.removeEventListener('storage', check);
    };
  }, []);
  return [muted, saveMutedCategories];
}
