'use client';
import type { Match } from '@/types';
import { X, MapPin, Calendar, Clock, CheckCircle, XCircle, Radio } from 'lucide-react';
import { MATCH_TYPE_LABEL, formatDate, formatTime } from '@/lib/utils';
import { Avatar } from '@/components/ui/Avatar';
import { useModalA11y } from '@/hooks/useModalA11y';
import { Button } from '@/components/ui/Button';
import { PointLogTable } from '@/components/LiveMatchModal';

interface Props {
  match: Match | null;
  onClose: () => void;
  onConfirm?: () => void;
  onDispute?: () => void;
  onCancel?: () => void;
}

export function MatchDetailModal({ match: m, onClose, onConfirm, onDispute, onCancel }: Props) {
  const { ref: panelRef, dialogProps } = useModalA11y(!!m, onClose, 'Match Details');
  if (!m) return null;

  const isWin     = m.winnerId === 'me';
  const isPending = m.status === 'Pending';
  const isDisputed = m.status === 'Disputed';
  const isCancelled = m.status === 'Cancelled';
  const hasOutstandingConfirmers = !!(m.pendingConfirmations && m.pendingConfirmations.length > 0);
  // Whether it's genuinely this viewer's move: true for the original local/
  // demo flow (no pendingConfirmations at all — self-confirmable, as always)
  // and for a real match where the outstanding confirmer is specifically
  // 'me'. False when pendingConfirmations lists someone ELSE still owed — a
  // real opponent I'm waiting on, or (existing multi-party Live behavior)
  // other teammates who haven't confirmed yet.
  const isMyTurn = !m.pendingConfirmations || m.pendingConfirmations.includes('me');
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
    <div className="modal-backdrop fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4" onClick={onClose}>
      <div ref={panelRef} {...dialogProps} className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl outline-none" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-wide">{MATCH_TYPE_LABEL[m.type]}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border
                ${isPending   ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                : isDisputed  ? 'bg-red-500/10 text-red-400 border-red-500/30'
                : isCancelled ? 'bg-slate-700 text-slate-400 border-slate-600'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'}`}>
                {m.status}
              </span>
              {m.recordedLive && (
                <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border bg-rose-500/10 text-rose-400 border-rose-500/30">
                  <Radio size={10}/> Live Verified
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-white transition-colors"><X size={20}/></button>
        </div>

        {/* Pending verification notice */}
        {isPending && (
          <div className="mx-5 mt-4 p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl text-xs text-amber-300 flex items-start gap-2">
            <Clock size={13} className="shrink-0 mt-0.5" />
            {hasOutstandingConfirmers && !isMyTurn ? (
              <div>
                <span>Waiting on {m.pendingConfirmations!.length} more player{m.pendingConfirmations!.length > 1 ? 's' : ''} to confirm this result before it's final.</span>
                {onCancel && (
                  <button onClick={onCancel} className="block mt-1.5 text-amber-400/80 hover:text-red-400 underline underline-offset-2 transition-colors">
                    Stop waiting — withdraw this match
                  </button>
                )}
              </div>
            ) : hasOutstandingConfirmers && isMyTurn ? (
              <span>{oppName} reported this result. Confirm or dispute it below.</span>
            ) : (
              <span>Waiting for your opponent to confirm this result. You can also confirm or dispute it yourself below.</span>
            )}
          </div>
        )}

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
                <span className="text-amber-400 text-sm font-bold">?</span>
              ) : (
                <span className={`text-sm font-bold px-3 py-1 rounded-lg ${isWin ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                  {isWin ? 'WIN' : 'LOSS'}
                </span>
              )}
              <span className="text-slate-600 text-xs mt-1">vs</span>
              {!isPending && m.mmrChange !== undefined && m.mmrChange !== 0 && (
                <span className={`text-sm font-bold mt-2 ${m.mmrChange > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {m.mmrChange > 0 ? '+' : ''}{m.mmrChange} MMR
                </span>
              )}
              {isPending && m.mmrChange !== undefined && (
                <span className={`text-xs mt-2 font-semibold ${isWin ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isWin ? '+' : ''}{m.mmrChange} on confirm
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
          {gameScores.some(g => g.p1 > 0 || g.p2 > 0) && (
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

          {/* Live match insights */}
          {m.liveStats && (
            <div className="mb-4 bg-slate-800/60 border border-slate-700 rounded-xl p-3.5">
              <p className="text-xs font-semibold text-slate-400 mb-1.5">Match Insights</p>
              <div className="grid grid-cols-2 gap-y-1.5 text-xs">
                <span className="text-slate-500">Duration</span>
                <span className="text-slate-200 text-right font-semibold tabular-nums">
                  {Math.floor(m.liveStats.durationSec / 60)}:{String(Math.round(m.liveStats.durationSec % 60)).padStart(2, '0')}
                </span>
                <span className="text-slate-500">Longest streak</span>
                <span className="text-slate-200 text-right font-semibold">
                  {m.liveStats.maxWinStreak.count} pts ({m.liveStats.maxWinStreak.side === 'a' ? myName : oppName})
                </span>
                {m.liveStats.biggestComebackPoints > 0 && (
                  <>
                    <span className="text-slate-500">Biggest comeback</span>
                    <span className="text-amber-400 text-right font-semibold">{m.liveStats.biggestComebackPoints} pts</span>
                  </>
                )}
                <span className="text-slate-500">Avg. gap between points</span>
                <span className="text-slate-200 text-right font-semibold">{Math.round(m.liveStats.avgPointGapSec)}s</span>
              </div>
            </div>
          )}

          {/* Point-by-point log, one table per game */}
          {m.pointLog && m.pointLog.length > 0 && (
            <div className="mb-4 space-y-2">
              <p className="text-xs font-semibold text-slate-400">Point Log</p>
              {m.pointLog.map((log, i) => (
                log.length > 0 && (
                  <PointLogTable key={i} log={log} teamAName={myName} teamBName={oppName} active={false} />
                )
              ))}
            </div>
          )}

          {/* Meta */}
          <div className="space-y-2 text-sm text-slate-400 border-t border-slate-800 pt-4">
            {(m.venue || m.location) && (
              <div className="flex items-center gap-2">
                <MapPin size={13} className="text-slate-500 shrink-0" />
                <span>{m.venue || m.location}</span>
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

        {/* Action buttons */}
        <div className="px-5 pb-5 flex gap-3">
          {isPending && onConfirm && onDispute && isMyTurn ? (
            <>
              <Button onClick={onConfirm} icon={<CheckCircle size={15}/>} className="flex-1">
                Confirm Result
              </Button>
              <button onClick={onDispute}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-red-500/20 hover:text-red-400 text-slate-300 rounded-xl font-semibold text-sm transition-colors">
                <XCircle size={15}/> Dispute
              </button>
            </>
          ) : (
            <Button variant="secondary" onClick={onClose} className="w-full">
              Close
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
