import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Map as MapIcon, Home, ConciergeBell, Menu, User } from 'lucide-react'
import { useAuth } from '@features/auth/hooks/useAuth'
import { useUiStore } from '@store/uiStore'
import { useFilterStore } from '@store/filterStore'
import { countActiveFilters } from '@/config/filters'
import { chatService } from '@services/chat.service'
import { authService } from '@services/auth.service'
import MapFilterBar from '@features/map/components/MapFilterBar'
import FilterButton from '@features/filters/components/FilterButton'

const NAV_TABS = [
  {
    label: 'Map',
    to: '/',
    icon: <MapIcon size={20} strokeWidth={1.8} />,
  },
  {
    label: 'Properties',
    to: '/properties',
    icon: <Home size={20} strokeWidth={1.8} />,
  },
  {
    label: 'Services',
    to: '/services',
    icon: <ConciergeBell size={20} strokeWidth={1.8} />,
  },
]

const HOST_NAV_TABS = [
  { key: 'dashboard',    label: 'Dashboard',    to: '/user?tab=dashboard' },
  { key: 'messages',     label: 'Inbox',        to: '/user?tab=messages' },
  { key: 'appointments', label: 'Appointments', to: '/user?tab=appointments' },
  { key: 'calendar',     label: 'Calendar',     to: '/user?tab=calendar' },
  { key: 'my-listing',   label: 'My Listing',   to: '/list' },
]

function Badge({ count }) {
  if (!count) return null
  return (
    <span className="min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-bold rounded-full bg-red-500 text-white">
      {count > 9 ? '9+' : count}
    </span>
  )
}

function HamburgerIcon() {
  return <Menu size={16} color="#374151" strokeWidth={2} />
}

function AvatarCircle({ user, size = 'w-7 h-7' }) {
  const initial = user?.name?.[0] ?? user?.email?.[0]?.toUpperCase() ?? null
  if (user?.avatarUrl) {
    return <img src={user.avatarUrl} alt="" className={`${size} rounded-full object-cover shrink-0`} />
  }
  return (
    <span className={`${size} rounded-full bg-slate-600 text-white text-xs font-semibold flex items-center justify-center overflow-hidden shrink-0`}>
      {initial ?? <User size={16} />}
    </span>
  )
}

// Generic dropdown shell — trigger + item list. Reused by all three nav variants
// instead of three copies of the same open/close/backdrop chrome.
function DropdownMenu({ trigger, triggerClassName, items }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Open menu"
        className={triggerClassName ?? 'flex items-center justify-center w-7 h-7 rounded-full hover:bg-slate-100 transition-colors shrink-0'}
      >
        {trigger}
      </button>

      {open && (
        <>
          {/* Portal the backdrop to <body>: the <header> uses a CSS transform
              (its hide-on-scroll animation), which makes it the containing
              block for fixed descendants — so a nested `fixed inset-0` is
              trapped inside the ~64px header bar and never covers the map.
              Portaled to body it truly spans the viewport, so a click anywhere
              (map included) closes the menu. */}
          {createPortal(
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />,
            document.body,
          )}
          <div className="absolute right-0 top-full mt-2 z-40 w-56 bg-white rounded-xl shadow-panel border border-slate-200 py-2">
            {items.map((item) =>
              item.divider ? (
                <div key={item.key} className={`border-t border-slate-200 my-1 ${item.className ?? ''}`} />
              ) : item.to ? (
                <Link
                  key={item.key}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className={`flex items-center justify-between gap-2 px-4 py-2.5 text-sm no-underline ${
                    item.danger ? 'text-red-500 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-100'
                  } ${item.className ?? ''}`}
                >
                  {item.label}
                  <Badge count={item.badge} />
                </Link>
              ) : (
                <button
                  key={item.key}
                  onClick={() => { setOpen(false); item.onClick() }}
                  className={`w-full flex items-center justify-between gap-2 text-left px-4 py-2.5 text-sm ${
                    item.danger ? 'text-red-500 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-100'
                  } ${item.className ?? ''}`}
                >
                  {item.label}
                  <Badge count={item.badge} />
                </button>
              )
            )}
          </div>
        </>
      )}
    </div>
  )
}

