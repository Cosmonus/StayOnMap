import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@features/auth/hooks/useAuth'



const NAV_LINKS = [
  { label: 'Home',         to: '/' },
  { label: 'Properties',   to: '/properties' },
  { label: 'Intelligence', to: '/intelligence' },
  { label: 'About',        to: '/about' },
  { label: 'Contact',      to: '/contact' },
]

function UserMenu({ user, signOut }) {
  const [open, setOpen] = useState(false)
  const initial = user.user_metadata?.name?.[0] ?? user.email?.[0]?.toUpperCase() ?? 'U'

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
      >
        <span className="w-8 h-8 rounded-full bg-brand-600 text-white text-sm font-semibold flex items-center justify-center">
          {initial}
        </span>
        <span className="hidden md:block text-sm font-medium text-slate-700 max-w-[120px] truncate">
          {user.user_metadata?.name ?? user.email}
        </span>
        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-40 w-44 bg-white rounded-xl shadow-panel border border-slate-200 py-1">
            <Link to="/user" onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-100 no-underline">
              Dashboard
            </Link>
            <div className="border-t border-slate-200 mt-1 pt-1">
              <button
                onClick={() => { signOut(); setOpen(false) }}
                className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50"
              >
                Log out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default function Header() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const { user, signOut } = useAuth()

  function goToLogin() { navigate('/login') }

  function resolveLink(to) {
    if (user && to === '/properties') return '/user?tab=properties'
    return to
  }

  const lastY = useRef(0)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY
      setHidden(y > lastY.current && y > 80)
      lastY.current = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const isActive = (to) =>
    pathname === to || (to === '/properties' && pathname.startsWith('/properties'))

  return (
    <>
      <header className={`fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-200 shadow-sm transition-transform duration-300 ${hidden ? '-translate-y-full' : 'translate-y-0'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-12 xl:px-20 h-16 flex items-center justify-between gap-4">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 no-underline shrink-0">
            <span className="font-display font-bold text-lg sm:text-xl text-slate-900 tracking-tight">
              Stay<span className="text-brand-600">OnMap</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map(({ label, to }) => (
              <Link
                key={to}
                to={resolveLink(to)}
                className={[
                  'text-sm font-medium no-underline pb-0.5 border-b-2 transition-colors duration-150',
                  isActive(to)
                    ? 'text-brand-600 border-brand-600'
                    : 'text-slate-600 border-transparent hover:text-slate-900',
                ].join(' ')}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Desktop auth */}
          <div className="hidden md:flex items-center">
            {user ? (
              <UserMenu user={user} signOut={signOut} />
            ) : (
              <button
                onClick={goToLogin}
                className="px-5 py-2 text-sm font-semibold text-white bg-[#111111] hover:bg-[#2a2a2a] rounded-lg transition-colors"
              >
                Login
              </button>
            )}
          </div>

          {/* Mobile: auth shortcut + hamburger */}
          <div className="flex md:hidden items-center gap-2">
            {user ? (
              <UserMenu user={user} signOut={signOut} />
            ) : (
              <button
                onClick={goToLogin}
                className="text-sm font-semibold text-white bg-[#111111] px-4 py-1.5 rounded-lg hover:bg-[#2a2a2a] transition-colors"
              >
                Login
              </button>
            )}
            <button
              onClick={() => setMenuOpen(v => !v)}
              aria-label="Toggle menu"
              className="p-2 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
            >
              {menuOpen ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              )}
            </button>
          </div>

        </div>
      </header>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMenuOpen(false)}>
          <div className="fixed top-16 left-0 right-0 bg-white/95 backdrop-blur-sm border-b border-slate-200 shadow-md px-4 py-4" onClick={(e) => e.stopPropagation()}>
            <nav className="flex flex-col gap-1 mb-4">
              {NAV_LINKS.map(({ label, to }) => (
                <Link
                  key={to}
                  to={resolveLink(to)}
                  onClick={() => setMenuOpen(false)}
                  className={[
                    'px-4 py-3 rounded-xl text-sm font-medium no-underline transition-colors',
                    isActive(to)
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-slate-700 hover:bg-slate-100',
                  ].join(' ')}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}

    </>
  )
}
