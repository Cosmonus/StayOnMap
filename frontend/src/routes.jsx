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
const LocalityPage      = lazyRetry(() => import('@pages/LocalityPage'))
const CityPage          = lazyRetry(() => import('@pages/CityPage'))
const PropertyPage      = lazyRetry(() => import('@pages/PropertyPage'))
const BlogPage          = lazyRetry(() => import('@pages/BlogPage'))
const BlogPostPage      = lazyRetry(() => import('@pages/BlogPostPage'))
const ServicesPage      = lazyRetry(() => import('@pages/ServicesPage'))
const AboutPage         = lazyRetry(() => import('@pages/AboutPage'))
const IntelligencePage  = lazyRetry(() => import('@pages/IntelligencePage'))
const ContactPage       = lazyRetry(() => import('@pages/ContactPage'))
const RulesPage         = lazyRetry(() => import('@pages/RulesPage'))
const PrivacyPolicyPage    = lazyRetry(() => import('@pages/PrivacyPolicyPage'))
const TermsOfServicePage   = lazyRetry(() => import('@pages/TermsOfServicePage'))
const DeleteAccountPage    = lazyRetry(() => import('@pages/DeleteAccountPage'))
const DashboardPage     = lazyRetry(() => import('@pages/DashboardPage'))
const HostOnboardingPage = lazyRetry(() => import('@pages/HostOnboardingPage'))
const NotFoundPage      = lazyRetry(() => import('@pages/NotFoundPage'))
const AdminLoginPage    = lazyRetry(() => import('@pages/AdminLoginPage'))
const AdminPage         = lazyRetry(() => import('@pages/AdminPage'))
const ResetPasswordPage = lazyRetry(() => import('@pages/ResetPasswordPage'))
const VerifyEmailPage   = lazyRetry(() => import('@pages/VerifyEmailPage'))
const OAuthCompletePage = lazyRetry(() => import('@pages/OAuthCompletePage'))
const WhatsAppLoginPage = lazyRetry(() => import('@pages/WhatsAppLoginPage'))

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
          {/* Locality landing pages. The server renders this route's <head>
              before React loads (backend features/seo) — this route is what
              renders the body, and what an in-app navigation hits. */}
          <Route path="/rent/:citySlug" element={<CityPage />} />
          <Route path="/rent/:citySlug/:localitySlug" element={<LocalityPage />} />
          {/* Articles. Same server-rendered-<head> arrangement as the locality
              and listing routes — the server answers /blog and /blog/:slug with
              a real title and BlogPosting JSON-LD, and these render the body. */}
          <Route path="/blog"         element={<BlogPage />} />
          <Route path="/blog/:slug"   element={<BlogPostPage />} />
          <Route path="/services"     element={<ServicesPage />} />
          <Route path="/property/:id" element={<PropertyPage />} />
          <Route path="/about"        element={<AboutPage />} />
          <Route path="/intelligence" element={<IntelligencePage />} />
          <Route path="/contact"      element={<ContactPage />} />
          <Route path="/rules"        element={<RulesPage />} />
          <Route path="/privacy"      element={<PrivacyPolicyPage />} />
          <Route path="/terms"        element={<TermsOfServicePage />} />
          {/* Public by design — the store-listing deletion link must be
              readable by someone who cannot sign in. Never wrap in UserGuard. */}
          <Route path="/delete-account" element={<DeleteAccountPage />} />

          {/* Authenticated user */}
          <Route path="/user"         element={<UserGuard><DashboardPage /></UserGuard>} />
          <Route path="/list"         element={<UserGuard><HostOnboardingPage /></UserGuard>} />

          {/* Password reset + email verification — public, token in URL query param */}
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-email"   element={<VerifyEmailPage />} />
          {/* Social-login landing — public, result arrives in the URL fragment */}
          <Route path="/oauth-complete" element={<OAuthCompletePage />} />
          {/* The single-use "manage your property" link an owner receives on
              WhatsApp — exchanges its token for an ordinary session. */}
          <Route path="/wa/login"       element={<WhatsAppLoginPage />} />

          {/* Admin — login is public, everything else guarded */}
          <Route path="/admin/login"  element={<AdminLoginPage />} />
          <Route path="/admin"        element={<AdminGuard><AdminPage /></AdminGuard>} />

<Route path="*"              element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </div>
  )
}
