import { useState, useEffect } from 'react'
import { MailCheck, MessageSquareLock } from 'lucide-react'
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

/**
 * The two channels a sign-in code can arrive on.
 *
 * ONE FORM, PARAMETERISED, rather than two files. Everything that matters here
 * — the absolute-timestamp countdown, the hedged "if this has an account"
 * wording, the digits-only input, the resend gate — is identical for both, and
 * a second copy would drift on exactly those details. What genuinely differs is
 * the field, the copy and which endpoint gets called, so that is all this table
 * holds.
 */
const CHANNELS = {
  email: {
    Icon: MailCheck,
    label: 'Email address',
    type: 'email',
    autoComplete: 'username',
    placeholder: 'you@example.com',
    inputMode: undefined,
    cta: 'Email me a code',
    request: (value) => authService.requestLoginOtp({ email: value }),
    verify: (value, code) => authService.verifyLoginOtp({ email: value, code }),
    sentTo: (value) => value,
    // Only the email flow has a spam folder to blame.
    hint: 'or check your spam folder',
    // A 10-digit Indian mobile, matching the server's own rule.
    isComplete: (v) => Boolean(v),
    clean: (v) => v,
  },
  phone: {
    Icon: MessageSquareLock,
    label: 'Mobile number',
    type: 'tel',
    autoComplete: 'tel',
    placeholder: '9876543210',
    inputMode: 'numeric',
    cta: 'Text me a code',
    request: (value) => authService.requestPhoneLoginOtp({ phone: value }),
    verify: (value, code) => authService.verifyPhoneLoginOtp({ phone: value, code }),
    sentTo: (value) => `+91 ${value}`,
    hint: 'and that the number is verified on your account',
    isComplete: (v) => /^[6-9]\d{9}$/.test(v),
    // Digits only, capped at ten: the server rejects anything else, and
    // stripping here means a pasted "+91 98765 43210" still works.
    clean: (v) => v.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '').slice(0, 10),
  },
}

export default function OtpLoginForm({ channel = 'email', email, setEmail, onUsePassword, onSignup, onDone, onSwitchChannel }) {
  const ch = CHANNELS[channel] ?? CHANNELS.email
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
      await ch.request(email)
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
      const res = await ch.verify(email, code)
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
          <label htmlFor="otp-email" className="block text-sm font-medium text-slate-700 mb-1.5">{ch.label}</label>
          <input
            id="otp-email" name="otp-email" autoComplete={ch.autoComplete}
            type={ch.type} inputMode={ch.inputMode}
            value={email} onChange={(e) => setEmail(ch.clean(e.target.value))}
            placeholder={ch.placeholder} required autoFocus
            className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-brand-600 transition-all bg-slate-50 placeholder:text-slate-500"
          />
        </div>

        {error && (
          <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-100">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <button
          type="submit" disabled={loading || !ch.isComplete(email)}
          className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all bg-brand-600 hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? 'Sending…' : ch.cta}
        </button>

        <div className="space-y-1.5 text-center">
          {/* The other channel, offered where someone realises they picked the
              wrong one — not buried back on the previous screen. */}
          {onSwitchChannel && (
            <p className="text-sm text-slate-500">
              <button type="button" onClick={onSwitchChannel} className="font-semibold text-brand-600 hover:text-brand-700">
                {channel === 'phone' ? 'Email me a code instead' : 'Text me a code instead'}
              </button>
            </p>
          )}
          <p className="text-sm text-slate-500">
            <button type="button" onClick={onUsePassword} className="font-semibold text-brand-600 hover:text-brand-700">
              Use my password instead
            </button>
          </p>
        </div>

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
          <ch.Icon size={22} className="text-brand-600" strokeWidth={2} />
        </div>
        {/* Deliberately hedged: the backend no-ops silently for unregistered
            emails so this screen can't confirm whether an account exists. */}
        <p className="text-sm text-slate-500">
          If <span className="font-medium text-slate-600">{ch.sentTo(email)}</span> has an account, a 6-digit code is on its way. It expires in 10 minutes.
        </p>
        <p className="text-xs text-slate-500">
          No code after a minute? You may not have an account yet —{' '}
          <button type="button" onClick={onSignup} className="font-semibold text-brand-600 hover:text-brand-700">
            create one
          </button>
          , {ch.hint}.
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