function NavTabs({ tabs }) {
  return (
    <nav className="hidden md:flex items-center gap-1">
      {tabs.map(({ key, label, to, icon, active, badge }) => (
        <Link
          key={key ?? to}
          to={to}
          className={`relative flex items-center gap-2 px-3 py-2 rounded-full text-sm no-underline transition-colors ${
            active ? 'text-slate-900 font-semibold' : 'text-slate-500 font-medium hover:text-slate-900'
          }`}
        >
          {icon && <span className={active ? 'text-brand-600' : 'text-slate-400'}>{icon}</span>}
          {label}
          <Badge count={badge} />
          {active && <span className="absolute -bottom-0.5 left-3 right-3 h-0.5 rounded-full bg-slate-900" />}
        </Link>
      ))}
    </nav>
  )
}

// ── Guest — unchanged from the original single-variant Header ──────────────
function GuestActions() {
  const { pathname } = useLocation()
  const openLoginModal = useUiStore((s) => s.openLoginModal)

  const isActive = (to) => (to === '/' ? pathname === '/' : pathname.startsWith(to))
  const tabs = NAV_TABS.map((t) => ({ ...t, active: isActive(t.to) }))

  const menuItems = [
    // Only needed on mobile — NavTabs above already shows these at md+.
    ...NAV_TABS.map((t) => ({ key: t.to, label: t.label, to: t.to, className: 'md:hidden' })),
    { key: 'divider', divider: true, className: 'md:hidden' },
    { key: 'login', label: 'Login / Sign up', onClick: openLoginModal },
  ]

  return (
    <>
      <div className="flex-1 flex justify-center min-w-0">
        <NavTabs tabs={tabs} />
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <DropdownMenu trigger={<HamburgerIcon />} items={menuItems} />
        <button onClick={openLoginModal} aria-label="Log in" className="shrink-0">
          <AvatarCircle user={null} />
        </button>
      </div>
    </>
  )
}

// ── Traveler — logged in, not hosting ───────────────────────────────────────
function TravelerActions({ unreadMessages, onBecomeHost, profile }) {
  const { pathname, search } = useLocation()
  const { signOut } = useAuth()
  const navigate = useNavigate()

  const isActive = (to) => (to === '/' ? pathname === '/' : pathname.startsWith(to))
  const currentTab = new URLSearchParams(search).get('tab')

  // Messages gets equal top-level billing to host mode's "Inbox" tab —
  // contacting a property owner is a traveler action, it shouldn't require
  // switching to host mode just to reach a prominent chat entry point.
  const tabs = [
    ...NAV_TABS.map((t) => ({ ...t, active: isActive(t.to) })),
    { key: 'messages', label: 'Messages', to: '/user?tab=messages', active: pathname === '/user' && currentTab === 'messages', badge: unreadMessages },
  ]

  const menuItems = [
    // Duplicates the top NavTabs row — NavTabs is desktop-only (`hidden
    // md:flex`), so on mobile the hamburger is the ONLY way to reach these.
    // Hidden at md+ here since NavTabs already covers it there.
    ...tabs.map((t) => ({ key: t.key ?? t.to, label: t.label, to: t.to, badge: t.badge, className: 'md:hidden' })),
    { key: 'divider-tabs', divider: true, className: 'md:hidden' },
    { key: 'wishlist',      label: 'Wishlist',      to: '/user?tab=wishlist' },
    { key: 'appointments',  label: 'Appointments',  to: '/user?tab=appointments' },
    { key: 'leases',        label: 'Rented',        to: '/user?tab=leases' },
    { key: 'profile',       label: 'Profile',       to: '/user?tab=settings' },
    { key: 'notifications', label: 'Notifications', to: '/user?tab=notifications' },
    { key: 'account',       label: 'Account',       to: '/user?tab=settings' },
    { key: 'support',       label: 'Support',       to: '/user?tab=support' },
    { key: 'divider',       divider: true },
    { key: 'become-host',   label: 'Become a host', onClick: onBecomeHost },
    { key: 'logout',        label: 'Log out', danger: true, onClick: () => { signOut(); navigate('/') } },
  ]

  return (
    <>
      <div className="flex-1 flex justify-center min-w-0">
        <NavTabs tabs={tabs} />
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onBecomeHost}
          className="hidden sm:inline-block text-sm font-semibold text-slate-700 hover:bg-slate-100 px-3 py-2 rounded-full transition-colors"
        >
          Become a host
        </button>
        <DropdownMenu trigger={<HamburgerIcon />} items={menuItems} />
        <Link to="/user?tab=settings" aria-label="Your account" className="shrink-0">
          <AvatarCircle user={profile} />
        </Link>
      </div>
    </>
  )
}

