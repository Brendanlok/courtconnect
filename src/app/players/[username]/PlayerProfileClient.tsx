'use client';
import { notFound } from 'next/navigation';
import { PLAYERS, MATCHES, MMR_HISTORY, ME } from '@/lib/data';
import { useApp } from '@/context/AppContext';
import { TierBadge } from '@/components/ui/TierBadge';
import { Avatar } from '@/components/ui/Avatar';
import { MatchCard } from '@/components/MatchCard';
import { MatchDetailModal } from '@/components/MatchDetailModal';
import { QRModal } from '@/components/QRModal';
import { tierProgress, nextTier, skillMatch } from '@/lib/utils';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { MapPin, QrCode, MessageCircle, Zap } from 'lucide-react';
import { useState } from 'react';
import type { Match } from '@/types';

const RADAR_DATA = [
  { stat:'Smash', val:72 },{ stat:'Net Play', val:58 },{ stat:'Defense', val:65 },
  { stat:'Footwork', val:80 },{ stat:'Stamina', val:74 },{ stat:'Serve', val:68 },
];

const ACHIEVEMENTS = [
  { icon:'🔥', name:'Hot Streak',  desc:'5 wins in a row',       done:true },
  { icon:'🏅', name:'First Blood', desc:'Win your first match',   done:true },
  { icon:'📈', name:'On the Rise', desc:'+100 MMR in a week',     done:true },
  { icon:'💎', name:'Diamond',     desc:'Reach 2000 MMR',         done:false },
  { icon:'🏆', name:'Champion',    desc:'Win a tournament',        done:false },
  { icon:'🤝', name:'Centurion',   desc:'Play 100 matches',        done:false },
];

