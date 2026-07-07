import { useState } from 'react'
import { X, Phone, MapPin, Eye, EyeOff } from 'lucide-react'
import { authService } from '@services/auth.service'
import { useAuth } from '../hooks/useAuth'
import { useUiStore } from '@store/uiStore'
import { CITY_LIST_LABEL, CITY_NAMES } from '@/config/cities'
import { usePlatformStats } from '@hooks/usePlatformStats'
import Select from '@components/common/Select'

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
  const [tab, setTab]           = useState('login')
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [role, setRole]         = useState('TENANT')
  const [city, setCity]         = useState('')
  const [otherCity, setOtherCity] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [waitlisted, setWaitlisted] = useState(false)
  const { totalActive, cities, isLoading: statsLoading } = usePlatformStats()

  const quote = QUOTES[Math.floor(Date.now() / 86400000) % QUOTES.length]

  function reset() {
    setName(''); setEmail(''); setPassword(''); setError(''); setLoading(false); setShowPw(false); setResetSent(false)
    setCity(''); setOtherCity(''); setWaitlisted(false)
  }

  function switchTab(t) { setTab(t); setError(''); setShowPw(false); setResetSent(false); setWaitlisted(false) }

  function handleClose() { reset(); onClose() }

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await authService.login({ email, password })
      loginSuccess(res.data)
      // No redirect — login lands on the map (or wherever the modal was opened).
      // The dashboard is host-mode territory, entered via "Become a host".
      reset(); onClose()
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
    const resolvedCity = city === '__other__' ? otherCity.trim() : city
    if (!resolvedCity) { setError('Please select your city'); return }
    setLoading(true); setError('')
    try {
      const res = await authService.register({ name: name.trim(), email, password, city: resolvedCity, role })
      if (res.data?.waitlisted) {
        setWaitlisted(true)
        setLoading(false)
        return
      }
      loginSuccess(res.data)
      reset(); onClose()
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
              <X size={14} color="#64748b" strokeWidth={2.5} />
            </button>
          </div>

          <div className="px-8 pb-8 pt-2 flex flex-col flex-1 justify-center">
            <h3 className="text-xl font-bold text-slate-800 mb-1">
              {tab === 'login' ? 'Welcome back' : tab === 'forgot' ? 'Reset password' : waitlisted ? 'Almost there' : 'Create account'}
            </h3>
            <p className="text-sm text-slate-400 mb-6">
              {tab === 'login'
                ? 'Sign in to access your saved properties.'
                : tab === 'forgot'
                ? 'We\'ll send a reset link to your email.'
                : waitlisted
                ? 'Thanks for your interest in StayOnMap.'
                : 'Join thousands finding homes without brokers.'}
            </p>

            {/* Tab switcher */}
            {tab !== 'forgot' && !waitlisted && (
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
                    <Phone size={24} color="#059669" strokeWidth={2} />
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
                      ? <EyeOff size={16} strokeWidth={2} />
                      : <Eye size={16} strokeWidth={2} />
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
            ) : waitlisted ? (
              <div className="space-y-5 text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto">
                  <MapPin size={24} color="#059669" strokeWidth={2} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">You&apos;re on the waitlist</p>
                  <p className="text-sm text-slate-400 mt-1">
                    StayOnMap is currently live in {CITY_LIST_LABEL}. We&apos;ll email <span className="font-medium text-slate-600">{email}</span> as soon as we launch near you.
                  </p>
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
              <form onSubmit={handleSignup} className="space-y-4">
                <InputField label="Full name" value={name} onChange={e => setName(e.target.value)} placeholder="Ravi Kumar" />
                <InputField label="Email address" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />

                <div>
                  <Select
                    label="City"
                    value={city}
                    onChange={setCity}
                    placeholder="Select your city"
                    options={[
                      ...CITY_NAMES.map((c) => ({ value: c, label: c })),
                      { value: '__other__', label: "My city isn't listed" },
                    ]}
                  />
                  {city === '__other__' && (
                    <input
                      type="text"
                      value={otherCity}
                      onChange={e => setOtherCity(e.target.value)}
                      placeholder="Which city are you in?"
                      required
                      className="mt-2 w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-brand-600 transition-all bg-slate-50 placeholder:text-slate-400"
                    />
                  )}
                  <p className="text-xs text-slate-400 mt-1">
                    We&apos;re only live in {CITY_LIST_LABEL} right now — other cities go on our waitlist.
                  </p>
                </div>

                <InputField label="Password" type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 8 characters">
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showPw
                      ? <EyeOff size={16} strokeWidth={2} />
                      : <Eye size={16} strokeWidth={2} />
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
