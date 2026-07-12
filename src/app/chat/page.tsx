'use client';
import { useState, useRef, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Avatar } from '@/components/ui/Avatar';
import { TierBadge } from '@/components/ui/TierBadge';
import { timeAgo } from '@/lib/utils';
import { Send, Zap, Search, ArrowLeft, MessageCircle } from 'lucide-react';
import { ME, PLAYERS } from '@/lib/data';
import type { Message, Conversation } from '@/types';
import Link from 'next/link';
import { auth } from '@/lib/firebase';
import { saveConversation, lookupUserByUid } from '@/lib/firestoreService';
import { getTier } from '@/lib/utils';

const isRealUid = (uid: string) => uid !== 'me' && ![ME, ...PLAYERS].some(p => p.uid === uid);

export default function Chat() {
  const { user, conversations: convs, setConversations: setConvs, sendRealMessage, markRealConvRead } = useApp();
  const [activeId,   setActiveId]   = useState<string | null>(convs[0]?.id ?? null);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const [input,      setInput]      = useState('');
  const [query,      setQuery]      = useState('');
  // A real conversation the user just started but hasn't sent a first message
  // for yet — no Firestore doc exists until then, so it isn't in `convs`.
  const [pendingRealConv, setPendingRealConv] = useState<Conversation | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Open or create a conversation for a player uid passed via ?uid= (demo
  // player) or ?realUid= (a real account found via username search) query param.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const uid = params.get('uid');
    const realUid = params.get('realUid');

    if (realUid) {
      const existing = convs.find(c => c.participant.uid === realUid);
      if (existing) { setActiveId(existing.id); setMobileView('chat'); return; }
      lookupUserByUid(realUid).then(data => {
        if (!data) return;
        const participant = {
          uid: realUid, username: data.username ?? realUid, displayName: data.displayName ?? 'Player',
          email: '', mmr: data.mmr ?? 1200, tier: getTier(data.mmr ?? 1200),
          globalRank: 0, state: 'Kuala Lumpur' as const, area: '',
          stats: data.stats ?? { wins: 0, losses: 0, totalMatches: 0 }, joinedAt: '',
          photoURL: data.photoURL ?? null,
        };
        setPendingRealConv({ id: `pending_${realUid}`, participant, lastMessage: '', lastAt: new Date().toISOString(), unread: 0, messages: [] });
        setActiveId(`pending_${realUid}`);
        setMobileView('chat');
      }).catch(() => {});
      return;
    }
    if (!uid) return;

    const existing = convs.find(c => c.participant.uid === uid);
    if (existing) {
      setActiveId(existing.id);
      setMobileView('chat');
      setConvs(cs => cs.map(c => c.id === existing.id ? { ...c, unread: 0 } : c));
    } else {
      const participant = [ME, ...PLAYERS].find(p => p.uid === uid);
      if (!participant) return;
      const newConv = {
        id: `conv_${uid}_${Date.now()}`,
        participant,
        lastMessage: '',
        lastAt: new Date().toISOString(),
        unread: 0,
        messages: [],
      };
      setConvs(cs => [newConv, ...cs]);
      setActiveId(newConv.id);
      setMobileView('chat');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once the real conversation actually exists (first message sent, from
  // either side), it shows up in `convs` via the live listener — drop the shell.
  useEffect(() => {
    if (!pendingRealConv) return;
    const real = convs.find(c => c.participant.uid === pendingRealConv.participant.uid);
    if (real) { setPendingRealConv(null); setActiveId(real.id); }
  }, [convs, pendingRealConv]);

  const active = (pendingRealConv?.id === activeId ? pendingRealConv : null) ?? convs.find(c => c.id === activeId) ?? null;

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [active?.messages]);

  // Marks the open conversation read — both on open and as new messages
  // stream in while it's the active one, so the badge never lingers on a
  // chat you're actively looking at. No-op for demo conversation ids (real
  // conversations only — see markRealConvRead).
  useEffect(() => {
    if (active) markRealConvRead(active.id);
  }, [active?.id, active?.messages.length, markRealConvRead]);

  const openConv = (id: string) => {
    setActiveId(id);
    setMobileView('chat');
    setConvs(cs => cs.map(c => c.id === id ? { ...c, unread: 0 } : c));
  };

  const send = () => {
    if (!input.trim() || !active) return;

    if (isRealUid(active.participant.uid)) {
      sendRealMessage(active.participant.uid, {
        displayName: active.participant.displayName, username: active.participant.username,
        tier: active.participant.tier, mmr: active.participant.mmr, photoURL: active.participant.photoURL ?? null,
      }, input.trim());
      setInput('');
      return;
    }

    const msg: Message = { id: `msg-${Date.now()}`, senderId: user.uid, text: input.trim(), sentAt: new Date().toISOString() };
    setConvs(cs => {
      const updated = cs.map(c => c.id === activeId
        ? { ...c, messages: [...c.messages, msg], lastMessage: input.trim(), lastAt: msg.sentAt, unread: 0 }
        : c
      );
      // Persist to Firestore
      const uid = auth.currentUser?.uid;
      if (uid) {
        const conv = updated.find(c => c.id === activeId);
        if (conv) {
          saveConversation(uid, {
            id: conv.id,
            participantUid: conv.participant.uid,
            lastMessage: conv.lastMessage,
            lastAt: conv.lastAt,
            unread: conv.unread,
            messages: conv.messages,
          }).catch(() => {});
        }
      }
      return updated;
    });
    setInput('');
  };

  const filtered = convs.filter(c => c.participant.displayName.toLowerCase().includes(query.toLowerCase()));
  const totalUnread = convs.reduce((s, c) => s + c.unread, 0);

  const ConvList = (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden h-full">
      <div className="p-3 border-b border-slate-800">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search…"
            className="w-full pl-8 pr-3 py-2 bg-slate-800 rounded-xl text-sm outline-none focus:ring-1 ring-emerald-500 transition-all"/>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-10">No conversations yet.</p>
        )}
        {filtered.map(c => (
          <button key={c.id} onClick={() => openConv(c.id)} className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left
            ${c.id === activeId ? 'bg-slate-800' : 'hover:bg-slate-800/50'}`}>
            <div className="relative">
              <Avatar name={c.participant.displayName} size="sm"/>
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-900"/>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold truncate">{c.participant.displayName}</p>
                <p className="text-[10px] text-slate-500 shrink-0 ml-1">{timeAgo(c.lastAt)}</p>
              </div>
              <p className="text-xs text-slate-500 truncate mt-0.5">{c.lastMessage}</p>
            </div>
            {c.unread > 0 && (
              <span className="w-5 h-5 bg-emerald-500 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0">{c.unread}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );

  const ChatWindow = active ? (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden h-full">
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-800">
        <button onClick={() => setMobileView('list')} className="md:hidden text-slate-400 hover:text-white mr-1">
          <ArrowLeft size={18}/>
        </button>
        <a href={`/players/${active.participant.username}/`} className="flex items-center gap-3 min-w-0 flex-1 hover:opacity-80 transition-opacity">
          <div className="relative shrink-0">
            <Avatar name={active.participant.displayName} size="sm"/>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-900"/>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="font-semibold text-sm truncate">{active.participant.displayName}</p>
              <p className="text-xs text-slate-500 shrink-0">@{active.participant.username}</p>
            </div>
            <div className="flex items-center gap-1 flex-nowrap overflow-hidden">
              <span className="text-xs text-emerald-400 shrink-0">● Online</span>
              <span className="text-slate-600 shrink-0">·</span>
              <TierBadge tier={active.participant.tier}/>
              <span className="text-xs text-slate-500 shrink-0">{active.participant.mmr} MMR</span>
            </div>
          </div>
        </a>
        <button
          onClick={() => { window.location.href = `/players/${active.participant.username}/?challenge=1`; }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-semibold transition-colors">
          <Zap size={12}/> Challenge
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {active.messages.map(m => {
          const isMe = m.senderId === user.uid;
          return (
            <div key={m.id} className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
              {!isMe && <Avatar name={active.participant.displayName} size="sm" className="mb-0.5 shrink-0"/>}
              <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed
                ${isMe ? 'bg-emerald-600/80 text-white rounded-br-sm' : 'bg-slate-800 text-slate-200 rounded-bl-sm'}`}>
                {m.text}
                <p className={`text-[10px] mt-1 ${isMe ? 'text-emerald-200/60' : 'text-slate-500'}`}>{timeAgo(m.sentAt)}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef}/>
      </div>

      <div className="px-4 py-3 border-t border-slate-800 flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Type a message…"
          className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-500 transition-colors"/>
        <button onClick={send} disabled={!input.trim()} aria-label="Send message"
          className="w-10 h-10 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 rounded-xl flex items-center justify-center transition-colors shrink-0">
          <Send size={16}/>
        </button>
      </div>
    </div>
  ) : (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-3 text-slate-500 text-sm h-full">
      <MessageCircle size={28} className="opacity-30"/>
      <p>No conversations yet. Challenge a player to get started!</p>
      <Link href="/players/"
        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold transition-colors">
        Browse Players
      </Link>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold">Messages</h1>
        {totalUnread > 0 && (
          <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{totalUnread}</span>
        )}
      </div>

      {/* Desktop: side-by-side */}
      <div className="hidden md:grid md:grid-cols-[300px_1fr] gap-4 h-[72vh]">
        {ConvList}
        {ChatWindow}
      </div>

      {/* Mobile: list OR chat */}
      <div className="md:hidden h-[72vh]">
        {mobileView === 'list' ? ConvList : ChatWindow}
      </div>
    </div>
  );
}
