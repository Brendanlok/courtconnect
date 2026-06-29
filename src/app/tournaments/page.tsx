'use client';
import { useState } from 'react';
import { TOURNAMENTS } from '@/lib/data';
import { useApp } from '@/context/AppContext';
import { ChevronDown, ChevronUp, MapPin, Users, Lock, Trophy } from 'lucide-react';
import { MATCH_TYPE_LABEL } from '@/lib/utils';
import type { Tournament, BracketMatch } from '@/types';

const TABS = ['Active','Upcoming','Completed'] as const;

export default function Tournaments() {
  const { user } = useApp();
  const [tab, setTab] = useState<typeof TABS[number]>('Active');
  const [registered, setRegistered] = useState<string[]>([]);

  const list = TOURNAMENTS.filter(t => t.status === tab);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tournaments</h1>
          <p className="text-slate-400 text-sm mt-1">🇲🇾 Malaysia</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-xl text-sm transition-colors">
          <Trophy size={14}/> Host
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors
              ${tab === t ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
            {t}
            <span className="ml-1.5 text-xs opacity-50">({TOURNAMENTS.filter(x => x.status === t).length})</span>
          </button>
        ))}
      </div>

      {list.length === 0 && (
        <div className="text-center py-20 text-slate-500">No {tab.toLowerCase()} tournaments.</div>
      )}

      <div className="space-y-3">
        {list.map(t => (
          <TournamentRow key={t.id} tournament={t} myMMR={user.mmr}
            registered={registered.includes(t.id)}
            onRegister={() => setRegistered(r => [...r, t.id])} />
        ))}
      </div>
    </div>
  );
}

