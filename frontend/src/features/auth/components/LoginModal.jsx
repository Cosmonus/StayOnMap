import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authService } from '@services/auth.service'
import { useAuth } from '../hooks/useAuth'
import { useUiStore } from '@store/uiStore'
import { CITY_LIST_LABEL } from '@/config/cities'
import { usePlatformStats } from '@hooks/usePlatformStats'

const QUOTES = [
  { text: 'The ache for home lives in all of us.', author: 'Maya Angelou' },
  { text: 'Home is not a place — it\'s a feeling.', author: 'Cecelia Ahern' },
  { text: 'A house is made of bricks. A home is made of love.', author: 'Proverb' },
  { text: 'We find you houses. It\'s your responsibility to make it a home.', author: 'StayOnMap' },
]

function InputField({ label, type = 'text', value, onChange, placeholder, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required
          className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-brand-600 transition-all bg-slate-50 placeholder:text-slate-400"
        />
        {children}
      </div>
    </div>
  )
}

export default function LoginModal() {
  const isOpen  = useUiStore((s) => s.loginModalOpen)
  const onClose = useUiStore((s) => s.closeLoginModal)
  const { loginSuccess } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab]           = useState('login')
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [role, setRole]         = useState('TENANT')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const { totalActive, cities, isLoading: statsLoading } = usePlatformStats()

  const quote = QUOTES[Math.floor(Date.now() / 86400000) % QUOTES.length]

  function reset() {
    setName(''); setEmail(''); setPassword(''); setError(''); setLoading(false); setShowPw(false); setResetSent(false)
  }

  function switchTab(t) { setTab(t); setError(''); setShowPw(false); setResetSent(false) }

  function handleClose() { reset(); onClose() }

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await authService.login({ email, password })
      loginSuccess(res.data)
      reset(); onClose(); navigate('/user')
    } catch (err) {
      setError(err?.message ?? 'Invalid email or password')
      setLoading(false)
    }
  }

  async function handleForgot(e) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      await authService.requestPasswordReset({ email })
      setResetSent(true)
    } catch (err) {
      setError(err?.message ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  async function handleSignup(e) {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required'); return }
    setLoading(true); setError('')
    try {
      const res = await authService.register({ name: name.trim(), email, password, role })
      loginSuccess(res.data)
      reset(); onClose(); navigate('/user')
    } catch (err) {
      setError(err?.message ?? 'Could not create account')
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)' }}
      onClick={handleClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-3xl rounded-3xl overflow-hidden flex"
        style={{ maxHeight: '90vh', boxShadow: '0 40px 100px rgba(0,0,0,0.45)' }}
      >
        {/* Left panel */}
        <div
          className="hidden md:flex flex-col justify-between w-[45%] p-8 relative overflow-hidden"
          style={{ background: '#111111', minHeight: '540px' }}
        >
          {/* Gradient orbs — brand-600 green */}
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full opacity-20 pointer-events-none"
            style={{ background: 'radial-gradient(circle, #0d8a5f 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />
          <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full opacity-15 pointer-events-none"
            style={{ background: 'radial-gradient(circle, #12a374 0%, transparent 70%)', transform: 'translate(-30%, 30%)' }} />

          {/* Grid texture */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

          {/* Logo — text-only wordmark per design system */}
          <div className="relative z-10">
            <div className="mb-8">
              <span className="font-bold text-xl tracking-tight text-white">
                Stay<span className="text-brand-500">OnMap</span>
              </span>
            </div>

            <h2 className="text-white font-bold text-2xl leading-snug mb-3">
              Find your home.<br />
              <span className="text-brand-500">No broker. No fee.</span>
            </h2>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Connect directly with owners across {CITY_LIST_LABEL}.
            </p>
          </div>

          {/* Quote */}
          <div className="relative z-10">
            <div className="mb-6 p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <p className="text-sm italic leading-relaxed mb-2" style={{ color: 'rgba(255,255,255,0.75)' }}>
                &ldquo;{quote.text}&rdquo;
              </p>
              <p className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>— {quote.author}</p>
            </div>

            {/* Mini stats */}
            <div className="flex gap-4">
              {[[`${totalActive}`, 'Listings'], ['₹0', 'Brokerage'], [`${cities}`, 'Cities']].map(([val, lbl], i) => (
                <div key={lbl}>
                  {statsLoading && i !== 1 ? (
                    <div className="h-5 w-6 rounded bg-white/10 animate-pulse" />
                  ) : (
                    <div className="text-white font-bold text-base">{val}</div>
                  )}
                  <div className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{lbl}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="flex-1 bg-white flex flex-col overflow-y-auto">
          {/* Close */}
          <div className="flex justify-end p-4 pb-0">
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-slate-100"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div className="px-8 pb-8 pt-2 flex flex-col flex-1 justify-center">
            <h3 className="text-xl font-bold text-slate-800 mb-1">
              {tab === 'login' ? 'Welcome back' : tab === 'signup' ? 'Create account' : 'Reset password'}
            </h3>
            <p className="text-sm text-slate-400 mb-6">
              {tab === 'login'
                ? 'Sign in to access your saved properties.'
                : tab === 'signup'
                ? 'Join thousands finding homes without brokers.'
                : 'We\'ll send a reset link to your email.'}
            </p>

            {/* Tab switcher */}
            {tab !== 'forgot' && (
              <div className="flex p-1 rounded-xl bg-slate-100 mb-6">
                {[['login', 'Log in'], ['signup', 'Sign up']].map(([t, label]) => (
                  <button
                    key={t}
                    onClick={() => switchTab(t)}
                    className={[
                      'flex-1 py-2 rounded-lg text-sm font-semibold transition-all',
                      tab === t ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-400 hover:text-brand-600',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* Error */}
            {error && tab !== 'forgot' && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-100">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {tab === 'forgot' ? (
              resetSent ? (
                <div className="space-y-5 text-center">
                  <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.64A2 2 0 012 .18h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Check your inbox</p>
                    <p className="text-sm text-slate-400 mt-1">We sent a reset link to <span className="font-medium text-slate-600">{email}</span></p>
                  </div>
                  <button
                    type="button"
                    onClick={() => switchTab('login')}
                    className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all bg-brand-600 hover:bg-brand-700"
                  >
                    Back to log in
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgot} className="space-y-4">
                  <InputField label="Email address" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
                  {error && (
                    <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-100">
                      <p className="text-sm text-red-600">{error}</p>
                    </div>
                  )}
                  <button
                    type="submit" disabled={loading || !email}
                    className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all bg-brand-600 hover:bg-brand-700 disabled:opacity-50"
                  >
                    {loading ? 'Sending…' : 'Send reset link'}
                  </button>
                  <p className="text-sm text-center text-slate-400">
                    <button type="button" onClick={() => switchTab('login')} className="font-semibold text-brand-600 hover:text-brand-700">
                      ← Back to log in
                    </button>
                  </p>
                </form>
              )
            ) : tab === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <InputField label="Email address" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
                <InputField label="Password" type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••">
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showPw
                      ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </InputField>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="rounded border-slate-300 text-brand-600 focus:ring-brand-600" />
                    <span className="text-sm text-slate-600">Remember me</span>
                  </label>
                  <button type="button" onClick={() => switchTab('forgot')} className="text-sm font-medium text-brand-600 hover:text-brand-700">
                    Forgot password?
                  </button>
                </div>

                <button
                  type="submit" disabled={loading}
                  className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all bg-brand-600 hover:bg-brand-700 disabled:opacity-50"
                >
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>

                <p className="text-sm text-center text-slate-400">
                  Don&apos;t have an account?{' '}
                  <button type="button" onClick={() => switchTab('signup')} className="font-semibold text-brand-600 hover:text-brand-700">
                    Sign up free
                  </button>
                </p>
              </form>
            ) : (
              <form onSubmit={handleSignup} className="space-y-4">
                <InputField label="Full name" value={name} onChange={e => setName(e.target.value)} placeholder="Ravi Kumar" />
                <InputField label="Email address" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
                <InputField label="Password" type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 8 characters">
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showPw
                      ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </InputField>

                {/* Role picker */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">I am a</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[['TENANT', '🔑', 'Tenant / Renter'], ['OWNER', '🏠', 'Property Owner']].map(([v, emoji, label]) => (
                      <button
                        key={v} type="button" onClick={() => setRole(v)}
                        className={[
                          'py-3 rounded-xl text-sm font-semibold border-2 transition-all flex items-center justify-center gap-2',
                          role === v
                            ? 'border-brand-600 bg-brand-600 text-white'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-brand-200 hover:bg-brand-50',
                        ].join(' ')}
                      >
                        <span>{emoji}</span> {label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit" disabled={loading}
                  className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all bg-brand-600 hover:bg-brand-700 disabled:opacity-50"
                >
                  {loading ? 'Creating account…' : 'Create account'}
                </button>

                <p className="text-xs text-center text-slate-400">
                  By signing up you agree to our{' '}
                  <span className="underline cursor-default">Terms of Service</span>.
                </p>

                <p className="text-sm text-center text-slate-400">
                  Already have an account?{' '}
                  <button type="button" onClick={() => switchTab('login')} className="font-semibold text-brand-600 hover:text-brand-700">
                    Log in
                  </button>
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
