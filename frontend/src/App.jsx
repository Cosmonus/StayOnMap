import { useLocation } from 'react-router-dom'
import AppRoutes from './routes'
import Header from '@components/layout/Header'
import Footer from '@components/layout/Footer'
import Toaster from '@components/common/Toaster'
import ConfirmDialog from '@components/common/ConfirmDialog'

export default function App() {
  const { pathname } = useLocation()

  const hideChrome = pathname.startsWith('/user') || pathname.startsWith('/admin') || pathname.startsWith('/property/') || pathname === '/login' || pathname === '/design-system'
  const showHeader = !hideChrome
  const showFooter = !hideChrome && pathname !== '/properties'

  return (
    <>
      {showHeader && <Header />}
      <AppRoutes />
      {showFooter && <Footer />}
      <Toaster />
      <ConfirmDialog />
    </>
  )
}
