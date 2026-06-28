'use client';
import type { Match } from '@/types';
import { X, MapPin, Calendar, Clock } from 'lucide-react';
import { MATCH_TYPE_LABEL, formatDate, formatTime } from '@/lib/utils';
import { Avatar } from '@/components/ui/Avatar';

interface Props { match: Match | null; onClose: () => void }

export function MatchDetailModal({ match: m, onClose }: Props) {
  if (!m) return null;

  const isWin     = m.winnerId === 'me';
  const isPending = m.status === 'Pending';
  const myName    = m.player1Id === 'me' ? m.player1Name : m.player2Name;
  const myUser    = m.player1Id === 'me' ? m.player1Username : m.player2Username;
  const oppName   = m.player1Id === 'me' ? m.player2Name : m.player1Name;
  const oppUser   = m.player1Id === 'me' ? m.player2Username : m.player1Username;

  const gameScores = m.games.map(g =>
    m.player1Id === 'me' ? g : { p1: g.p2, p2: g.p1 }
  );

  const myGamesWon  = gameScores.filter(g => g.p1 > g.p2).length;
  const oppGamesWon = gameScores.filter(g => g.p2 > g.p1).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide">{MATCH_TYPE_LABEL[m.type]}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border
                ${isPending ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : m.status === 'Confirmed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>
                {m.status}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X size={20}/></button>
        </div>

        {/* Players */}
        <div className="p-5">
          <div className="flex items-center justify-between mb-5">
            {/* Me */}
            <div className="flex flex-col items-center gap-2 flex-1">
              <Avatar name={myName} size="lg" className={isWin && !isPending ? 'ring-2 ring-emerald-400' : ''} />
              <div className="text-center">
                <p className="font-bold text-sm">{myName}</p>
                <p className="text-xs text-slate-400">@{myUser}</p>
              </div>
              {!isPending && (
                <span className={`text-2xl font-black ${isWin ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {myGamesWon}
                </span>
              )}
            </div>

            {/* VS */}
            <div className="flex flex-col items-center px-4">
              {isPending ? (
                <span className="text-amber-400 text-sm font-bold">Pending</span>
              ) : (
                <span className={`text-sm font-bold px-3 py-1 rounded-lg ${isWin ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                  {isWin ? 'WIN' : 'LOSS'}
                </span>
              )}
              <span className="text-slate-600 text-xs mt-1">vs</span>
              {m.mmrChange !== undefined && m.mmrChange !== 0 && (
                <span className={`text-sm font-bold mt-2 ${m.mmrChange > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {m.mmrChange > 0 ? '+' : ''}{m.mmrChange} MMR
                </span>
              )}
            </div>

            {/* Opponent */}
            <div className="flex flex-col items-center gap-2 flex-1">
              <Avatar name={oppName} size="lg" className={!isWin && !isPending ? 'ring-2 ring-emerald-400' : ''} />
              <div className="text-center">
                <p className="font-bold text-sm">{oppName}</p>
                <p className="text-xs text-slate-400">@{oppUser}</p>
              </div>
              {!isPending && (
                <span className={`text-2xl font-black ${!isWin ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {oppGamesWon}
                </span>
              )}
            </div>
          </div>

          {/* Game scores */}
          {!isPending && (
            <div className="space-y-2 mb-4">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Game Scores</p>
              {gameScores.map((g, i) => {
                const myWin = g.p1 > g.p2;
                return (
                  <div key={i} className="flex items-center gap-3 bg-slate-800/60 rounded-xl px-4 py-2.5">
                    <span className="text-xs text-slate-500 w-14">Game {i + 1}</span>
                    <div className="flex-1 flex items-center justify-between">
                      <span className={`text-lg font-bold ${myWin ? 'text-white' : 'text-slate-500'}`}>{g.p1}</span>
                      <span className="text-slate-600 text-sm">—</span>
                      <span className={`text-lg font-bold ${!myWin ? 'text-white' : 'text-slate-500'}`}>{g.p2}</span>
                    </div>
                    <span className={`text-xs font-semibold ${myWin ? 'text-emerald-400' : 'text-red-400'}`}>
                      {myWin ? 'Won' : 'Lost'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Meta */}
          <div className="space-y-2 text-sm text-slate-400 border-t border-slate-800 pt-4">
            {m.venue && (
              <div className="flex items-center gap-2">
                <MapPin size={13} className="text-slate-500 shrink-0" />
                <span>{m.venue}</span>
              </div>
            )}
            {m.location && (
              <div className="flex items-center gap-2">
                <span className="text-slate-600 text-xs ml-[18px]">{m.location}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Calendar size={13} className="text-slate-500 shrink-0" />
              <span>{formatDate(m.playedAt)}</span>
              <Clock size={13} className="text-slate-500 ml-2 shrink-0" />
              <span>{formatTime(m.playedAt)}</span>
            </div>
          </div>
        </div>

        <div className="px-5 pb-5">
          <button onClick={onClose} className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-semibold transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
