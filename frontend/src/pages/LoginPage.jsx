import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '@lib/supabase'
import { authService } from '@services/auth.service'

const QUOTES = [
  { text: 'The ache for home lives in all of us.', author: 'Maya Angelou' },
  { text: 'Home is not a place — it\'s a feeling.', author: 'Cecelia Ahern' },
  { text: 'A house is made of bricks. A home is made of love.', author: 'Proverb' },
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
          className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#f4511e] focus:border-transparent transition-all bg-slate-50 placeholder:text-slate-400"
        />
        {children}
      </div>
    </div>
  )
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from ?? '/'

  const initialTab = location.state?.tab ?? 'login'
  const [tab, setTab]           = useState(initialTab)
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [roles, setRoles]       = useState(['TENANT'])
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  const quote = QUOTES[Math.floor(Date.now() / 86400000) % QUOTES.length]

  function switchTab(t) { setTab(t); setError(''); setShowPw(false) }

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) { setError(err.message); setLoading(false); return }
    navigate('/user', { replace: true })
  }

  async function handleSignup(e) {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required'); return }
    if (roles.length === 0) { setError('Please select at least one role'); return }
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.signUp({ email, password, options: { data: { name: name.trim() } } })
    if (err) { setError(err.message); setLoading(false); return }
    // If both roles selected, register as OWNER (owners can do everything tenants can)
    const role = roles.includes('OWNER') ? 'OWNER' : 'TENANT'
    try {
      await authService.syncProfile({ name: name.trim(), role })
    } catch {
      // best-effort
    }
    navigate('/user', { replace: true })
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Left panel ── */}
      <div
        className="hidden lg:flex flex-col justify-between w-[45%] p-12 relative overflow-hidden"
        style={{ background: '#111111' }}
      >
        {/* Gradient orbs */}
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-25 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #f4511e 0%, transparent 65%)', transform: 'translate(40%, -40%)' }} />
        <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full opacity-15 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #ff8c42 0%, transparent 65%)', transform: 'translate(-30%, 30%)' }} />

        {/* Grid texture */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.04]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '36px 36px' }} />

        {/* Top: Logo + headline */}
        <div className="relative z-10">
          <Link to="/" className="flex items-center gap-2 no-underline mb-12">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #f4511e 0%, #d94318 100%)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
              </svg>
            </div>
            <span className="text-white font-bold text-xl tracking-tight">StayOnMap</span>
          </Link>

          <h1 className="text-white font-bold text-4xl leading-tight mb-4">
            Find your home.<br />
            <span style={{ color: '#f4511e' }}>No broker.<br />No fee.</span>
          </h1>
          <p className="text-base leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Connect directly with owners across Bangalore,<br />Chennai &amp; Hyderabad.
          </p>
        </div>

        {/* Bottom: Quote + stats */}
        <div className="relative z-10">
          <div className="mb-8 p-5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <p className="text-base italic leading-relaxed mb-3" style={{ color: 'rgba(255,255,255,0.8)' }}>
              &ldquo;{quote.text}&rdquo;
            </p>
            <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>— {quote.author}</p>
          </div>

          <div className="flex gap-8">
            {[['6,000+', 'Verified listings'], ['₹0', 'Brokerage ever'], ['3', 'Cities covered']].map(([val, lbl]) => (
              <div key={lbl}>
                <div className="text-white font-bold text-xl">{val}</div>
                <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{lbl}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Top bar — logo + back */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <Link to="/" className="flex items-center gap-2 no-underline">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #f4511e 0%, #d94318 100%)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
              </svg>
            </div>
            <span className="font-bold text-slate-900 text-base tracking-tight">StayOnMap</span>
          </Link>
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 no-underline transition-colors">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            Back
          </Link>
        </div>

        {/* Form area */}
        <div className="flex-1 flex items-center justify-center px-6 py-8">
          <div className="w-full max-w-md">

            <h2 className="text-2xl font-bold text-slate-800 mb-1">
              {tab === 'login' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="text-sm text-slate-400 mb-5">
              {tab === 'login'
                ? 'Sign in to access your saved properties and appointments.'
                : 'Join thousands finding homes without brokers.'}
            </p>

            {/* Tab switcher */}
            <div className="flex p-1 rounded-xl bg-slate-100 mb-5">
              {[['login', 'Log in'], ['signup', 'Sign up']].map(([t, label]) => (
                <button
                  key={t}
                  onClick={() => switchTab(t)}
                  className={[
                    'flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all',
                    tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400 hover:text-slate-600',
                  ].join(' ')}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Error */}
            {error && (
              <div className="mb-5 px-4 py-3 rounded-xl bg-red-50 border border-red-100">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {tab === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-5">
                <InputField
                  label="Email address"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
                <InputField
                  label="Password"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                >
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showPw
                      ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </InputField>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" className="rounded border-slate-300 accent-[#f4511e]" />
                    <span className="text-sm text-slate-600">Remember me</span>
                  </label>
                  <button type="button" className="text-sm font-semibold hover:underline" style={{ color: '#f4511e' }}>
                    Forgot password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 hover:opacity-90"
                  style={{ background: '#111111' }}
                >
                  {loading ? 'Signing in…' : 'Sign in →'}
                </button>

                <p className="text-sm text-center text-slate-400 pt-1">
                  Don&apos;t have an account?{' '}
                  <button type="button" onClick={() => switchTab('signup')} className="font-semibold text-slate-700 hover:underline">
                    Sign up free
                  </button>
                </p>
              </form>
            ) : (
              <form onSubmit={handleSignup} className="space-y-5">
                <InputField
                  label="Full name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Sri Gokul Krish"
                />
                <InputField
                  label="Email address"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
                <InputField
                  label="Password"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                >
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showPw
                      ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </InputField>

                {/* Role picker */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">I am a <span className="text-slate-400 font-normal">(select all that apply)</span></label>
                  <div className="grid grid-cols-2 gap-3">
                    {[['TENANT', '🔑', 'Tenant'], ['OWNER', '🏠', 'Owner']].map(([v, emoji, label]) => {
                      const selected = roles.includes(v)
                      return (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setRoles(prev =>
                            prev.includes(v) ? prev.filter(r => r !== v) : [...prev, v]
                          )}
                          className={[
                            'py-3.5 rounded-xl text-sm font-semibold border-2 transition-all flex items-center justify-center gap-2 relative',
                            selected
                              ? 'border-[#111111] bg-[#111111] text-white'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
                          ].join(' ')}
                        >
                          <span className="text-base">{emoji}</span> {label}
                          {selected && (
                            <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-white flex items-center justify-center">
                              <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                                <path d="M2 6l3 3 5-5" stroke="#111111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 hover:opacity-90"
                  style={{ background: '#111111' }}
                >
                  {loading ? 'Creating account…' : 'Create account →'}
                </button>

                <p className="text-xs text-center text-slate-400">
                  By signing up you agree to our{' '}
                  <Link to="/rules" className="underline text-slate-500 no-underline hover:text-slate-700">Community Rules</Link>
                  {' '}and Terms of Service.
                </p>

                <p className="text-sm text-center text-slate-400">
                  Already have an account?{' '}
                  <button type="button" onClick={() => switchTab('login')} className="font-semibold text-slate-700 hover:underline">
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
