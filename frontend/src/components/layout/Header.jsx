import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@features/auth/hooks/useAuth'
import { useUiStore } from '@store/uiStore'
import MapFilterBar from '@features/map/components/MapFilterBar'

const iconProps = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }

const NAV_TABS = [
  {
    label: 'Map',
    to: '/',
    icon: (
      <svg {...iconProps}><path d="M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3z" /><path d="M9 3v15M15 6v15" /></svg>
    ),
  },
  {
    label: 'Properties',
    to: '/properties',
    icon: (
      <svg {...iconProps}><path d="M3 21h18M5 21V7l7-4 7 4v14" /><path d="M9 21v-6h6v6" /></svg>
    ),
  },
  {
    label: 'Services',
    to: '/services',
    icon: (
      <svg {...iconProps}><path d="M3 21h18" /><path d="M12 3v3" /><path d="M5 21a7 7 0 0 1 14 0" /></svg>
    ),
  },
]

function MenuDropdown() {
  const { pathname } = useLocation()
  const { user, signOut } = useAuth()
  const openLoginModal = useUiStore((s) => s.openLoginModal)
  const [open, setOpen] = useState(false)

  const isActive = (to) =>
    pathname === to || (to === '/properties' && pathname.startsWith('/properties'))

  function resolveLink(to) {
    if (user && to === '/properties') return '/user?tab=properties'
    return to
  }

  const initial = user?.name?.[0] ?? user?.email?.[0]?.toUpperCase() ?? null

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Open menu"
        className="flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-full border border-slate-200 hover:shadow-md transition-shadow"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
        </svg>
        <span className="w-7 h-7 rounded-full bg-slate-600 text-white text-xs font-semibold flex items-center justify-center overflow-hidden">
          {initial ?? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12zm0 2.5c-3.3 0-9.8 1.6-9.8 4.9v2.4h19.6v-2.4c0-3.3-6.5-4.9-9.8-4.9z" />
            </svg>
          )}
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-40 w-52 bg-white rounded-xl shadow-panel border border-slate-200 py-2">
            {NAV_TABS.map(({ label, to }) => (
              <Link
                key={to}
                to={resolveLink(to)}
                onClick={() => setOpen(false)}
                className={`block px-4 py-2.5 text-sm no-underline ${
                  isActive(to) ? 'text-brand-600 font-semibold bg-brand-50' : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {label}
              </Link>
            ))}
            <div className="border-t border-slate-200 my-1" />
            {user ? (
              <>
                <Link to="/user" onClick={() => setOpen(false)} className="block px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-100 no-underline">
                  Dashboard
                </Link>
                <button
                  onClick={() => { signOut(); setOpen(false) }}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50"
                >
                  Log out
                </button>
              </>
            ) : (
              <button
                onClick={() => { openLoginModal(); setOpen(false) }}
                className="w-full text-left px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-100"
              >
                Login / Sign up
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function NavTabs() {
  const { pathname } = useLocation()
  const isActive = (to) =>
    to === '/' ? pathname === '/' : pathname.startsWith(to)

  return (
    <nav className="hidden md:flex items-center gap-1">
      {NAV_TABS.map(({ label, to, icon }) => {
        const active = isActive(to)
        return (
          <Link
            key={to}
            to={to}
            className={`relative flex items-center gap-2 px-3 py-2 rounded-full text-sm no-underline transition-colors ${
              active ? 'text-slate-900 font-semibold' : 'text-slate-500 font-medium hover:text-slate-900'
            }`}
          >
            <span className={active ? 'text-brand-600' : 'text-slate-400'}>{icon}</span>
            {label}
            {active && <span className="absolute -bottom-0.5 left-3 right-3 h-0.5 rounded-full bg-slate-900" />}
          </Link>
        )
      })}
    </nav>
  )
}

export default function Header() {
  const { pathname } = useLocation()
  const openLoginModal = useUiStore((s) => s.openLoginModal)
  const isMapPage = pathname === '/' || pathname.startsWith('/properties')

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

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-200 transition-transform duration-300 ${hidden ? '-translate-y-full' : 'translate-y-0'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-12 xl:px-20 h-16 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2 no-underline shrink-0">
          <span className="font-display font-bold text-lg sm:text-xl text-slate-900 tracking-tight">
            Stay<span className="text-brand-600">OnMap</span>
          </span>
        </Link>

        <div className="flex-1 flex justify-center min-w-0">
          <NavTabs />
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={openLoginModal}
            className="hidden sm:inline-block text-sm font-semibold text-slate-700 hover:bg-slate-100 px-3 py-2 rounded-full transition-colors"
          >
            List your property
          </button>
          <MenuDropdown />
        </div>
      </div>

      {isMapPage && (
        <div className="hidden md:flex justify-center border-t border-slate-100 px-4 py-2.5">
          <MapFilterBar />
        </div>
      )}
    </header>
  )
}
