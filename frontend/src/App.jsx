import { useLocation } from 'react-router-dom'
import AppRoutes from './routes'
import Header from '@components/layout/Header'
import Footer from '@components/layout/Footer'
import Toaster from '@components/common/Toaster'
import ConfirmDialog from '@components/common/ConfirmDialog'
import LoginModal from '@features/auth/components/LoginModal'
import FilterModal from '@features/filters/components/FilterModal'
import { useRealtimeUpdates } from '@hooks/useRealtimeUpdates'

export default function App() {
  const { pathname } = useLocation()
  // Socket + live badge updates for every logged-in session — not just chat
  useRealtimeUpdates()

  const hideHeader = pathname.startsWith('/admin') || pathname.startsWith('/property/') || pathname === '/design-system'
  const hideFooter = pathname.startsWith('/user') || pathname.startsWith('/list') || pathname.startsWith('/admin') || pathname.startsWith('/property/') || pathname === '/design-system'
  const showHeader = !hideHeader
  const showFooter = !hideFooter

  return (
    <>
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
