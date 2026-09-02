import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useUiStore } from '@store/uiStore'
import AppRoutes from './routes'
import Header from '@components/layout/Header'
import Footer from '@components/layout/Footer'
import ScrollToTop from '@components/common/ScrollToTop'
import Toaster from '@components/common/Toaster'
import ConfirmDialog from '@components/common/ConfirmDialog'
import LoginModal from '@features/auth/components/LoginModal'
import FilterModal from '@features/filters/components/FilterModal'
import { useRealtimeUpdates } from '@hooks/useRealtimeUpdates'

export default function App() {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  // Socket + live badge updates for every logged-in session — not just chat
  useRealtimeUpdates()

  // /?signin=<email> — the WhatsApp bot's sign-in link. Opens the login modal
  // on the "Email me a sign-in code" form with the address filled in, then
  // drops the parameter so a refresh or a share does not reopen it. Read here
  // because the modal is mounted here, on every route.
  useEffect(() => {
    const params = new URLSearchParams(search)
    const email = params.get('signin')
    if (!email) return
    useUiStore.getState().openLoginModal({ tab: 'otp', email: email.trim().toLowerCase() })
    params.delete('signin')
    const rest = params.toString()
    navigate({ pathname, search: rest ? `?${rest}` : '' }, { replace: true })
  }, [search, pathname, navigate])

  const hideHeader = pathname.startsWith('/admin') || pathname.startsWith('/property/') || pathname === '/design-system'
  const hideFooter = pathname.startsWith('/user') || pathname.startsWith('/list') || pathname.startsWith('/admin') || pathname.startsWith('/property/') || pathname === '/design-system'
  const showHeader = !hideHeader
  const showFooter = !hideFooter

  return (
    <>
      <ScrollToTop />
      {showHeader && <Header />}
      <AppRoutes />
      {showFooter && <Footer />}
      <Toaster />
      <ConfirmDialog />
      <LoginModal />
      <FilterModal />
    </>
  )
}
