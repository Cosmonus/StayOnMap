import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin } from 'lucide-react'
import { authService } from '@services/auth.service'
import { useAuth } from '@features/auth/hooks/useAuth'
import { useUiStore } from '@store/uiStore'
import { toast } from '@components/common/Toaster'
import Select from '@components/common/Select'
import { CITY_LIST_LABEL, CITY_NAMES } from '@/config/cities'

// Where the OAuth callback lands the browser. The backend puts its result in
// the URL FRAGMENT (never query — fragments stay out of server logs), as one of:
//   #token=…&refresh=…   signed in
//   #pending=…&name=…    new user — needs the city step (signup is city-gated)
//   #linked=Google       provider connected from Settings
//   #error=message
export default function OAuthCompletePage() {
  const navigate = useNavigate()
  const { loginSuccess } = useAuth()

  // Read ONCE, then scrub the fragment from the address bar/history — tokens
  // don't belong in either.
  const result = useMemo(() => {
    const params = new URLSearchParams(window.location.hash.slice(1))
    const r = Object.fromEntries(params.entries())
    window.history.replaceState(null, '', window.location.pathname)
    return r
  }, [])

  const [city, setCity] = useState('')
  const [otherCity, setOtherCity] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(result.error ?? '')
  const [waitlisted, setWaitlisted] = useState(false)

  useEffect(() => {
    if (result.token && result.refresh) {
      // Signed in — the /auth/me shape arrives via AuthContext's own fetch.
      authService.getMe()
        .then((r) => {
          loginSuccess({ token: result.token, refreshToken: result.refresh, user: r.data })
          // Same landing rule as the login modal: a surviving host mode
          // (loginSuccess drops it for non-owners) goes to the dashboard.
          navigate(useUiStore.getState().hostMode ? '/user?tab=dashboard' : '/', { replace: true })
        })
        .catch(() => setError('Sign-in was not completed. Please try again.'))
      // getMe needs the token before AuthContext has it:
      localStorage.setItem('user_token', result.token)
    }
    if (result.linked) {
      toast.success('Connected', `${result.linked} is now linked to your account`)
      navigate('/user?tab=settings', { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleCompleteSignup(e) {
    e.preventDefault()
    const chosen = city === '__other__' ? otherCity.trim() : city
    if (!chosen) return
    setBusy(true)
    setError('')
    try {
      const res = await authService.completeOAuthSignup({ token: result.pending, city: chosen })
      if (res.data?.waitlisted) { setWaitlisted(true); return }
      loginSuccess(res.data)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err?.message ?? 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-slate-100 p-6 space-y-5">
        {waitlisted ? (
          <div className="space-y-4 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto">
              <MapPin size={24} color="#059669" strokeWidth={2} />
            </div>
            <p className="text-sm font-semibold text-slate-800">You&apos;re on the waitlist</p>
            <p className="text-sm text-slate-500">
              StayOnMap is currently live in {CITY_LIST_LABEL}. We&apos;ll email you as soon as we launch near you.
            </p>
            <button onClick={() => navigate('/')} className="w-full py-3 rounded-xl text-sm font-bold text-white bg-brand-600 hover:bg-brand-700">
              Explore the map anyway
            </button>
          </div>
        ) : result.pending ? (
          <form onSubmit={handleCompleteSignup} className="space-y-4">
            <div>
              <h1 className="text-lg font-bold text-slate-800">
                Almost there{result.name ? `, ${result.name.split(' ')[0]}` : ''}
              </h1>
              <p className="text-sm text-slate-500 mt-1">One last thing — which city are you in?</p>
            </div>
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
                  onChange={(e) => setOtherCity(e.target.value)}
                  placeholder="Which city are you in?"
                  required
                  className="mt-2 w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-600 focus:border-brand-600 transition-all bg-slate-50 placeholder:text-slate-500"
                />
              )}
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button
              type="submit"
              disabled={busy || !city || (city === '__other__' && !otherCity.trim())}
              className="w-full py-3 rounded-xl text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50"
            >
              {busy ? 'Creating your account…' : 'Finish signing up'}
            </button>
          </form>
        ) : error ? (
          <div className="space-y-4 text-center">
            <p className="text-sm font-semibold text-slate-800">Sign-in didn&apos;t complete</p>
            <p className="text-sm text-slate-500">{error}</p>
            <button onClick={() => navigate('/')} className="w-full py-3 rounded-xl text-sm font-bold text-white bg-brand-600 hover:bg-brand-700">
              Back to StayOnMap
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center py-10">
            <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  )
}
