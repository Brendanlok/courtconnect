'use client';
import { useState } from 'react';
import { X, TrendingUp, Shield, Users, Star, Info } from 'lucide-react';
import { TIER_STYLE } from '@/lib/utils';
import type { Tier } from '@/types';
import { useModalA11y } from '@/hooks/useModalA11y';

type InfoTab = 'formula' | 'calibration' | 'tiers' | 'fairplay' | 'doubles';
const TABS: { key: InfoTab; label: string }[] = [
  { key: 'formula',     label: 'Formula' },
  { key: 'calibration', label: 'Calibration' },
  { key: 'tiers',       label: 'Tiers' },
  { key: 'fairplay',    label: 'Fair Play' },
  { key: 'doubles',     label: 'Doubles' },
];

const TIERS: { tier: Tier; range: string; desc: string }[] = [
  { tier: 'Beginner', range: '0 – 799',    desc: 'Just starting out. Learning the basics.' },
  { tier: 'Bronze',   range: '800 – 999',  desc: 'Developing consistency and rallying.' },
  { tier: 'Silver',   range: '1000 – 1299',desc: 'Solid fundamentals, competitive club player.' },
  { tier: 'Gold',     range: '1300 – 1599',desc: 'Strong player, state-level recreational.' },
  { tier: 'Platinum', range: '1600 – 1999',desc: 'Advanced, state competitive standard.' },
  { tier: 'Diamond',  range: '2000 – 2399',desc: 'Elite regional or national-level player.' },
  { tier: 'Elite',    range: '2400+',       desc: 'Top national & professional standard.' },
];

interface Props { open: boolean; onClose: () => void }

