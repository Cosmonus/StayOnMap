import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { authService } from '@services/auth.service'
import { useUiStore } from '@store/uiStore'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const openLoginModal = useUiStore((s) => s.openLoginModal)

  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    setLoading(true); setError('')
    try {
      await authService.confirmPasswordReset({ token, newPassword: password })
      navigate('/')
      openLoginModal()
    } catch (err) {
      setError(err?.message ?? 'This reset link is invalid or has expired')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8">
        {/* Logo */}
        <Link to="/" className="no-underline flex items-center gap-2 mb-8">
          <span className="font-bold text-xl tracking-tight text-slate-900">
            Stay<span className="text-brand-600">OnMap</span>
          </span>
        </Link>

        {!token ? (
          <div className="text-center py-8">
            <p className="text-sm font-semibold text-slate-800">Invalid reset link</p>
            <p className="text-sm text-slate-400 mt-2">
              This link is missing or malformed.{' '}
              <Link to="/" className="text-brand-600 hover:underline">Go back home</Link>
              {' '}and request a new one.
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold text-slate-900 mb-1">Set new password</h1>
            <p className="text-sm text-slate-400 mb-6">Choose a strong password for your account.</p>

            {error && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-100">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">New password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    required
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 bg-slate-50 placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    tabIndex={-1}
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm password</label>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Re-enter password"
                  required
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 bg-slate-50 placeholder:text-slate-400"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !password || !confirm}
                className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50"
                style={{ background: '#111111' }}
              >
                {loading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
