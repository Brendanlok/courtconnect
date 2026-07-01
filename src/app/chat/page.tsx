'use client';
import { useState, useRef, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { Avatar } from '@/components/ui/Avatar';
import { TierBadge } from '@/components/ui/TierBadge';
import { timeAgo } from '@/lib/utils';
import { Send, Zap, Search, ArrowLeft } from 'lucide-react';
import type { Message } from '@/types';

export default function Chat() {
  const { user, conversations: convs, setConversations: setConvs } = useApp();
  const [activeId,   setActiveId]   = useState<string | null>(convs[0]?.id ?? null);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const [input,      setInput]      = useState('');
  const [query,      setQuery]      = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  // Open conversation for a specific player uid passed via ?uid= query param
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const uid = params.get('uid');
    if (!uid) return;
    const conv = convs.find(c => c.participant.uid === uid);
    if (conv) {
      setActiveId(conv.id);
      setMobileView('chat');
      setConvs(cs => cs.map(c => c.id === conv.id ? { ...c, unread: 0 } : c));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const active = convs.find(c => c.id === activeId) ?? null;

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [active?.messages]);

  const openConv = (id: string) => {
    setActiveId(id);
    setMobileView('chat');
    setConvs(cs => cs.map(c => c.id === id ? { ...c, unread: 0 } : c));
  };

  const send = () => {
    if (!input.trim()) return;
    const msg: Message = { id: `msg-${Date.now()}`, senderId: user.uid, text: input.trim(), sentAt: new Date().toISOString() };
    setConvs(cs => cs.map(c => c.id === activeId
      ? { ...c, messages: [...c.messages, msg], lastMessage: input.trim(), lastAt: msg.sentAt, unread: 0 }
      : c
    ));
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
        <div className="relative">
          <Avatar name={active.participant.displayName} size="sm"/>
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-900"/>
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm">{active.participant.displayName}</p>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-emerald-400">● Online</span>
            <span className="text-slate-600">·</span>
            <TierBadge tier={active.participant.tier} className="text-[10px] px-1.5 py-0"/>
            <span className="text-xs text-slate-500">{active.participant.mmr} MMR</span>
          </div>
        </div>
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
        <button onClick={send} disabled={!input.trim()}
          className="w-10 h-10 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 rounded-xl flex items-center justify-center transition-colors shrink-0">
          <Send size={16}/>
        </button>
      </div>
    </div>
  ) : (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center text-slate-500 text-sm h-full">
      No conversations yet. Challenge a player to get started!
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
