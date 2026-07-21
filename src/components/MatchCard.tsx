import type { Match } from '@/types';
import { timeAgo, MATCH_TYPE_LABEL } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';

interface Props {
  match: Match;
  userId: string;
  onClick?: () => void;
}

export function MatchCard({ match: m, userId, onClick }: Props) {
  const isWin       = m.status === 'Confirmed' && m.winnerId === userId;
  const isPending   = m.status === 'Pending';
  const isUnresolved = m.status === 'Disputed' || m.status === 'Cancelled';
  const opponent  = m.player1Id === userId ? m.player2Name : m.player1Name;
  const oppUser   = m.player1Id === userId ? m.player2Username : m.player1Username;
  const scoreStr  = m.games
    .filter(g => g.p1 > 0 || g.p2 > 0)
    .map(g => m.player1Id === userId ? `${g.p1}-${g.p2}` : `${g.p2}-${g.p1}`)
    .join(', ');

  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-3 py-3 px-3 rounded-xl bg-slate-800/50 hover:bg-slate-800 transition-colors text-left group">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 border
        ${isPending || isUnresolved ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
          : isWin   ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-red-500/10 text-red-400 border-red-500/30'}`}>
        {isPending ? '?' : isUnresolved ? '!' : isWin ? 'W' : 'L'}
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate">
          vs. {opponent} <span className="text-slate-500 font-normal text-xs">@{oppUser}</span>
        </div>
        <div className="text-xs text-slate-500 flex items-center gap-1.5">
          {MATCH_TYPE_LABEL[m.type]} · {timeAgo(m.playedAt)}
          {m.mode === 'casual' && <span className="text-[9px] font-bold text-slate-400 bg-slate-700/60 px-1.5 py-0.5 rounded">CASUAL</span>}
        </div>
      </div>

      <div className="text-right shrink-0">
        {m.status === 'Confirmed' && scoreStr && <div className="text-xs text-slate-400 font-mono">{scoreStr}</div>}
        {m.status === 'Confirmed' && m.mmrChange !== undefined && m.mmrChange !== 0 && (
          <div className={`text-xs font-bold ${m.mmrChange > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {m.mmrChange > 0 ? '+' : ''}{m.mmrChange}
          </div>
        )}
        {isPending && <div className="text-xs text-amber-400 font-medium">Pending</div>}
        {isUnresolved && <div className="text-xs text-amber-400 font-medium">{m.status}</div>}
      </div>

      <ChevronRight size={14} className="text-slate-600 group-hover:text-slate-400 transition-colors shrink-0" />
    </button>
  );
}
