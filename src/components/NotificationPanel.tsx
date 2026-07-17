'use client';
import { useRef, useEffect } from 'react';
import { Bell, X, Swords, Users, Shield, CheckCircle, MessageCircle, UserPlus, UserCheck, Calendar, Trophy, Mail, Award } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { timeAgo } from '@/lib/utils';
import type { Notification } from '@/types';

const NOTIF_ICON: Record<Notification['type'], React.ReactNode> = {
  challenge_received: <Swords size={14} className="text-amber-400"/>,
  challenge_accepted: <CheckCircle size={14} className="text-emerald-400"/>,
  challenge_declined: <X size={14} className="text-red-400"/>,
  partner_request:    <Users size={14} className="text-violet-400"/>,
  club_request:       <Shield size={14} className="text-blue-400"/>,
  club_join_request:  <Shield size={14} className="text-amber-400"/>,
  club_accepted:      <Shield size={14} className="text-emerald-400"/>,
  club_declined:      <Shield size={14} className="text-red-400"/>,
  club_invite:        <Mail size={14} className="text-blue-400"/>,
  club_message:       <MessageCircle size={14} className="text-blue-400"/>,
  match_pending:      <MessageCircle size={14} className="text-slate-400"/>,
  match_invite:       <Calendar size={14} className="text-amber-400"/>,
  match_confirmed:    <CheckCircle size={14} className="text-emerald-400"/>,
  new_message:        <MessageCircle size={14} className="text-emerald-400"/>,
  friend_request:     <UserPlus size={14} className="text-violet-400"/>,
  friend_accepted:    <UserCheck size={14} className="text-emerald-400"/>,
  event_invite:       <Trophy size={14} className="text-amber-400"/>,
  event_registered:   <Trophy size={14} className="text-emerald-400"/>,
  badge_earned:       <Award size={14} className="text-amber-400"/>,
};

export function NotificationPanel({ onClose }: { onClose: () => void }) {
  const { notifications, markNotifRead, markAllNotifsRead, unreadNotifCount, acceptClubInvite, declineClubInvite } = useApp();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div ref={ref} className="popover-anim origin-top-right absolute right-0 top-full mt-2 w-80 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl shadow-black/50 z-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Bell size={15} className="text-slate-400"/>
          <span className="font-semibold text-sm">Notifications</span>
          {unreadNotifCount > 0 && (
            <span className="text-[10px] bg-red-500 text-white font-bold px-1.5 py-0.5 rounded-full">{unreadNotifCount}</span>
          )}
        </div>
        {unreadNotifCount > 0 && (
          <button onClick={markAllNotifsRead} className="text-[11px] text-emerald-400 hover:underline">
            Mark all read
          </button>
        )}
      </div>

      <div className="max-h-80 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="py-10 text-center">
            <Bell size={28} className="mx-auto mb-2 text-slate-700"/>
            <p className="text-sm text-slate-500">No notifications yet</p>
          </div>
        ) : (
          notifications.map(n => (
            <div key={n.id}
              className={`flex items-start gap-3 px-4 py-3 border-b border-slate-800/60 last:border-0 transition-colors
                ${n.read ? 'opacity-60' : 'bg-slate-800/40'}`}>
              <span className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 mt-0.5">
                {NOTIF_ICON[n.type]}
              </span>
              <div className="flex-1 min-w-0" onClick={() => { markNotifRead(n.id); if (n.linkTo) window.location.href = n.linkTo; }}>
                <p className="text-xs font-semibold text-slate-200">{n.title}</p>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{n.body}</p>
                <p className="text-[10px] text-slate-600 mt-1">{timeAgo(n.createdAt)}</p>
                {n.type === 'club_invite' && n.meta?.clubId && (
                  <div className="flex gap-2 mt-2">
                    <button onClick={e => { e.stopPropagation(); acceptClubInvite(n.meta!.clubId!); markNotifRead(n.id); }}
                      className="flex-1 py-1 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-[11px] font-semibold transition-colors">
                      Accept
                    </button>
                    <button onClick={e => { e.stopPropagation(); declineClubInvite(n.meta!.clubId!); markNotifRead(n.id); }}
                      className="flex-1 py-1 bg-slate-700 hover:bg-slate-600 rounded-lg text-[11px] font-semibold transition-colors">
                      Decline
                    </button>
                  </div>
                )}
              </div>
              {!n.read && <span className="w-2 h-2 bg-emerald-400 rounded-full shrink-0 mt-1.5"/>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