// ── Host mode — persistent, replaces the traveler nav everywhere ───────────
function HostActions({ unreadMessages, onSwitchToTraveling, profile }) {
  const { pathname, search } = useLocation()
  const { signOut } = useAuth()
  const navigate = useNavigate()

  const currentTab = new URLSearchParams(search).get('tab') ?? 'dashboard'
  const tabs = HOST_NAV_TABS.map((t) => ({
    ...t,
    active: t.key === 'my-listing' ? pathname.startsWith('/list') : pathname === '/user' && currentTab === t.key,
    badge: t.key === 'messages' ? unreadMessages : 0,
  }))

  const menuItems = [
    // Duplicates the top NavTabs row (HOST_NAV_TABS) — NavTabs is
    // desktop-only (`hidden md:flex`), so on mobile the hamburger is the
    // ONLY way to switch between Dashboard/Inbox/Appointments/Calendar/My
    // Listing.
    ...tabs.map((t) => ({ key: `tab-${t.key}`, label: t.label, to: t.to })),
    { key: 'divider-tabs', divider: true },
    { key: 'notifications',      label: 'Notifications',      to: '/user?tab=notifications' },
    { key: 'account',            label: 'Account',             to: '/user?tab=settings' },
    { key: 'support',            label: 'Support',             to: '/user?tab=support' },
    { key: 'divider',            divider: true },
    { key: 'switch-to-traveling', label: 'Switch to traveling', onClick: onSwitchToTraveling },
    { key: 'logout',             label: 'Log out', danger: true, onClick: () => { signOut(); navigate('/') } },
  ]

  return (
    <>
      <div className="flex-1 flex justify-center min-w-0">
        <NavTabs tabs={tabs} />
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onSwitchToTraveling}
          className="hidden sm:inline-block text-sm font-semibold text-slate-700 hover:bg-slate-100 px-3 py-2 rounded-full transition-colors"
        >
          Exit hosting
        </button>
        <DropdownMenu trigger={<HamburgerIcon />} items={menuItems} />
        <Link to="/user?tab=settings" aria-label="Your account" className="shrink-0">
          <AvatarCircle user={profile} />
        </Link>
      </div>
    </>
  )
}

export default function Header() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const hostMode = useUiStore((s) => s.hostMode)
  const setHostMode = useUiStore((s) => s.setHostMode)
  const openFilterModal = useUiStore((s) => s.openFilterModal)
  const mapFilterCount = useFilterStore((s) => countActiveFilters(s.filters))
  const isMapPage = pathname === '/' || pathname.startsWith('/properties')

  const { data: unreadMessages = 0 } = useQuery({
    queryKey: ['chat-unread'],
    queryFn: () => chatService.unreadCount().then((r) => r.data?.count ?? 0),
    enabled: !!user,
    refetchInterval: 30000,
  })

  const { data: profile } = useQuery({
    queryKey: ['me'],
    queryFn: () => authService.getMe().then((r) => r.data),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  })

  function handleBecomeHost() {
    setHostMode(true)
    navigate('/user?tab=dashboard')
  }

  function handleSwitchToTraveling() {
    setHostMode(false)
    navigate('/')
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

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-200 transition-transform duration-300 ${hidden ? '-translate-y-full' : 'translate-y-0'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-12 xl:px-20 h-16 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2 no-underline shrink-0">
          <span className="font-display font-bold text-lg sm:text-xl text-slate-900 tracking-tight">
            Stay<span className="text-brand-600">OnMap</span>
          </span>
        </Link>

        {!user ? (
          <GuestActions />
        ) : hostMode ? (
          <HostActions unreadMessages={unreadMessages} onSwitchToTraveling={handleSwitchToTraveling} profile={profile ?? user} />
        ) : (
          <TravelerActions unreadMessages={unreadMessages} onBecomeHost={handleBecomeHost} profile={profile ?? user} />
        )}
      </div>

      {isMapPage && (
        <div className="flex items-center justify-center gap-2.5 border-t border-slate-100 px-4 py-2.5">
          <MapFilterBar />
          <FilterButton activeCount={mapFilterCount} onClick={openFilterModal} />
        </div>
      )}
    </header>
  )
}
