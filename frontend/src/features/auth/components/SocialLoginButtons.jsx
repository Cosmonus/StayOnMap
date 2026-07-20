import { useQuery } from '@tanstack/react-query'
import { authService } from '@services/auth.service'

// Brand marks inlined — lucide carries no brand icons, and a whole icon
// package for four logos isn't worth the bytes.
const ICONS = {
  google: (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.17 3.57-8.81z"/>
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.93-2.91l-3.87-3c-1.07.72-2.44 1.14-4.06 1.14-3.12 0-5.77-2.11-6.71-4.95H1.29v3.1A12 12 0 0 0 12 24z"/>
      <path fill="#FBBC05" d="M5.29 14.28A7.22 7.22 0 0 1 4.91 12c0-.79.14-1.56.38-2.28v-3.1H1.29a12 12 0 0 0 0 10.76l4-3.1z"/>
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.6 4.58 1.79l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.29 6.62l4 3.1C6.23 6.88 8.88 4.77 12 4.77z"/>
    </svg>
  ),
  facebook: (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#1877F2" d="M24 12a12 12 0 1 0-13.88 11.85v-8.38H7.08V12h3.04V9.36c0-3 1.79-4.67 4.53-4.67 1.31 0 2.68.24 2.68.24v2.95h-1.51c-1.49 0-1.95.92-1.95 1.87V12h3.32l-.53 3.47h-2.79v8.38A12 12 0 0 0 24 12z"/>
    </svg>
  ),
  linkedin: (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#0A66C2" d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05a3.75 3.75 0 0 1 3.37-1.85c3.6 0 4.27 2.37 4.27 5.46v6.28zM5.32 7.43a2.07 2.07 0 1 1 0-4.13 2.07 2.07 0 0 1 0 4.13zM7.1 20.45H3.53V9H7.1v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.55C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.72C24 .77 23.2 0 22.22 0z"/>
    </svg>
  ),
  twitter: (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.67l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23zm-1.16 17.52h1.83L7.08 4.13H5.12l11.96 15.64z"/>
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
 */
export default function SocialLoginButtons({ mode = 'login' }) {
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
