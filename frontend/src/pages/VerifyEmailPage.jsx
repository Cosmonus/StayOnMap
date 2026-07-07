import { useEffect, useRef, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { MailCheck, MailX } from 'lucide-react'
import { authService } from '@services/auth.service'

// Landing page for the emailed verification link — verifies automatically on
// load (no button to click; the click already happened in the email).
// Verification is idempotent server-side, so a re-visit just succeeds again.
export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [status, setStatus] = useState(token ? 'verifying' : 'error')
  const [error, setError] = useState(token ? '' : 'This link is missing or malformed.')
  const started = useRef(false)

  useEffect(() => {
    if (!token || started.current) return
    started.current = true
    authService
      .confirmEmailVerification({ token })
      .then(() => setStatus('verified'))
      .catch((err) => {
        setError(err?.message ?? 'This verification link is invalid or has expired.')
        setStatus('error')
      })
  }, [token])

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8">
        <Link to="/" className="no-underline flex items-center gap-2 mb-8">
          <span className="font-bold text-xl tracking-tight text-slate-900">
            Stay<span className="text-brand-600">OnMap</span>
          </span>
        </Link>

        {status === 'verifying' && (
          <div className="text-center py-8">
            <div className="w-8 h-8 mx-auto mb-4 rounded-full border-2 border-brand-600 border-t-transparent animate-spin" />
            <p className="text-sm font-semibold text-slate-800">Verifying your email…</p>
          </div>
        )}

        {status === 'verified' && (
          <div className="text-center py-8">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-green-50 flex items-center justify-center text-green-600">
              <MailCheck size={28} strokeWidth={1.8} />
            </div>
            <p className="text-base font-bold text-slate-900 mb-1">Email verified</p>
            <p className="text-sm text-slate-400 mb-6">Your account is now marked as verified.</p>
            <Link
              to="/"
              className="inline-block px-6 py-2.5 bg-[#111111] text-white text-sm font-semibold rounded-xl hover:bg-[#2a2a2a] no-underline"
            >
              Back to the map
            </Link>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center py-8">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-50 flex items-center justify-center text-red-500">
              <MailX size={28} strokeWidth={1.8} />
            </div>
            <p className="text-base font-bold text-slate-900 mb-1">Verification failed</p>
            <p className="text-sm text-slate-400 mb-6">
              {error} You can request a new link from Settings.
            </p>
            <Link
              to="/user?tab=settings"
              className="inline-block px-6 py-2.5 bg-[#111111] text-white text-sm font-semibold rounded-xl hover:bg-[#2a2a2a] no-underline"
            >
              Open Settings
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
