'use client';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Eye, EyeOff, Mail, Lock, User, AtSign, ArrowLeft, Globe, MapPin, Check, X as XIcon } from 'lucide-react';
import { COUNTRIES, getCountryByName } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

type Tab = 'login' | 'signup';
type View = 'main' | 'forgot';

const inp = 'w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-500 transition-colors placeholder:text-slate-600';
const sel = `${inp} appearance-none cursor-pointer`;

// ── Password strength — typical "strong password" checklist ──────────────────
const PASSWORD_RULES: { key: string; label: string; test: (pw: string) => boolean }[] = [
  { key: 'len',   label: 'At least 8 characters', test: pw => pw.length >= 8 },
  { key: 'upper', label: 'One uppercase letter',   test: pw => /[A-Z]/.test(pw) },
  { key: 'lower', label: 'One lowercase letter',   test: pw => /[a-z]/.test(pw) },
  { key: 'num',   label: 'One number',             test: pw => /[0-9]/.test(pw) },
];
const isStrongPassword = (pw: string) => PASSWORD_RULES.every(r => r.test(pw));

function CountryRegionFields({
  country, setCountry, region, setRegion,
}: { country: string; setCountry: (v: string) => void; region: string; setRegion: (v: string) => void }) {
  const cd = getCountryByName(country);
  return (
    <>
      <div className="relative">
        <Globe size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none z-10"/>
        <select value={country} onChange={e => { setCountry(e.target.value); setRegion(''); }}
          className={`${sel} pl-10`}>
          {COUNTRIES.map(c => (
            <option key={c.code} value={c.name}>{c.flag} {c.name}</option>
          ))}
        </select>
      </div>
      {cd.regions.length > 0 ? (
        <div className="relative">
          <MapPin size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none z-10"/>
          <select value={region} onChange={e => setRegion(e.target.value)}
            className={`${sel} pl-10`}>
            <option value="">Select {cd.regionLabel}…</option>
            {cd.regions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      ) : (
        <div className="relative">
          <MapPin size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"/>
          <input value={region} onChange={e => setRegion(e.target.value)}
            placeholder={`${cd.regionLabel}`}
            className={`${inp} pl-10`}/>
        </div>
      )}
    </>
  );
}

// ── Step shown once signed up but email not yet confirmed ────────────────────
function VerifyEmailView() {
  const { authUser, resendVerificationEmail, refreshVerificationStatus, logout } = useAuth();
  const [sent, setSent] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');

  const handleResend = async () => {
    setError('');
    const err = await resendVerificationEmail();
    if (err) setError(err);
    else { setSent(true); setTimeout(() => setSent(false), 4000); }
  };

  const handleCheck = async () => {
    setChecking(true); setError('');
    await refreshVerificationStatus();
    setChecking(false);
  };

  return (
    <div className="text-center space-y-4">
      <div className="text-4xl">📧</div>
      <div>
        <h2 className="text-lg font-bold">Confirm your email</h2>
        <p className="text-slate-400 text-sm mt-2">
          We sent a confirmation link to <span className="text-white font-semibold">{authUser?.email}</span>. Click it, then come back here.
        </p>
      </div>
      {error && <div className="px-4 py-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400">{error}</div>}
      {sent && <div className="px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-sm text-emerald-400">Email sent again — check your inbox.</div>}
      <Button onClick={handleCheck} disabled={checking} className="w-full font-bold">
        {checking ? 'Checking…' : "I've confirmed — Continue"}
      </Button>
      <div className="flex items-center justify-center gap-4 text-xs">
        <button onClick={handleResend} className="text-emerald-400 hover:underline">Resend email</button>
        <button onClick={logout} className="text-slate-600 hover:text-slate-400">Use a different email</button>
      </div>
    </div>
  );
}

// ── Step shown once signed up/verified but the Firestore profile doesn't exist
// yet — same two-step flow (username, then details) for both Google and email ──
function CompleteProfileView() {
  const { authUser, completeProfile, checkUsernameAvailable, logout } = useAuth();
  const [step, setStep] = useState<'username' | 'details'>('username');
  const [username, setUsername] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [displayName, setDisplayName] = useState(authUser?.displayName ?? '');
  const [country, setCountry] = useState('Malaysia');
  const [region, setRegion] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validFormat = /^[a-z0-9_]{3,20}$/.test(username);

  const handleUsernameChange = (v: string) => {
    setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ''));
    setUsernameStatus('idle');
  };

  const handleCheckUsername = async () => {
    setError('');
    if (!validFormat) { setUsernameStatus('invalid'); return; }
    setUsernameStatus('checking');
    const available = await checkUsernameAvailable(username);
    setUsernameStatus(available ? 'available' : 'taken');
  };

  const handleContinueToDetails = () => {
    if (usernameStatus === 'available') setStep('details');
  };

  const handleFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    const err = await completeProfile(displayName, username, country, region);
    setLoading(false);
    if (err) setError(err);
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-bold mb-1">Almost there!</h2>
        <p className="text-slate-400 text-sm">
          {step === 'username' ? 'Pick a username — this is how other players find you.' : 'Just a few details to finish setting up.'}
        </p>
      </div>
      {error && <div className="mb-4 px-4 py-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400">{error}</div>}

      {step === 'username' ? (
        <div className="space-y-3">
          <div className="relative">
            <AtSign size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"/>
            <input value={username} onChange={e => handleUsernameChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleCheckUsername(); } }}
              placeholder="Username (e.g. brendanlok)" autoComplete="username"
              className={`${inp} pl-10 pr-10`}/>
            {usernameStatus === 'available' && <Check size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-400"/>}
            {usernameStatus === 'taken' && <XIcon size={15} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-red-400"/>}
          </div>
          {usernameStatus === 'invalid' && <p className="text-xs text-red-400">3–20 characters, lowercase letters/numbers/underscores only.</p>}
          {usernameStatus === 'taken' && <p className="text-xs text-red-400">That username is already taken.</p>}
          {usernameStatus === 'available' && <p className="text-xs text-emerald-400">@{username} is available.</p>}

          {usernameStatus === 'available' ? (
            <Button onClick={handleContinueToDetails} className="w-full font-bold">Continue</Button>
          ) : (
            <Button onClick={handleCheckUsername} disabled={usernameStatus === 'checking' || !username} className="w-full font-bold">
              {usernameStatus === 'checking' ? 'Checking…' : 'Check availability'}
            </Button>
          )}
        </div>
      ) : (
        <form onSubmit={handleFinish} className="space-y-3">
          <div className="px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-400 flex items-center justify-between">
            <span>@{username}</span>
            <button type="button" onClick={() => setStep('username')} className="text-xs text-emerald-400 hover:underline">Change</button>
          </div>
          <div className="relative">
            <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"/>
            <input value={displayName} onChange={e => setDisplayName(e.target.value)}
              placeholder="Full name" autoComplete="name"
              className={`${inp} pl-10`}/>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-2 font-medium">Your location</p>
            <div className="space-y-3">
              <CountryRegionFields country={country} setCountry={setCountry} region={region} setRegion={setRegion}/>
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full font-bold">
            {loading ? 'Setting up…' : 'Finish Setup'}
          </Button>
        </form>
      )}

      <button onClick={logout} className="block mx-auto mt-4 text-xs text-slate-600 hover:text-slate-400">Sign out</button>
    </div>
  );
}

