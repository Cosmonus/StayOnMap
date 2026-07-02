import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import AuthGuard          from '@features/auth/components/AuthGuard'
import AdminGuard         from '@features/auth/AdminGuard'

// Eagerly loaded — needed immediately on first paint
import HomePage           from '@pages/HomePage'

// Lazy loaded — not needed until user navigates there
const PropertiesPage    = lazy(() => import('@pages/PropertiesPage'))
const PropertyPage      = lazy(() => import('@pages/PropertyPage'))
const AboutPage         = lazy(() => import('@pages/AboutPage'))
const IntelligencePage  = lazy(() => import('@pages/IntelligencePage'))
const ContactPage       = lazy(() => import('@pages/ContactPage'))
const RulesPage         = lazy(() => import('@pages/RulesPage'))
const DashboardPage     = lazy(() => import('@pages/DashboardPage'))
const SavedPage         = lazy(() => import('@pages/SavedPage'))
const AppointmentsPage  = lazy(() => import('@pages/AppointmentsPage'))
const LoginPage         = lazy(() => import('@pages/LoginPage'))
const NotFoundPage      = lazy(() => import('@pages/NotFoundPage'))
const AdminLoginPage    = lazy(() => import('@pages/AdminLoginPage'))
const AdminPage         = lazy(() => import('@pages/AdminPage'))
const ResetPasswordPage = lazy(() => import('@pages/ResetPasswordPage'))

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
          <Route path="/about"        element={<AboutPage />} />
          <Route path="/intelligence" element={<IntelligencePage />} />
          <Route path="/contact"      element={<ContactPage />} />
          <Route path="/rules"        element={<RulesPage />} />
          <Route path="/login"        element={<LoginPage />} />

          {/* Authenticated user */}
          <Route path="/user"         element={<AuthGuard><DashboardPage /></AuthGuard>} />
          <Route path="/saved"        element={<AuthGuard><SavedPage /></AuthGuard>} />
          <Route path="/appointments" element={<AuthGuard><AppointmentsPage /></AuthGuard>} />

          {/* Password reset — public, token in URL hash */}
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Admin — login is public, everything else guarded */}
          <Route path="/admin/login"  element={<AdminLoginPage />} />
          <Route path="/admin"        element={<AdminGuard><AdminPage /></AdminGuard>} />

<Route path="*"              element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </div>
  )
}
