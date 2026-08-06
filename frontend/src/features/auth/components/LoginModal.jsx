import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Phone, MapPin, Eye, EyeOff, MailCheck } from 'lucide-react'
import { authService } from '@services/auth.service'
import { useAuth } from '../hooks/useAuth'
import { useUiStore } from '@store/uiStore'
import { CITY_LIST_LABEL, CITY_NAMES } from '@/config/cities'
import { usePlatformStats } from '@hooks/usePlatformStats'
import Select from '@components/common/Select'
import OtpLoginForm from './OtpLoginForm'
import SocialLoginButtons from './SocialLoginButtons'

const QUOTES = [
  { text: 'The ache for home lives in all of us.', author: 'Maya Angelou' },
  { text: 'Home is not a place — it\'s a feeling.', author: 'Cecelia Ahern' },
  { text: 'A house is made of bricks. A home is made of love.', author: 'Proverb' },
  { text: 'We find you houses. It\'s your responsibility to make it a home.', author: 'StayOnMap' },
]

// `id` + `autoComplete` are REQUIRED, not decoration. Without them the browser
// has no idea what a field holds: the name box was an unnamed type="text" in a
// form whose next field is type="email", and Chrome duly offered email
// addresses to autofill a person's name. The label can't rescue it either
// while it carries no htmlFor — an unassociated label is invisible to autofill
// and to a screen reader alike.
function InputField({ id, label, type = 'text', autoComplete, value, onChange, placeholder, children }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={type}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required
          className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-brand-600 transition-all bg-slate-50 placeholder:text-slate-500"
        />
        {children}
      </div>
    </div>
  )
}

