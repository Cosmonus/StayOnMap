import { useState, useEffect } from 'react'
import { MailCheck } from 'lucide-react'
import { authService } from '@services/auth.service'
import { useAuth } from '../hooks/useAuth'

// Mirrors the backend's OTP_RESEND_COOLDOWN_MS (auth.service.js). The server
// is the real gate — this only stops the user firing a request it will 429.
const RESEND_COOLDOWN_MS = 60 * 1000

const secondsUntil = (at) => (at ? Math.max(0, Math.ceil((at - Date.now()) / 1000)) : 0)

// Derives the countdown from an absolute timestamp rather than decrementing a
// counter: background tabs throttle setInterval, so a decrementing timer would
// under-count and re-enable Resend early.
function useCountdown(until) {
  const [, tick] = useState(0)
  useEffect(() => {
    if (!until) return
    const id = setInterval(() => {
      tick((n) => n + 1)
      if (Date.now() >= until) clearInterval(id)
    }, 1000)
    return () => clearInterval(id)
  }, [until])
  return secondsUntil(until)
}

export default function OtpLoginForm({ email, setEmail, onUsePassword, onSignup, onDone }) {
  const { loginSuccess } = useAuth()
  const [step, setStep]       = useState('email')
  const [code, setCode]       = useState('')
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const [resendAt, setResendAt] = useState(0)
  const cooldown = useCountdown(resendAt)

  async function send(e) {
    e?.preventDefault()
    setLoading(true); setError('')
    try {
      await authService.requestLoginOtp({ email })
      setStep('code')
      setResendAt(Date.now() + RESEND_COOLDOWN_MS)
    } catch (err) {
      setError(err?.message ?? 'Could not send a code. Try signing in with your password.')
    } finally {
      setLoading(false)
    }
  }

  async function verify(e) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await authService.verifyLoginOtp({ email, code })
      loginSuccess(res.data)
      onDone()
    } catch (err) {
      setError(err?.message ?? 'Invalid or expired code')
      setLoading(false)
    }
  }

  if (step === 'email') {
    return (
      <form onSubmit={send} className="space-y-4">
        <div>
          <label htmlFor="otp-email" className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
          <input
            id="otp-email" name="otp-email" autoComplete="username"
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com" required autoFocus
            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-brand-600 transition-all bg-slate-50 placeholder:text-slate-500"
          />
        </div>

        {error && (
          <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-100">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <button
          type="submit" disabled={loading || !email}
          className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all bg-brand-600 hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? 'Sending…' : 'Email me a code'}
        </button>

        <p className="text-sm text-center text-slate-500">
          <button type="button" onClick={onUsePassword} className="font-semibold text-brand-600 hover:text-brand-700">
            Use my password instead
          </button>
        </p>

        {/* Codes only go to registered emails — say so up front and point new
            users at signup. Shown to everyone, so it reveals nothing about
            whether any particular email has an account. */}
        <p className="text-xs text-center text-slate-500 pt-1 border-t border-slate-100">
          Sign-in codes only work for existing accounts.{' '}
          <button type="button" onClick={onSignup} className="font-semibold text-brand-600 hover:text-brand-700">
            New to StayOnMap? Sign up first
          </button>
        </p>
      </form>
    )
  }

  return (
    <form onSubmit={verify} className="space-y-4">
      <div className="flex flex-col items-center text-center gap-2 pb-1">
        <div className="w-12 h-12 rounded-full bg-brand-50 border border-brand-100 flex items-center justify-center">
          <MailCheck size={22} className="text-brand-600" strokeWidth={2} />
        </div>
        {/* Deliberately hedged: the backend no-ops silently for unregistered
            emails so this screen can't confirm whether an account exists. */}
        <p className="text-sm text-slate-500">
          If <span className="font-medium text-slate-600">{email}</span> has an account, a 6-digit code is on its way. It expires in 10 minutes.
        </p>
        <p className="text-xs text-slate-500">
          No code after a minute? You may not have an account yet —{' '}
          <button type="button" onClick={onSignup} className="font-semibold text-brand-600 hover:text-brand-700">
            create one
          </button>
          , or check your spam folder.
        </p>
      </div>

      <div>
        <label htmlFor="otp-code" className="block text-sm font-medium text-slate-700 mb-1.5">Sign-in code</label>
        <input
          id="otp-code" value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          inputMode="numeric" autoComplete="one-time-code" placeholder="123456"
          required autoFocus
          className="w-full px-4 py-3 border border-slate-200 rounded-xl text-center text-lg font-semibold tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-brand-600 transition-all bg-slate-50 placeholder:text-slate-500 placeholder:tracking-[0.4em]"
        />
      </div>

      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-100">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <button
        type="submit" disabled={loading || code.length !== 6}
        className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all bg-brand-600 hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? 'Verifying…' : 'Sign in'}
      </button>

      <div className="flex items-center justify-between text-sm">
        <button
          type="button" onClick={() => { setStep('email'); setCode(''); setError('') }}
          className="text-slate-500 hover:text-slate-600"
        >
          ← Change email
        </button>
        <button
          type="button" onClick={send} disabled={cooldown > 0 || loading}
          className="font-semibold text-brand-600 hover:text-brand-700 disabled:text-slate-300 disabled:cursor-not-allowed"
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
        </button>
      </div>
    </form>
  )
}