export function MMRInfoModal({ open, onClose }: Props) {
  const { ref: panelRef, dialogProps } = useModalA11y(open, onClose, 'How MMR Works');
  const [tab, setTab] = useState<InfoTab>('formula');
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div ref={panelRef} {...dialogProps} className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col outline-none" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-emerald-400"/>
            <h2 className="font-bold">How MMR Works</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-white"><X size={18}/></button>
        </div>

        <div className="flex gap-1 overflow-x-auto px-5 pt-3 pb-1 border-b border-slate-800 shrink-0 [&::-webkit-scrollbar]:hidden">
          {TABS.map(t => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap
                ${tab === t.key ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto p-5 space-y-6">

          {/* Formula */}
          {tab === 'formula' && (
          <section>
            <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2 mb-3">
              <TrendingUp size={14}/> The Formula (Elo-based)
            </h3>
            <div className="bg-slate-800 rounded-xl p-4 space-y-3 text-sm">
              <p className="text-slate-300">CourtConnect uses a modified <span className="text-white font-semibold">Elo rating system</span> — the same foundation used in chess, tennis, and esports.</p>
              <div className="bg-slate-900 rounded-xl p-3 font-mono text-xs text-emerald-300 space-y-1">
                <p>Expected = 1 / (1 + 10^((oppMMR − yourMMR) / 400))</p>
                <p>Δ MMR = K × (1 − Expected)</p>
              </div>
              <div className="space-y-2 text-xs text-slate-400">
                <p>• <span className="text-white font-medium">K = 32</span> — the sensitivity factor (higher = faster MMR movement)</p>
                <p>• Beat a stronger opponent → gain more MMR (up to +32)</p>
                <p>• Beat a weaker opponent → gain fewer MMR (as low as +5)</p>
                <p>• Lose to a weaker opponent → lose more MMR</p>
              </div>
              <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-xl p-3 text-xs">
                <p className="text-slate-300"><span className="text-emerald-400 font-semibold">Example:</span> Your MMR is 1600, opponent is 1800.</p>
                <p className="text-slate-400 mt-1">Expected = 1 / (1 + 10^(200/400)) ≈ 0.24</p>
                <p className="text-slate-400">Win: +32 × (1 − 0.24) = <span className="text-emerald-400 font-bold">+24 MMR</span></p>
                <p className="text-slate-400">Lose: +32 × (0 − 0.24) = <span className="text-red-400 font-bold">−8 MMR</span></p>
              </div>
            </div>
          </section>
          )}

          {/* Calibration */}
          {tab === 'calibration' && (
          <section>
            <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2 mb-3">
              <Star size={14}/> New Player Calibration
            </h3>
            <div className="bg-slate-800 rounded-xl p-4 space-y-3 text-sm">
              <p className="text-slate-300">Every new player starts at <span className="text-white font-semibold">1200 MMR</span> in provisional <span className="text-amber-400 font-semibold">Placement</span> mode.</p>
              <div className="space-y-2 text-xs text-slate-400">
                <p>• Your first <span className="text-white font-medium">10 matches</span> are calibration matches</p>
                <p>• MMR swings are <span className="text-white font-medium">1.5× larger</span> (K = 48) so your rating settles quickly</p>
                <p>• After 10 matches, your tier is assigned based on final MMR</p>
                <p>• Your profile shows <span className="text-amber-400 font-medium">Placement</span> badge until calibration completes</p>
              </div>
              <div className="flex items-center gap-3 bg-slate-900 rounded-xl p-3">
                <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full" style={{ width: '30%' }}/>
                </div>
                <span className="text-xs text-amber-400 font-semibold shrink-0">3 / 10 placement</span>
              </div>
              <p className="text-xs text-slate-500">If you're an experienced player, you can self-report your approximate level during sign-up to start with a higher base MMR (800–1800), reducing calibration time.</p>
            </div>
          </section>
          )}

          {/* Tiers */}
          {tab === 'tiers' && (
          <section>
            <h3 className="text-sm font-bold text-violet-400 flex items-center gap-2 mb-3">
              <Info size={14}/> Tier Thresholds
            </h3>
            <div className="space-y-1.5">
              {TIERS.map(({ tier, range, desc }) => {
                const s = TIER_STYLE[tier];
                return (
                  <div key={tier} className={`flex flex-col gap-1 px-3 py-2.5 rounded-xl border ${s.bg} ${s.border}`}>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold w-18 shrink-0 ${s.text}`}>{s.icon} {tier}</span>
                      <span className="text-xs font-mono text-slate-400 shrink-0">{range}</span>
                    </div>
                    <span className="text-xs text-slate-400 leading-relaxed">{desc}</span>
                  </div>
                );
              })}
            </div>
          </section>
          )}

          {/* Anti-cheat */}
          {tab === 'fairplay' && (
          <section>
            <h3 className="text-sm font-bold text-red-400 flex items-center gap-2 mb-3">
              <Shield size={14}/> Fair Play Guiderails
            </h3>
            <div className="bg-slate-800 rounded-xl p-4 space-y-3 text-sm">
              <p className="text-slate-300">To prevent MMR farming and fake match boosting, the following limits apply:</p>
              <div className="space-y-2.5">
                {[
                  { icon: '🔁', rule: 'Max 2 matches vs same opponent per day', why: 'Prevents grinding the same person repeatedly for easy MMR.' },
                  { icon: '📅', rule: 'Max 3 matches vs same opponent per 7 days', why: 'Limits the farming window even if spread across multiple days.' },
                  { icon: '📈', rule: 'Max +150 MMR gain per day (confirmed matches)', why: 'Caps how fast anyone can climb — natural play rarely exceeds this.' },
                  { icon: '✅', rule: 'MMR updates only after both players confirm', why: 'The opponent must verify the result, preventing self-reporting.' },
                  { icon: '🎯', rule: 'Scores must be entered to submit a match', why: 'Forces a real scoreline — prevents logging phantom wins.' },
                ].map(({ icon, rule, why }) => (
                  <div key={rule} className="flex items-start gap-3 bg-slate-900 rounded-xl px-3 py-2.5">
                    <span className="text-base shrink-0 mt-0.5">{icon}</span>
                    <div>
                      <p className="text-xs font-semibold text-slate-200">{rule}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{why}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-3 text-xs text-slate-300">
                <span className="text-amber-400 font-semibold">Note: </span>
                Accounts found colluding to artificially boost MMR (confirmed via pattern analysis) will have their ratings reset and may be banned. Play fair — your tier should reflect your real skill.
              </div>
            </div>
          </section>
          )}

          {/* Doubles */}
          {tab === 'doubles' && (
          <section>
            <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2 mb-3">
              <Users size={14}/> Doubles MMR
            </h3>
            <div className="bg-slate-800 rounded-xl p-4 text-sm text-slate-400 space-y-2">
              <p>In doubles, the MMR calculation uses the <span className="text-white font-medium">average team MMR</span> for each side:</p>
              <div className="bg-slate-900 rounded-xl p-3 font-mono text-xs text-emerald-300">
                <p>TeamMMR = (Player1MMR + Player2MMR) / 2</p>
              </div>
              <p className="text-xs">Each player on the winning team gains MMR; each player on the losing team loses MMR. The change amount is the same for all 4 players.</p>
            </div>
          </section>
          )}

        </div>
      </div>
    </div>
  );
}