export function AuthModal() {
  const { signIn, signUp, loginWithGoogle, resetPassword, needsEmailVerification, needsProfileSetup } = useAuth();
  const [tab, setTab]       = useState<Tab>('login');
  const [view, setView]     = useState<View>('main');
  const [error, setError]   = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  // login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPw,    setLoginPw]    = useState('');

  // signup fields — email + password only; everything else comes after confirmation
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // forgot password
  const [forgotEmail, setForgotEmail] = useState('');

  const clear = () => { setError(''); setSuccess(''); };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); clear(); setLoading(true);
    const err = await signIn(loginEmail, loginPw);
    setLoading(false);
    if (err) setError(err);
  };

  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const canSignup = isStrongPassword(password) && passwordsMatch && /\S+@\S+\.\S+/.test(email);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault(); clear();
    if (!isStrongPassword(password)) { setError('Password does not meet the requirements below.'); return; }
    if (!passwordsMatch) { setError('Passwords do not match.'); return; }
    setLoading(true);
    const err = await signUp(email, password);
    setLoading(false);
    if (err) setError(err);
  };

  const handleGoogle = async () => {
    clear(); setLoading(true);
    const err = await loginWithGoogle();
    setLoading(false);
    if (err) setError(err);
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault(); clear(); setLoading(true);
    const err = await resetPassword(forgotEmail);
    setLoading(false);
    if (err) setError(err);
    else setSuccess('Password reset email sent! Check your inbox.');
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#020817] flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-sm py-8">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🏸</div>
          <h1 className="text-2xl font-bold">CourtConnect</h1>
          <p className="text-slate-400 text-sm mt-1">Badminton Ranking Platform</p>
        </div>

        {needsEmailVerification ? (
          <VerifyEmailView/>
        ) : needsProfileSetup ? (
          <CompleteProfileView/>
        ) : view === 'forgot' ? (
          <>
            <button onClick={() => { setView('main'); clear(); }}
              className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6 transition-colors">
              <ArrowLeft size={15}/> Back to login
            </button>
            <h2 className="text-lg font-bold mb-1">Reset password</h2>
            <p className="text-slate-400 text-sm mb-6">Enter your email and we'll send you a reset link.</p>
            {error   && <div className="mb-4 px-4 py-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400">{error}</div>}
            {success && <div className="mb-4 px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-sm text-emerald-400">{success}</div>}
            <form onSubmit={handleForgot} className="space-y-3">
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"/>
                <input value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                  type="email" placeholder="Your email address" autoComplete="email"
                  className={`${inp} pl-10`}/>
              </div>
              <Button type="submit" disabled={loading} className="w-full font-bold">
                {loading ? 'Sending…' : 'Send Reset Link'}
              </Button>
            </form>
          </>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 mb-6">
              {(['login','signup'] as Tab[]).map(t => (
                <button key={t} onClick={() => { setTab(t); clear(); }}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors capitalize
                    ${tab === t ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
                  {t === 'login' ? 'Log In' : 'Sign Up'}
                </button>
              ))}
            </div>

            {/* Google button */}
            <button onClick={handleGoogle} disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-2.5 bg-white hover:bg-slate-100 disabled:opacity-60 text-slate-900 font-semibold rounded-xl text-sm transition-colors mb-4">
              <svg width="18" height="18" viewBox="0 0 48 48">
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.16 7.09-10.29 7.09-17.65z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              </svg>
              Continue with Google
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-slate-800"/>
              <span className="text-xs text-slate-600">or</span>
              <div className="flex-1 h-px bg-slate-800"/>
            </div>

            {error && <div className="mb-4 px-4 py-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400">{error}</div>}

            {tab === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-3">
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"/>
                  <input value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                    placeholder="Email" type="email" autoComplete="email"
                    className={`${inp} pl-10`}/>
                </div>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"/>
                  <input value={loginPw} onChange={e => setLoginPw(e.target.value)}
                    type={showPw ? 'text' : 'password'} placeholder="Password" autoComplete="current-password"
                    className={`${inp} pl-10 pr-10`}/>
                  <button type="button" onClick={() => setShowPw(p => !p)}
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
                  </button>
                </div>
                <button type="button" onClick={() => { setView('forgot'); clear(); setForgotEmail(loginEmail); }}
                  className="text-xs text-emerald-400 hover:underline">
                  Forgot password?
                </button>
                <Button type="submit" disabled={loading} className="w-full font-bold">
                  {loading ? 'Signing in…' : 'Log In'}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleSignup} className="space-y-3">
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"/>
                  <input value={email} onChange={e => setEmail(e.target.value)}
                    type="email" placeholder="Email" autoComplete="email"
                    className={`${inp} pl-10`}/>
                </div>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"/>
                  <input value={password} onChange={e => setPassword(e.target.value)}
                    type={showPw ? 'text' : 'password'} placeholder="Password" autoComplete="new-password"
                    className={`${inp} pl-10 pr-10`}/>
                  <button type="button" onClick={() => setShowPw(p => !p)}
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
                  </button>
                </div>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"/>
                  <input value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                    type={showPw ? 'text' : 'password'} placeholder="Confirm password" autoComplete="new-password"
                    className={`${inp} pl-10 pr-10 ${confirmPassword && !passwordsMatch ? 'border-red-500/60' : ''}`}/>
                </div>
                {confirmPassword && !passwordsMatch && <p className="text-xs text-red-400 -mt-1">Passwords don't match.</p>}

                {password && (
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 -mt-1">
                    {PASSWORD_RULES.map(rule => {
                      const pass = rule.test(password);
                      return (
                        <span key={rule.key} className={`flex items-center gap-1.5 text-[11px] ${pass ? 'text-emerald-400' : 'text-slate-500'}`}>
                          {pass ? <Check size={11}/> : <XIcon size={11}/>} {rule.label}
                        </span>
                      );
                    })}
                  </div>
                )}

                <Button type="submit" disabled={loading || !canSignup} className="w-full font-bold">
                  {loading ? 'Creating account…' : 'Create Account'}
                </Button>
              </form>
            )}

            <p className="text-center text-xs text-slate-600 mt-6">
              {tab === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button onClick={() => { setTab(tab === 'login' ? 'signup' : 'login'); clear(); }}
                className="text-emerald-400 hover:underline font-medium">
                {tab === 'login' ? 'Sign up' : 'Log in'}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
