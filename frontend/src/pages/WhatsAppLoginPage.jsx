import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MessageCircle } from 'lucide-react'
import { whatsappService } from '@services/whatsapp.service'
import { useAuth } from '@features/auth/hooks/useAuth'
import { useUiStore } from '@store/uiStore'

// Where the "Manage your property" link from WhatsApp lands. The token in the
// query is single-use and expires in 24h (backend features/whatsapp/
// loginLink.service.js); exchanging it mints an ordinary session, so from
// here on the person is simply signed in. Read once, scrubbed from the URL
// before anything else renders.
export default function WhatsAppLoginPage() {
  const navigate = useNavigate()
  const { loginSuccess } = useAuth()
  const setHostMode = useUiStore((s) => s.setHostMode)

  const { token, next } = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    const out = { token: params.get('token') ?? '', next: params.get('next') ?? '/list' }
    window.history.replaceState(null, '', window.location.pathname)
    return out
  }, [])

  const [error, setError] = useState(token ? '' : 'This link is missing its code.')

  useEffect(() => {
    if (!token) return
    whatsappService.exchangeLoginLink(token)
      .then((res) => {
        loginSuccess(res.data)
        // A WhatsApp owner is here to manage a listing — land in host mode.
        setHostMode(true)
        navigate(next.startsWith('/') ? next : '/list', { replace: true })
      })
      .catch((err) => setError(err?.message ?? 'This link is invalid or has expired.'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-100 p-6 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-brand-50 border border-brand-100 flex items-center justify-center mx-auto text-brand-700">
          <MessageCircle size={24} aria-hidden="true" />
        </div>
        {error ? (
          <>
            <h1 className="text-lg font-bold text-slate-900">Link not valid</h1>
            <p className="text-sm text-slate-600">{error}</p>
            <p className="text-sm text-slate-500">
              Links from WhatsApp work once and expire after a day. Message StayOnMap on WhatsApp for a fresh one, or sign in with your mobile number.
            </p>
            <button
              type="button"
              onClick={() => { useUiStore.getState().openLoginModal(); navigate('/', { replace: true }) }}
              className="w-full min-h-[44px] py-3 rounded-xl bg-[#111111] text-white text-sm font-semibold hover:bg-[#2a2a2a]"
            >
              Sign in
            </button>
          </>
        ) : (
          <>
            <h1 className="text-lg font-bold text-slate-900">Signing you in…</h1>
            <p className="text-sm text-slate-500">Taking you to your listings.</p>
          </>
        )}
      </div>
    </div>
  )
}
