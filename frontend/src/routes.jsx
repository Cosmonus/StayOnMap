import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import UserGuard           from '@features/auth/UserGuard'
import AdminGuard         from '@features/auth/AdminGuard'

// Eagerly loaded — needed immediately on first paint
import HomePage           from '@pages/HomePage'

// Every deploy renames the hashed chunk files, so a tab still holding the old
// index.html 404s when it lazy-imports a route and the page renders blank.
// Reload once to pick up the fresh manifest; the sessionStorage guard stops a
// reload loop when the import failure is real.
function lazyRetry(importer) {
  return lazy(() =>
    importer()
      .then((mod) => {
        sessionStorage.removeItem('chunk_reload')
        return mod
      })
      .catch((err) => {
        if (sessionStorage.getItem('chunk_reload')) throw err
        sessionStorage.setItem('chunk_reload', '1')
        window.location.reload()
        return new Promise(() => {}) // hold Suspense until the reload lands
      })
  )
}

// Lazy loaded — not needed until user navigates there
const PropertiesPage    = lazyRetry(() => import('@pages/PropertiesPage'))
const PropertyPage      = lazyRetry(() => import('@pages/PropertyPage'))
// The four marketing pages — /services, /about, /intelligence, /contact — were
// DELETED 2026-07-30. They described the product to a visitor who is already
// looking at it, and the app-store listing covers that job for the Play release.
// Nothing functional went with them: the Contact page's three "channels" were
// all the same mailto (hello@cosmonus.com, now in the Footer and on the legal
// pages) and its form's onSubmit set `sent = true` and posted nowhere — so a
// page promising "we read every message" was discarding them.
// Don't re-add a route here without re-adding a page; `*` catches it as a 404,
// which is how the admin logo bug worked.
const RulesPage         = lazyRetry(() => import('@pages/RulesPage'))
const PrivacyPolicyPage    = lazyRetry(() => import('@pages/PrivacyPolicyPage'))
const TermsOfServicePage   = lazyRetry(() => import('@pages/TermsOfServicePage'))
const DashboardPage     = lazyRetry(() => import('@pages/DashboardPage'))
const HostOnboardingPage = lazyRetry(() => import('@pages/HostOnboardingPage'))
const NotFoundPage      = lazyRetry(() => import('@pages/NotFoundPage'))
const AdminLoginPage    = lazyRetry(() => import('@pages/AdminLoginPage'))
const AdminPage         = lazyRetry(() => import('@pages/AdminPage'))
const ResetPasswordPage = lazyRetry(() => import('@pages/ResetPasswordPage'))
const VerifyEmailPage   = lazyRetry(() => import('@pages/VerifyEmailPage'))
const OAuthCompletePage = lazyRetry(() => import('@pages/OAuthCompletePage'))

function PageFallback() {
  return (
    <div className="flex items-center justify-center min-h-screen">


      
      <div className="w-8 h-8 rounded-full border-2 border-brand-600 border-t-transparent animate-spin" />
    </div>
  )
}

export default function AppRoutes() {
  return (
    <div className="h-full">
      <Suspense fallback={<PageFallback />}>
        <Routes>
          {/* Public */}
          <Route path="/"             element={<HomePage />} />
          <Route path="/properties"   element={<PropertiesPage />} />
          <Route path="/property/:id" element={<PropertyPage />} />
          <Route path="/rules"        element={<RulesPage />} />
          <Route path="/privacy"      element={<PrivacyPolicyPage />} />
          <Route path="/terms"        element={<TermsOfServicePage />} />

          {/* Authenticated user */}
          <Route path="/user"         element={<UserGuard><DashboardPage /></UserGuard>} />
          <Route path="/list"         element={<UserGuard><HostOnboardingPage /></UserGuard>} />

          {/* Password reset + email verification — public, token in URL query param */}
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-email"   element={<VerifyEmailPage />} />
          {/* Social-login landing — public, result arrives in the URL fragment */}
          <Route path="/oauth-complete" element={<OAuthCompletePage />} />

          {/* Admin — login is public, everything else guarded */}
          <Route path="/admin/login"  element={<AdminLoginPage />} />
          <Route path="/admin"        element={<AdminGuard><AdminPage /></AdminGuard>} />

<Route path="*"              element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </div>
  )
}