export default function LoginModal() {
  const isOpen  = useUiStore((s) => s.loginModalOpen)
  const onClose = useUiStore((s) => s.closeLoginModal)
  const navigate = useNavigate()
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

  // Where a sign-in lands follows the persisted mode: host mode → the
  // dashboard (loginSuccess already dropped the mode for a non-owner account,
  // so a surviving hostMode means an owner); renter mode → no redirect, the
  // map or wherever the modal was opened. Runs AFTER loginSuccess.
  function landAfterLogin() {
    reset(); onClose()
    if (useUiStore.getState().hostMode) navigate('/user?tab=dashboard')
  }

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await authService.login({ email, password })
      loginSuccess(res.data)
      landAfterLogin()
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
      landAfterLogin()
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
        className="relative w-full max-w-3xl rounded-3xl overflow-hidden flex"
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

        {/* Close — pinned to the dialog, not inside the scrolling panel, so
            it neither scrolls away with a long form nor pushes it down. */}
        <button
          onClick={handleClose}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full flex items-center justify-center transition-colors bg-white/80 hover:bg-slate-100"
        >
          <X size={15} color="#64748b" strokeWidth={2.5} />
        </button>

        {/* Right panel. The old shell put justify-center INSIDE the scroll
            container — when the form outgrows the dialog (the signup tab on a
            short screen), justify-center overflows it both ways and the TOP
            half becomes unreachable by scrolling. Auto margins center when
            short and collapse to zero when tall, which is the difference. */}
        <div className="flex-1 bg-white overflow-y-auto">
          <div className="min-h-full flex flex-col px-5 py-8 sm:px-8">
            <div className="my-auto w-full">
            <h3 className="text-xl font-bold text-slate-800 mb-1">
              {tab === 'login' ? 'Welcome back' : tab === 'otp' ? 'Sign in with a code' : tab === 'forgot' ? 'Reset password' : waitlisted ? 'Almost there' : 'Create account'}
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              {tab === 'login'
                ? 'Sign in to access your saved properties.'
                : tab === 'otp'
                ? 'No password needed — we\'ll email you a 6-digit code.'
                : tab === 'forgot'
                ? 'We\'ll send a reset link to your email.'
                : waitlisted
                ? 'Thanks for your interest in StayOnMap.'
                : 'Join thousands finding homes without brokers.'}
            </p>

            {/* Tab switcher */}
            {tab !== 'forgot' && tab !== 'otp' && !waitlisted && (
              <div className="flex p-1 rounded-xl bg-slate-100 mb-6">
                {[['login', 'Log in'], ['signup', 'Sign up']].map(([t, label]) => (
                  <button
                    key={t}
                    onClick={() => switchTab(t)}
                    className={[
                      'flex-1 py-2 rounded-lg text-sm font-semibold transition-all',
                      tab === t ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-500 hover:text-brand-600',
                    ].join(' ')}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* Error */}
            {error && tab !== 'forgot' && tab !== 'otp' && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-100">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {tab === 'otp' ? (
              <OtpLoginForm
                email={email}
                setEmail={setEmail}
                onUsePassword={() => switchTab('login')}
                onSignup={() => switchTab('signup')}
                onDone={landAfterLogin}
              />
            ) : tab === 'forgot' ? (
              resetSent ? (
                <div className="space-y-5 text-center">
                  <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto">
                    <Phone size={24} color="#059669" strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-800">Check your inbox</p>
                    <p className="text-sm text-slate-500 mt-1">We sent a reset link to <span className="font-medium text-slate-600">{email}</span></p>
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
                  <InputField id="forgot-email" label="Email address" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
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
                  <p className="text-sm text-center text-slate-500">
                    <button type="button" onClick={() => switchTab('login')} className="font-semibold text-brand-600 hover:text-brand-700">
                      ← Back to log in
                    </button>
                  </p>
                </form>
              )
            ) : tab === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <InputField id="login-email" label="Email address" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
                <InputField id="login-password" label="Password" type={showPw ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••">
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-600"
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

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-xs text-slate-500">or</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>

                {/* Stacked, not a shared row: Google's sanctioned button text
                    is "Sign in with Google" in full, which doesn't fit half of
                    a 343px column. */}
                <div className="space-y-2">
                  <button
                    type="button" onClick={() => switchTab('otp')}
                    className="w-full min-h-[44px] py-3 rounded-xl text-sm font-semibold border border-slate-200 text-slate-700 transition-all hover:bg-slate-50 hover:border-slate-300 flex items-center justify-center gap-3"
                  >
                    <MailCheck size={18} strokeWidth={2} className="text-brand-600" />
                    Email me a sign-in code
                  </button>
                  <SocialLoginButtons />
                </div>

                <p className="text-sm text-center text-slate-500">
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
                  <p className="text-sm text-slate-500 mt-1">
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
                <InputField id="signup-name" label="Full name" autoComplete="name" value={name} onChange={e => setName(e.target.value)} placeholder="Ravi Kumar" />
                <InputField id="signup-email" label="Email address" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />

                <div>
                  {/* The waitlist line is the FIELD's hint, not a sibling
                      paragraph — a `<p className="mt-1">` here sat 4px under
                      the trigger while the open panel starts 6px under it, so
                      the dropdown sliced the line in half instead of covering
                      it. Select owns that clearance now. */}
                  <Select
                    label="City"
                    value={city}
                    onChange={setCity}
                    placeholder="Select your city"
                    hint={`We're only live in ${CITY_LIST_LABEL} right now — other cities go on our waitlist.`}
                    options={[
                      ...CITY_NAMES.map((c) => ({ value: c, label: c })),
                      { value: '__other__', label: "My city isn't listed" },
                    ]}
                  />
                  {city === '__other__' && (
                    <input
                      id="signup-other-city"
                      name="signup-other-city"
                      type="text"
                      autoComplete="address-level2"
                      value={otherCity}
                      onChange={e => setOtherCity(e.target.value)}
                      placeholder="Which city are you in?"
                      required
                      aria-label="Your city"
                      className="mt-2 w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-brand-600 transition-all bg-slate-50 placeholder:text-slate-500"
                    />
                  )}
                </div>

                <InputField id="signup-password" label="Password" type={showPw ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min. 8 characters">
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showPw
                      ? <EyeOff size={16} strokeWidth={2} />
                      : <Eye size={16} strokeWidth={2} />
                    }
                  </button>
                </InputField>
                {/* The placeholder said "Min. 8 characters" while the server
                    (strongPassword in auth.validation.js) also requires upper,
                    lower, a digit and a symbol — so "password1" was typed,
                    submitted, and bounced with a rule nobody had been told.
                    State the whole rule before they type it. */}
                <p className="-mt-2 text-xs text-slate-500">
                  At least 8 characters, with an uppercase letter, a lowercase letter, a number and a symbol.
                </p>

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

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-slate-200" />
                  <span className="text-xs text-slate-500">or</span>
                  <div className="flex-1 h-px bg-slate-200" />
                </div>

                <SocialLoginButtons mode="signup" />

                <p className="text-xs text-center text-slate-500">
                  By signing up you agree to our{' '}
                  <span className="underline cursor-default">Terms of Service</span>.
                </p>

                <p className="text-sm text-center text-slate-500">
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
    </div>
  )
}
