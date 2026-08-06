'use client';
import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { postcodeToLocation, COUNTRIES, DAY_IDS, DAY_LABELS, SLOT_IDS, SLOT_LABELS } from '@/lib/utils';
import type { CountryCode } from '@/types';
import { ChevronRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';

// Skill-level picker removed 2026-08-06 — every account now starts flat at
// 1000 MMR (set at signup, see AuthContext.createUserRow) and real rating is
// established via placement/recalibration matches instead of self-reported level.
const STEPS = ['Welcome', 'Location', 'Availability', 'Done'] as const;

export function OnboardingModal({ onComplete }: { onComplete: () => void }) {
  const { user, updateUser } = useApp();
  const [step,        setStep]        = useState(0);
  const [countryCode, setCountryCode] = useState<CountryCode>('MY');
  const [postcode,    setPostcode]    = useState('');
  const [region,      setRegion]      = useState('');
  const [city,        setCity]        = useState('');
  const [availability, setAvail]      = useState<string[]>([]);

  const countryData = COUNTRIES.find(c => c.code === countryCode) ?? COUNTRIES[0];
  const location    = countryCode === 'MY' ? postcodeToLocation(postcode) : null;

  const toggleAvail = (id: string) =>
    setAvail(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const next = () => setStep(s => s + 1);

  const finish = () => {
    const isMY  = countryCode === 'MY';
    updateUser({
      countryCode,
      country:   countryData.name,
      postcode:  isMY ? postcode : undefined,
      region:    isMY ? (location?.state ?? region) : region,
      area:      isMY ? (location?.city  ?? city)   : city,
      state:     isMY ? (location?.state as import('@/types').MalaysiaState ?? user.state) : user.state,
      available: availability.join(','),
    });
    localStorage.setItem('cc_onboarded', '1');
    onComplete();
  };

  const inp = 'w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-emerald-500 transition-colors';

  return (
    <div className="modal-backdrop fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">

        {/* Progress bar */}
        <div className="h-1 bg-slate-800">
          <div className="h-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${(step / (STEPS.length - 1)) * 100}%` }}/>
        </div>

        <div className="p-6 space-y-5">

          {/* Step indicator */}
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <div key={s} className={`flex-1 h-1 rounded-full transition-colors ${i <= step ? 'bg-emerald-500' : 'bg-slate-700'}`}/>
            ))}
          </div>

          {/* ── Step 0: Welcome ── */}
          {step === 0 && (
            <div className="text-center space-y-4 py-2">
              <div className="text-5xl">🏸</div>
              <div>
                <h2 className="text-xl font-bold">Welcome to CourtConnect</h2>
                <p className="text-slate-400 text-sm mt-2">
                  Let&apos;s set up your profile so other players can find you and challenge you to matches.
                </p>
              </div>
              <div className="text-left bg-slate-800/60 rounded-xl p-4 space-y-2">
                {['Find players near you', 'Track your MMR and stats', 'Join clubs and tournaments', 'Challenge players to matches'].map(f => (
                  <div key={f} className="flex items-center gap-2 text-sm">
                    <Check size={13} className="text-emerald-400 shrink-0"/>
                    <span className="text-slate-300">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 1: Location ── */}
          {step === 1 && (
            <div className="space-y-3">
              <div>
                <h2 className="text-lg font-bold">Where are you based?</h2>
                <p className="text-slate-400 text-sm mt-0.5">Helps you find nearby players and events.</p>
              </div>
              <select value={countryCode}
                onChange={e => { setCountryCode(e.target.value as CountryCode); setRegion(''); setCity(''); setPostcode(''); }}
                className={inp}>
                {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}
              </select>
              {countryCode === 'MY' ? (
                <>
                  <input value={postcode} onChange={e => setPostcode(e.target.value.replace(/\D/,'').slice(0,5))}
                    placeholder="Postcode (e.g. 47810)" maxLength={5} className={`${inp} font-mono`}/>
                  {location ? (
                    <p className="text-xs text-emerald-400">📍 {location.city}, {location.state}</p>
                  ) : postcode.length === 5 ? (
                    <>
                      <p className="text-xs text-red-400">Postcode not found — enter manually:</p>
                      <div className="grid grid-cols-2 gap-2">
                        <select value={region} onChange={e => setRegion(e.target.value)} className={inp}>
                          <option value="">State…</option>
                          {countryData.regions.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <input value={city} onChange={e => setCity(e.target.value)} placeholder="City / Area" className={inp}/>
                      </div>
                    </>
                  ) : null}
                </>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {countryData.regions.length > 0 ? (
                    <select value={region} onChange={e => setRegion(e.target.value)} className={inp}>
                      <option value="">Region…</option>
                      {countryData.regions.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  ) : (
                    <input value={region} onChange={e => setRegion(e.target.value)} placeholder="Region / State" className={inp}/>
                  )}
                  <input value={city} onChange={e => setCity(e.target.value)} placeholder="City / Area" className={inp}/>
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Availability ── */}
          {step === 2 && (
            <div className="space-y-3">
              <div>
                <h2 className="text-lg font-bold">When are you usually free?</h2>
                <p className="text-slate-400 text-sm mt-0.5">Tap the slots when you&apos;re typically available to play. You can change this later.</p>
              </div>
              <div className="space-y-1">
                <div className="flex gap-0.5 ml-7">
                  {SLOT_LABELS.map(l => (
                    <div key={l} className="flex-1 text-center text-[8px] text-slate-600 leading-tight">{l}</div>
                  ))}
                </div>
                {(DAY_IDS as readonly string[]).map((day, di) => (
                  <div key={day} className="flex items-center gap-0.5">
                    <span className="text-[10px] text-slate-500 w-6 shrink-0 font-medium">{DAY_LABELS[di]}</span>
                    {(SLOT_IDS as readonly string[]).map(slot => {
                      const id = `${day}_${slot}`;
                      const on = availability.includes(id);
                      return (
                        <button key={slot} type="button" onClick={() => toggleAvail(id)}
                          className={`flex-1 h-7 rounded text-[9px] font-bold transition-colors border
                            ${on ? 'bg-emerald-500/25 border-emerald-500/50 text-emerald-400' : 'bg-slate-800/50 border-slate-700/40 text-slate-700 hover:border-slate-600'}`}>
                          {on ? '✓' : ''}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
              {availability.length > 0 && (
                <p className="text-[11px] text-slate-500">{availability.length} slot{availability.length !== 1 ? 's' : ''} selected</p>
              )}
            </div>
          )}

          {/* ── Step 3: Done ── */}
          {step === 3 && (
            <div className="text-center space-y-4 py-2">
              <div className="text-5xl">✅</div>
              <div>
                <h2 className="text-xl font-bold">You&apos;re all set!</h2>
                <p className="text-slate-400 text-sm mt-2">
                  Starting at <span className="text-amber-400 font-bold">1000 MMR</span>. Your first 10 ranked
                  matches count as placement — bigger MMR swings while your real rating gets established.
                  Head to the Players tab to find opponents, or browse upcoming tournaments.
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            {step > 0 && step < STEPS.length - 1 && (
              <Button variant="secondary" onClick={() => setStep(s => s - 1)} className="px-4 font-medium">
                Back
              </Button>
            )}
            {step < STEPS.length - 2 && (
              <Button onClick={next} className="flex-1">
                Continue <ChevronRight size={15}/>
              </Button>
            )}
            {step === STEPS.length - 2 && (
              <Button onClick={() => { next(); finish(); }} className="flex-1">
                Finish Setup <ChevronRight size={15}/>
              </Button>
            )}
            {step === STEPS.length - 1 && (
              <Button onClick={onComplete} className="flex-1">
                Start Playing 🏸
              </Button>
            )}
          </div>

          {step === 0 && (
            <button onClick={onComplete} className="w-full text-xs text-slate-600 hover:text-slate-400 transition-colors">
              Skip setup — I&apos;ll do this later
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
