'use client';
import { useState, useRef, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { CONVERSATIONS } from '@/lib/data';
import { Avatar } from '@/components/ui/Avatar';
import { TierBadge } from '@/components/ui/TierBadge';
import { timeAgo } from '@/lib/utils';
import { Send, Zap, Search } from 'lucide-react';
import type { Conversation, Message } from '@/types';

export default function Chat() {
  const { user } = useApp();
  const [convs, setConvs]     = useState<Conversation[]>(CONVERSATIONS);
  const [activeId, setActiveId] = useState(CONVERSATIONS[0]?.id ?? null);
  const [input, setInput]     = useState('');
  const [query, setQuery]     = useState('');
  const bottomRef             = useRef<HTMLDivElement>(null);

  const active = convs.find(c => c.id === activeId) ?? null;

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }); }, [active?.messages]);

  const openConv = (id: string) => {
    setActiveId(id);
    setConvs(cs => cs.map(c => c.id === id ? { ...c, unread:0 } : c));
  };

  const send = () => {
    if (!input.trim()) return;
    const msg: Message = { id:`msg-${Date.now()}`, senderId: user.uid, text: input.trim(), sentAt: new Date().toISOString() };
    setConvs(cs => cs.map(c => c.id === activeId
      ? { ...c, messages:[...c.messages, msg], lastMessage: input.trim(), lastAt: msg.sentAt, unread:0 }
      : c
    ));
    setInput('');
  };

  const filtered = convs.filter(c => c.participant.displayName.toLowerCase().includes(query.toLowerCase()));
  const totalUnread = convs.reduce((s, c) => s + c.unread, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold">Messages</h1>
        {totalUnread > 0 && (
          <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{totalUnread}</span>
        )}
      </div>

      <div className="grid md:grid-cols-[300px_1fr] gap-4 h-[72vh]">
        {/* Conversation list */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden">
          <div className="p-3 border-b border-slate-800">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Search…"
                className="w-full pl-8 pr-3 py-2 bg-slate-800 rounded-xl text-sm outline-none focus:ring-1 ring-emerald-500 transition-all"/>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
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

        {/* Chat window */}
        {!active && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center text-slate-500 text-sm">
            No conversations yet. Challenge a player to get started!
          </div>
        )}
        {active && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-800">
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
              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-semibold transition-colors">
                <Zap size={12}/> Challenge
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {active.messages.map(m => {
                const isMe = m.senderId === user.uid;
                return (
                  <div key={m.id} className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                    {!isMe && <Avatar name={active.participant.displayName} size="sm" className="mb-0.5 shrink-0"/>}
                    <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed
                      ${isMe ? 'bg-emerald-600/80 text-white rounded-br-sm' : 'bg-slate-800 text-slate-200 rounded-bl-sm'}`}>
                      {m.text}
                      <p className={`text-[10px] mt-1 ${isMe ? 'text-emerald-200/60' : 'text-slate-500'}`}>{timeAgo(m.sentAt)}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef}/>
            </div>

            {/* Input */}
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
        )}
      </div>
    </div>
  );
}
