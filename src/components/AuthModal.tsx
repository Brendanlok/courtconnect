'use client';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Eye, EyeOff, Mail, Lock, User, AtSign, ArrowLeft } from 'lucide-react';

type Tab = 'login' | 'signup';
type View = 'main' | 'forgot' | 'google-onboarding';

export function AuthModal() {
  const { signIn, signUp, loginWithGoogle, completeGoogleOnboarding, resetPassword, pendingGoogleUser } = useAuth();
  const [tab, setTab]       = useState<Tab>('login');
  const [view, setView]     = useState<View>(pendingGoogleUser ? 'google-onboarding' : 'main');
  const [error, setError]   = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  // login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPw,    setLoginPw]    = useState('');

  // signup fields
  const [name,     setName]     = useState('');
  const [username, setUsername] = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');

  // forgot password
  const [forgotEmail, setForgotEmail] = useState('');

  // google onboarding
  const [googleName,     setGoogleName]     = useState(pendingGoogleUser?.displayName ?? '');
  const [googleUsername, setGoogleUsername] = useState('');

  const inp = 'w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-emerald-500 transition-colors placeholder:text-slate-600';

  const clear = () => { setError(''); setSuccess(''); };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); clear(); setLoading(true);
    const err = await signIn(loginEmail, loginPw);
    setLoading(false);
    if (err) setError(err);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault(); clear(); setLoading(true);
    const err = await signUp(name, username, email, password);
    setLoading(false);
    if (err) setError(err);
  };

  const handleGoogle = async () => {
    clear(); setLoading(true);
    const err = await loginWithGoogle();
    setLoading(false);
    if (err) { setError(err); return; }
    // If there's a pending google user, switch to onboarding view
    if (pendingGoogleUser) setView('google-onboarding');
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault(); clear(); setLoading(true);
    const err = await resetPassword(forgotEmail);
    setLoading(false);
    if (err) setError(err);
    else setSuccess('Password reset email sent! Check your inbox.');
  };

  const handleGoogleOnboarding = async (e: React.FormEvent) => {
    e.preventDefault(); clear(); setLoading(true);
    const err = await completeGoogleOnboarding(googleName, googleUsername);
    setLoading(false);
    if (err) setError(err);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#020817] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🏸</div>
          <h1 className="text-2xl font-bold">CourtConnect</h1>
          <p className="text-slate-400 text-sm mt-1">Malaysia Badminton Ranking Platform</p>
        </div>

        {/* ── GOOGLE ONBOARDING ── */}
        {view === 'google-onboarding' && (
          <>
            <div className="mb-6">
              <h2 className="text-lg font-bold mb-1">Almost there!</h2>
              <p className="text-slate-400 text-sm">Choose a display name and username to finish setting up your account.</p>
            </div>
            {error && <div className="mb-4 px-4 py-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400">{error}</div>}
            <form onSubmit={handleGoogleOnboarding} className="space-y-3">
              <div className="relative">
                <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"/>
                <input value={googleName} onChange={e => setGoogleName(e.target.value)}
                  placeholder="Full name" autoComplete="name"
                  className={`${inp} pl-10`}/>
              </div>
              <div className="relative">
                <AtSign size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"/>
                <input value={googleUsername} onChange={e => setGoogleUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,''))}
                  placeholder="Username (e.g. brendanlok)" autoComplete="username"
                  className={`${inp} pl-10`}/>
              </div>
              <div className="px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm text-slate-400">
                📧 {pendingGoogleUser?.email}
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 font-bold rounded-xl text-sm transition-colors">
                {loading ? 'Setting up…' : 'Finish Setup'}
              </button>
            </form>
          </>
        )}

        {/* ── FORGOT PASSWORD ── */}
        {view === 'forgot' && (
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
              <button type="submit" disabled={loading}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 font-bold rounded-xl text-sm transition-colors">
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>
            </form>
          </>
        )}

        {/* ── MAIN LOGIN / SIGNUP ── */}
        {view === 'main' && (
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
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
                  </button>
                </div>
                <button type="button" onClick={() => { setView('forgot'); clear(); setForgotEmail(loginEmail); }}
                  className="text-xs text-emerald-400 hover:underline">
                  Forgot password?
                </button>
                <button type="submit" disabled={loading}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 font-bold rounded-xl text-sm transition-colors">
                  {loading ? 'Signing in…' : 'Log In'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleSignup} className="space-y-3">
                <div className="relative">
                  <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"/>
                  <input value={name} onChange={e => setName(e.target.value)}
                    placeholder="Full name" autoComplete="name"
                    className={`${inp} pl-10`}/>
                </div>
                <div className="relative">
                  <AtSign size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"/>
                  <input value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,''))}
                    placeholder="Username (e.g. brendanlok)" autoComplete="username"
                    className={`${inp} pl-10`}/>
                </div>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"/>
                  <input value={email} onChange={e => setEmail(e.target.value)}
                    type="email" placeholder="Email" autoComplete="email"
                    className={`${inp} pl-10`}/>
                </div>
                <div className="relative">
                  <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"/>
                  <input value={password} onChange={e => setPassword(e.target.value)}
                    type={showPw ? 'text' : 'password'} placeholder="Password (min 6 chars)" autoComplete="new-password"
                    className={`${inp} pl-10 pr-10`}/>
                  <button type="button" onClick={() => setShowPw(p => !p)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
                  </button>
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 font-bold rounded-xl text-sm transition-colors">
                  {loading ? 'Creating account…' : 'Create Account'}
                </button>
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
