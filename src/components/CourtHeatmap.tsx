'use client';
import type { CourtPosition } from '@/types';

interface Props {
  positions: CourtPosition[];
  className?: string;
  showStats?: boolean;
  tapMode?: boolean;
  onTap?: (pos: CourtPosition) => void;
}

// SVG court: 320×146 (landscape) ≈ 13.4m × 6.1m
const W = 320, H = 146;

// Court line positions (px, 23.88 px/m)
const NET_X   = 160;  // 6.7m from each end
const SS_L    = 113;  // short service line left  (1.98m from net)
const SS_R    = 207;  // short service line right
const LS_L    = 18;   // doubles long service line left (0.76m from back)
const LS_R    = 302;  // doubles long service line right
const SGL_T   = 11;   // singles top sideline (0.46m from edge)
const SGL_B   = 135;  // singles bottom sideline
const CTR_Y   = 73;   // center (court width / 2)

const ZONES: { key: string; label: string; xMin: number; xMax: number; yMin: number; yMax: number }[] = [
  { key: 'nearLeft',  label: 'Near Left',  xMin: 0,   xMax: 0.5, yMin: 0,   yMax: 0.5 },
  { key: 'nearRight', label: 'Near Right', xMin: 0,   xMax: 0.5, yMin: 0.5, yMax: 1   },
  { key: 'farLeft',   label: 'Far Left',   xMin: 0.5, xMax: 1,   yMin: 0,   yMax: 0.5 },
  { key: 'farRight',  label: 'Far Right',  xMin: 0.5, xMax: 1,   yMin: 0.5, yMax: 1   },
];

export default function CourtHeatmap({ positions, className = '', showStats = true, tapMode = false, onTap }: Props) {
  const handleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!tapMode || !onTap) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    onTap({ x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) });
  };

  const zoneCounts = ZONES.map(z => ({
    ...z,
    count: positions.filter(p => p.x >= z.xMin && p.x < z.xMax && p.y >= z.yMin && p.y < z.yMax).length,
  }));
  const maxCount = Math.max(...zoneCounts.map(z => z.count), 1);
  const dominantZone = zoneCounts.reduce((best, z) => z.count > best.count ? z : best, zoneCounts[0]);

  return (
    <div className={className}>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className={`w-full rounded-xl overflow-hidden bg-[#0a1628] ${tapMode ? 'cursor-crosshair' : ''}`}
          onClick={handleClick}
        >
          {/* Court surface */}
          <rect x={0} y={0} width={W} height={H} fill="#0a1628"/>

          {/* Heatmap circles — blended so overlaps create brighter zones */}
          {positions.map((pos, i) => (
            <circle
              key={i}
              cx={pos.x * W}
              cy={pos.y * H}
              r={24}
              fill="rgba(16,185,129,0.18)"
            />
          ))}
          {/* Second pass: tighter inner glow for dense areas */}
          {positions.map((pos, i) => (
            <circle
              key={`c2-${i}`}
              cx={pos.x * W}
              cy={pos.y * H}
              r={10}
              fill="rgba(16,185,129,0.22)"
            />
          ))}

          {/* ── Court lines ── */}
          {/* Outer doubles boundary */}
          <rect x={0} y={0} width={W} height={H} fill="none" stroke="#1e3a5f" strokeWidth={1.5}/>

          {/* Singles sidelines */}
          <line x1={0}   y1={SGL_T} x2={W}   y2={SGL_T} stroke="#1e3a5f" strokeWidth={1}/>
          <line x1={0}   y1={SGL_B} x2={W}   y2={SGL_B} stroke="#1e3a5f" strokeWidth={1}/>

          {/* Doubles long service lines */}
          <line x1={LS_L} y1={0} x2={LS_L} y2={H} stroke="#1e3a5f" strokeWidth={1}/>
          <line x1={LS_R} y1={0} x2={LS_R} y2={H} stroke="#1e3a5f" strokeWidth={1}/>

          {/* Short service lines */}
          <line x1={SS_L} y1={SGL_T} x2={SS_L} y2={SGL_B} stroke="#2d4f7a" strokeWidth={1}/>
          <line x1={SS_R} y1={SGL_T} x2={SS_R} y2={SGL_B} stroke="#2d4f7a" strokeWidth={1}/>

          {/* Center service lines (each half) */}
          <line x1={LS_L}  y1={CTR_Y} x2={SS_L}  y2={CTR_Y} stroke="#1e3a5f" strokeWidth={1}/>
          <line x1={SS_R}  y1={CTR_Y} x2={LS_R}  y2={CTR_Y} stroke="#1e3a5f" strokeWidth={1}/>

          {/* Net */}
          <line x1={NET_X} y1={0} x2={NET_X} y2={H} stroke="#3b6fa0" strokeWidth={2}/>

          {/* Net label */}
          <text x={NET_X} y={H - 3} textAnchor="middle" fontSize={7} fill="#3b6fa0" fontFamily="monospace">NET</text>

          {/* Team labels */}
          <text x={40}  y={8} textAnchor="middle" fontSize={7} fill="#64748b" fontFamily="sans-serif">YOU</text>
          <text x={280} y={8} textAnchor="middle" fontSize={7} fill="#64748b" fontFamily="sans-serif">OPP</text>

          {/* Tap hint in empty state */}
          {tapMode && positions.length === 0 && (
            <text x={NET_X} y={CTR_Y + 4} textAnchor="middle" fontSize={10} fill="#3b6fa0" fontFamily="sans-serif">
              Tap to mark position
            </text>
          )}

          {/* Recent position dot (last tapped) */}
          {tapMode && positions.length > 0 && (() => {
            const last = positions[positions.length - 1];
            return (
              <circle cx={last.x * W} cy={last.y * H} r={5} fill="#10b981" opacity={0.9}/>
            );
          })()}
        </svg>

        {/* Position count badge */}
        {positions.length > 0 && (
          <div className="absolute top-2 right-2 bg-black/50 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
            {positions.length} pts
          </div>
        )}
      </div>

      {showStats && positions.length >= 3 && (
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-2 gap-1.5">
            {zoneCounts.map(z => (
              <div key={z.key}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-xs
                  ${z.key === dominantZone.key
                    ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-500'}`}>
                <span>{z.label}</span>
                <span className="font-mono font-bold">{Math.round((z.count / positions.length) * 100)}%</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-slate-600 text-center">
            Dominant zone: <span className="text-emerald-500 font-semibold">{dominantZone.label}</span>
            {' '}· {Math.round((dominantZone.count / positions.length) * 100)}% of time
          </p>
        </div>
      )}
    </div>
  );
}
