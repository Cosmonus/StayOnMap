import { useQuery } from '@tanstack/react-query'
import { authService } from '@services/auth.service'

// Google brand mark inlined — one logo does not justify an icon package.
const ICONS = {
  google: (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.17 3.57-8.81z"/>
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.93-2.91l-3.87-3c-1.07.72-2.44 1.14-4.06 1.14-3.12 0-5.77-2.11-6.71-4.95H1.29v3.1A12 12 0 0 0 12 24z"/>
      <path fill="#FBBC05" d="M5.29 14.28A7.22 7.22 0 0 1 4.91 12c0-.79.14-1.56.38-2.28v-3.1H1.29a12 12 0 0 0 0 10.76l4-3.1z"/>
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.6 4.58 1.79l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.29 6.62l4 3.1C6.23 6.88 8.88 4.77 12 4.77z"/>
    </svg>
  ),
}

/**
 * Social sign-in buttons — rendered from GET /auth/oauth/providers, so a
 * provider without credentials configured simply doesn't exist here. With no
 * providers configured this renders nothing and the modal looks exactly as it
 * did before social login shipped.
 *
 * `mode` only changes the wording ("Sign in with" vs "Sign up with") — the
 * OAuth flow behind the button is identical either way: existing identity
 * logs in, new identity goes through the city step.
 *
 * `row` renders the buttons as flex items (icon + provider name only) for a
 * caller that lays them out in a shared row — the login tab pairs Google
 * with the sign-in-code button. The full wording stays in the aria-label.
 */
export default function SocialLoginButtons({ mode = 'login', row = false }) {
  const { data: providers } = useQuery({
    queryKey: ['oauth-providers'],
    queryFn: () => authService.getOAuthProviders().then((r) => r.data),
    staleTime: 60 * 60 * 1000, // config changes on deploy, not mid-session
  })

  if (!providers?.length) return null

  const verb = mode === 'signup' ? 'Sign up' : 'Sign in'
  // A provider that can't create accounts (X shares no email) stays off the
  // signup tab — a button that always errors is worse than no button.
  const usable = mode === 'signup' ? providers.filter((p) => p.canSignup !== false) : providers
  if (!usable.length) return null

  if (row) {
    return usable.map((p) => (
      <a
        key={p.key}
        href={`${import.meta.env.VITE_API_BASE_URL}/auth/oauth/${p.key}`}
        aria-label={`${verb} with ${p.label}`}
        className="flex-1 min-w-[45%] py-3 rounded-xl text-sm font-semibold border border-slate-200 text-slate-700 transition-all hover:bg-slate-50 hover:border-slate-300 flex items-center justify-center gap-2 no-underline"
      >
        {ICONS[p.key]}
        {p.label}
      </a>
    ))
  }

  return (
    <div className="space-y-2">
      {usable.map((p) => (
        <a
          key={p.key}
          href={`${import.meta.env.VITE_API_BASE_URL}/auth/oauth/${p.key}`}
          className="w-full py-2.5 rounded-xl text-sm font-semibold border border-slate-200 text-slate-700 transition-all hover:bg-slate-50 hover:border-slate-300 flex items-center justify-center gap-2.5 no-underline"
        >
          {ICONS[p.key]}
          {verb} with {p.label}
        </a>
      ))}
    </div>
  )
}