function TournamentRow({ tournament: t, myMMR, registered, onRegister }: {
  tournament: Tournament; myMMR: number; registered: boolean; onRegister: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const spotsLeft = t.maxPlayers - t.currentPlayers;
  const locked    = !!(t.minMMR && myMMR < t.minMMR);
  const isFull    = spotsLeft <= 0;
  const fillPct   = Math.round((t.currentPlayers / t.maxPlayers) * 100);

  return (
    <div className={`bg-slate-900 border rounded-2xl overflow-hidden transition-all
      ${t.status === 'Active' ? 'border-emerald-500/30' : 'border-slate-800'}`}>

      {/* Compact row — always visible, whole row is clickable */}
      <div className="flex items-center gap-4 px-5 py-4 cursor-pointer select-none hover:bg-slate-800/40 transition-colors" onClick={() => setExpanded(e => !e)}>
        {/* Status dot */}
        <div className="shrink-0">
          {t.status === 'Active' && <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full block animate-pulse"/>}
          {t.status === 'Upcoming' && <span className="w-2.5 h-2.5 bg-amber-400 rounded-full block"/>}
          {t.status === 'Completed' && <span className="w-2.5 h-2.5 bg-slate-500 rounded-full block"/>}
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm truncate">{t.name}</p>
            {t.tags.slice(0,2).map(tag => (
              <span key={tag} className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-md shrink-0">{tag}</span>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-0.5"><MapPin size={10}/> {t.venue}, {t.state}</span>
            <span>·</span>
            <span>{new Date(t.date).toLocaleDateString('en-MY', {day:'numeric',month:'short',year:'numeric'})}</span>
            <span>·</span>
            <span className="flex items-center gap-0.5"><Users size={10}/> {t.currentPlayers}/{t.maxPlayers}</span>
          </p>
        </div>

        {/* Prize / entry */}
        <div className="text-right shrink-0">
          {t.prizePool > 0 ? (
            <p className="text-sm font-bold text-amber-400">RM {t.prizePool.toLocaleString()}</p>
          ) : (
            <p className="text-sm font-bold text-emerald-400">Free</p>
          )}
          {t.entryFee > 0 && <p className="text-[10px] text-slate-500">Entry: RM {t.entryFee}</p>}
        </div>

        {/* Expand indicator */}
        <span className="text-slate-500 shrink-0">
          {expanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
        </span>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-slate-800 px-5 py-4 space-y-4">
          {/* Description */}
          {t.description && (
            <p className="text-sm text-slate-300 leading-relaxed">{t.description}</p>
          )}

          {/* Key details grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Detail label="Format" value={MATCH_TYPE_LABEL[t.type]}/>
            <Detail label="Players" value={`${t.currentPlayers}/${t.maxPlayers}`}/>
            <Detail label="Min MMR" value={t.minMMR ? t.minMMR.toLocaleString() : 'Open'}/>
            <Detail label="Organiser" value={t.organiser ?? '—'}/>
          </div>

          {/* Fill bar */}
          <div>
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>Capacity</span>
              <span>{isFull ? 'Full' : `${spotsLeft} spots left`}</span>
            </div>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${isFull ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width:`${fillPct}%` }}/>
            </div>
          </div>

          {/* Prize breakdown */}
          {t.prizePool > 0 && (
            <div className="flex gap-2 flex-wrap">
              <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs px-2.5 py-1.5 rounded-xl">
                🥇 RM {Math.round(t.prizePool * 0.6)}
              </span>
              <span className="bg-slate-800 text-slate-400 text-xs px-2.5 py-1.5 rounded-xl">
                🥈 RM {Math.round(t.prizePool * 0.3)}
              </span>
              <span className="bg-slate-800 text-slate-400 text-xs px-2.5 py-1.5 rounded-xl">
                🥉 RM {Math.round(t.prizePool * 0.1)}
              </span>
              <span className="text-xs text-slate-500 self-center ml-1">Auto-distributed after final</span>
            </div>
          )}

          {/* Bracket */}
          {t.bracket && t.status !== 'Upcoming' && (
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-3">Live Bracket</p>
              <BracketView bracket={t.bracket} />
            </div>
          )}

          {/* Action */}
          {t.status === 'Upcoming' && (
            <button onClick={e => { e.stopPropagation(); onRegister(); }} disabled={registered || isFull || locked}
              className={`flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors
                ${locked  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : registered ? 'bg-slate-700 text-slate-400 cursor-default'
                : isFull  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}>
              {locked ? <><Lock size={13}/> Need {t.minMMR?.toLocaleString()} MMR</> : registered ? '✓ Registered' : 'Register Now'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-800 rounded-xl px-3 py-2.5">
      <p className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-semibold mt-0.5 truncate">{value}</p>
    </div>
  );
}

// ─── Bracket tree ──────────────────────────────────────────────────────────

const CARD_H  = 72;   // px — height of one match card (two player rows)
const CARD_W  = 180;  // px
const BASE_GAP = 12;  // gap between matches in round 1
const CONN_W  = 36;   // width of SVG connector strip

function roundGap(ri: number): number {
  return ri === 0 ? BASE_GAP : CARD_H + 2 * roundGap(ri - 1);
}

function roundTopPad(ri: number): number {
  if (ri === 0) return 0;
  const prevGap = roundGap(ri - 1);
  const prevPad = roundTopPad(ri - 1);
  const f1 = prevPad + CARD_H / 2;
  const f2 = f1 + CARD_H + prevGap;
  return (f1 + f2) / 2 - CARD_H / 2;
}

function BracketView({ bracket }: { bracket: BracketMatch[] }) {
  const rounds      = [...new Set(bracket.map(b => b.round))].sort();
  const byRound     = rounds.map(r => bracket.filter(b => b.round === r));
  const r1Count     = byRound[0]?.length ?? 1;
  const totalH      = r1Count * CARD_H + (r1Count - 1) * BASE_GAP;
  const ROUND_LABELS = ['QF', 'SF', 'Final', 'R4', 'R5'];

  return (
    <div className="overflow-x-auto pb-2">
      {/* Round labels row */}
      <div className="flex mb-2">
        {byRound.map((_, ri) => (
          <div key={ri} className="flex items-center">
            <div style={{ width: CARD_W }} className="text-center">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                {ROUND_LABELS[rounds[ri] - 1] ?? `R${rounds[ri]}`}
              </span>
            </div>
            {ri < byRound.length - 1 && <div style={{ width: CONN_W }} />}
          </div>
        ))}
      </div>

      {/* Bracket body */}
      <div className="flex" style={{ height: totalH }}>
        {byRound.map((matches, ri) => {
          const pad  = roundTopPad(ri);
          const gap  = roundGap(ri);
          const isLast = ri === byRound.length - 1;

          return (
            <div key={ri} className="flex items-start shrink-0">
              {/* Match cards column */}
              <div className="flex flex-col shrink-0" style={{ paddingTop: pad, gap }}>
                {matches.map(m => <BracketCard key={m.id} match={m} />)}
              </div>

              {/* SVG connector to next round */}
              {!isLast && (
                <svg width={CONN_W} height={totalH} className="shrink-0 overflow-visible">
                  {Array.from({ length: Math.ceil(matches.length / 2) }).map((_, i) => {
                    const m1Y = pad + i * 2 * (CARD_H + gap) + CARD_H / 2;
                    const m2Y = m1Y + CARD_H + gap;
                    const midY = (m1Y + m2Y) / 2;
                    const cx  = CONN_W / 2;
                    const color = '#334155';
                    return (
                      <g key={i}>
                        <line x1={0}   y1={m1Y}  x2={cx}  y2={m1Y}  stroke={color} strokeWidth={1.5} strokeLinecap="round"/>
                        <line x1={0}   y1={m2Y}  x2={cx}  y2={m2Y}  stroke={color} strokeWidth={1.5} strokeLinecap="round"/>
                        <line x1={cx}  y1={m1Y}  x2={cx}  y2={m2Y}  stroke={color} strokeWidth={1.5} strokeLinecap="round"/>
                        <line x1={cx}  y1={midY} x2={CONN_W} y2={midY} stroke={color} strokeWidth={1.5} strokeLinecap="round"/>
                      </g>
                    );
                  })}
                </svg>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BracketCard({ match: m }: { match: BracketMatch }) {
  const isLive = !m.winner && !!m.player1 && m.player1 !== 'TBD' && !!m.player2 && m.player2 !== 'TBD';
  return (
    <div style={{ width: CARD_W, height: CARD_H }}
      className={`rounded-xl overflow-hidden border text-sm flex flex-col
        ${isLive ? 'border-amber-500/50' : m.winner ? 'border-slate-700' : 'border-slate-800/80'}`}>
      {[m.player1, m.player2].map((name, i) => (
        <div key={i} className={`flex-1 px-3 flex items-center justify-between border-b last:border-0 border-slate-800
          ${name === m.winner ? 'bg-emerald-500/10 text-emerald-400 font-semibold'
            : !name || name === 'TBD' ? 'text-slate-600' : 'text-slate-300'}`}>
          <span className="truncate text-xs">{name || 'TBD'}</span>
          <div className="flex items-center gap-1.5 shrink-0 ml-1">
            {m.score && name === m.winner && (
              <span className="text-[9px] text-slate-500">{m.score.split(',')[i === 0 ? 0 : m.score.split(',').length > 1 ? 1 : 0]?.trim()}</span>
            )}
            {isLive && <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse"/>}
          </div>
        </div>
      ))}
    </div>
  );
}