export function PlayerProfileClient({ username }: { username: string }) {
  const { user: ctxUser } = useApp();
  const staticPlayer = [ME, ...PLAYERS].find(p => p.username === username);
  if (!staticPlayer) return notFound();

  const isMe   = staticPlayer.uid === 'me';
  const player = isMe ? ctxUser : staticPlayer;
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [qrOpen, setQrOpen]               = useState(false);

  const progress = tierProgress(player.mmr, player.tier);
  const { name: nextName, threshold } = nextTier(player.tier);
  const wr  = Math.round((player.stats.wins / Math.max(player.stats.totalMatches, 1)) * 100);
  const sm  = isMe ? 100 : skillMatch(ME.mmr, player.mmr);
  const playerMatches = MATCHES.filter(m => m.player1Id === player.uid || m.player2Id === player.uid);

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-br from-slate-900 to-emerald-950/20 border border-emerald-500/20 rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row gap-5 items-start">
            <Avatar name={player.displayName} size="lg" className="ring-4 ring-emerald-500/20"/>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold">{player.displayName}</h1>
                <span className="text-slate-400 text-base">@{player.username}</span>
                <TierBadge tier={player.tier}/>
              </div>
              <p className="text-slate-400 text-sm flex items-center gap-1.5">
                <MapPin size={12}/> {player.area}, {player.state}
                <span className="text-slate-600">·</span>
                <span>#{player.globalRank} National</span>
              </p>
              {player.openToPlay && (
                <span className="inline-flex items-center gap-1.5 mt-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"/>Open to play today
                </span>
              )}
              {player.bio && <p className="text-slate-300 text-sm mt-2">{player.bio}</p>}

              <div className="flex flex-wrap gap-5 mt-4">
                {[
                  { label:'MMR',      val:player.mmr.toLocaleString(), color:'text-amber-400' },
                  { label:'Wins',     val:player.stats.wins,           color:'text-emerald-400' },
                  { label:'Losses',   val:player.stats.losses,         color:'text-red-400' },
                  { label:'Matches',  val:player.stats.totalMatches,   color:'' },
                  { label:'Win Rate', val:`${wr}%`,                    color:'text-emerald-400' },
                ].map(s => (
                  <div key={s.label} className="text-center">
                    <p className={`text-xl font-bold ${s.color}`}>{s.val}</p>
                    <p className="text-xs text-slate-500">{s.label}</p>
                  </div>
                ))}
              </div>

              {nextName && (
                <div className="mt-4 max-w-xs">
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>{player.tier}</span>
                    <span>{nextName} @ {threshold.toLocaleString()}</span>
                  </div>
                  <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-amber-400 rounded-full" style={{ width:`${progress}%` }}/>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 flex-wrap">
              {isMe ? (
                <>
                  <button onClick={() => setQrOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium transition-colors">
                    <QrCode size={14}/> QR Code
                  </button>
                  <button className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium transition-colors">
                    Edit Profile
                  </button>
                </>
              ) : (
                <>
                  <button className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-semibold transition-colors">
                    <Zap size={14}/> Challenge
                  </button>
                  <button className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium transition-colors">
                    <MessageCircle size={14}/> Message
                  </button>
                  <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 rounded-xl text-sm text-slate-400">
                    Skill match: <span className={`font-bold ml-1 ${sm>=80?'text-emerald-400':sm>=60?'text-amber-400':'text-red-400'}`}>{sm}%</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          {/* MMR chart */}
          {isMe && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <h2 className="font-semibold mb-4">MMR Progression</h2>
              <ResponsiveContainer width="100%" height={150}>
                <AreaChart data={MMR_HISTORY} margin={{ top:4, right:4, left:-24, bottom:0 }}>
                  <defs>
                    <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize:10, fill:'#64748b' }} tickLine={false} axisLine={false} interval={2}/>
                  <YAxis tick={{ fontSize:10, fill:'#64748b' }} tickLine={false} axisLine={false} domain={['auto','auto']}/>
                  <Tooltip contentStyle={{ background:'#0f172a', border:'1px solid #334155', borderRadius:8, fontSize:12 }}
                    labelStyle={{ color:'#94a3b8' }} itemStyle={{ color:'#10b981' }}/>
                  <Area type="monotone" dataKey="mmr" stroke="#10b981" strokeWidth={2.5} fill="url(#pg)" dot={false}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Radar */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h2 className="font-semibold mb-2">Skills</h2>
            <ResponsiveContainer width="100%" height={190}>
              <RadarChart data={RADAR_DATA}>
                <PolarGrid stroke="#334155"/>
                <PolarAngleAxis dataKey="stat" tick={{ fontSize:11, fill:'#94a3b8' }}/>
                <PolarRadiusAxis angle={90} domain={[0,100]} tick={false} axisLine={false}/>
                <Radar dataKey="val" stroke="#10b981" fill="#10b981" fillOpacity={0.15} strokeWidth={2}/>
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          {/* Match history */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h2 className="font-semibold mb-3">Match History</h2>
            {playerMatches.length === 0 ? (
              <p className="text-slate-500 text-sm py-4 text-center">No matches recorded yet.</p>
            ) : (
              <div className="space-y-1">
                {playerMatches.slice(0,6).map(m => (
                  <MatchCard key={m.id} match={m} userId={player.uid} onClick={() => setSelectedMatch(m)}/>
                ))}
              </div>
            )}
          </div>

          {/* Achievements */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h2 className="font-semibold mb-3">Achievements</h2>
            <div className="grid grid-cols-2 gap-2">
              {ACHIEVEMENTS.map(a => (
                <div key={a.name}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border transition-opacity
                    ${a.done ? 'bg-slate-800 border-slate-700' : 'bg-slate-900 border-slate-800 opacity-35'}`}>
                  <span className="text-xl">{a.icon}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{a.name}</p>
                    <p className="text-[10px] text-slate-500 truncate">{a.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <MatchDetailModal match={selectedMatch} onClose={() => setSelectedMatch(null)}/>
      {isMe && <QRModal open={qrOpen} onClose={() => setQrOpen(false)}/>}
    </>
  );
}
