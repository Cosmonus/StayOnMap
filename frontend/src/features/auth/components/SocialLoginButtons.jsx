import { useQuery } from '@tanstack/react-query'
import { authService } from '@services/auth.service'

// Google brand mark inlined — one logo does not justify an icon package.
// 18px is Google's own minimum for the mark on a standard-height button; it
// was 16 and is not ours to shrink.
const ICONS = {
  google: (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
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
 * The label is ALWAYS "<verb> with Google", never the bare provider name.
 * Google's Sign-In branding guidelines sanction exactly three wordings —
 * "Sign in with Google", "Sign up with Google", "Continue with Google" — plus
 * a logo-only button where space is tight. "[G] Google" is none of them, which
 * is what the login tab shipped when this component gained a half-width `row`
 * variant; the full wording doesn't fit half a row, so the variant is gone
 * rather than the wording.
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
          className="w-full min-h-[44px] py-3 rounded-xl text-sm font-semibold border border-slate-200 text-slate-700 transition-all hover:bg-slate-50 hover:border-slate-300 flex items-center justify-center gap-3 no-underline"
        >
          {ICONS[p.key]}
          {verb} with {p.label}
        </a>
      ))}
    </div>
  )
}
