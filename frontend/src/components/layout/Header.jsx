import { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Map as MapIcon, Home, ConciergeBell, Menu, User,
  LayoutDashboard, MessageSquare, CalendarCheck, CalendarDays, Building2,
  Bell, UserRound, LifeBuoy, LogOut, ArrowLeftRight, Heart, KeyRound,
} from 'lucide-react'
import { useAuth } from '@features/auth/hooks/useAuth'
import { useUiStore } from '@store/uiStore'
import { useFilterStore } from '@store/filterStore'
import { countActiveFilters } from '@/config/filters'
import { chatService } from '@services/chat.service'
import { notificationService } from '@services/notification.service'
import { authService } from '@services/auth.service'
import MapFilterBar from '@features/map/components/MapFilterBar'
import FilterButton from '@features/filters/components/FilterButton'
import NotificationBell from '@features/notifications/components/NotificationBell'
import ActionMenu from '@components/common/ActionMenu'

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

// Text-only in the tab row (2026-07-27, operator decision) — five icons plus
// five labels was double-encoding. The hamburger duplicates still carry one:
// see TAB_MENU_ICON below.
// Order is an operator decision (2026-07-28): the listings a host manages come
// right after Dashboard, then the people-facing surfaces, Calendar last.
const HOST_NAV_TABS = [
  { key: 'dashboard',    label: 'Dashboard',    to: '/user?tab=dashboard' },
  { key: 'my-listing',   label: 'My Listing',   to: '/list' },
  { key: 'appointments', label: 'Appointments', to: '/user?tab=appointments' },
  { key: 'messages',     label: 'Inbox',        to: '/user?tab=messages' },
  { key: 'calendar',     label: 'Calendar',     to: '/user?tab=calendar' },
]

// The host tabs' hamburger duplicates keep an icon each, at the menu's own
// 17px, so every row of the menu stays one visual system — they used to
// inherit the tab row's 20px icons and sat visibly larger than the rows below.
const TAB_MENU_ICON = {
  dashboard:    <LayoutDashboard size={17} strokeWidth={1.8} />,
  messages:     <MessageSquare size={17} strokeWidth={1.8} />,
  appointments: <CalendarCheck size={17} strokeWidth={1.8} />,
  calendar:     <CalendarDays size={17} strokeWidth={1.8} />,
  'my-listing': <Building2 size={17} strokeWidth={1.8} />,
}

// One icon per menu row, in both signed-in modes. A dropdown of bare text
// beneath a tab row that has icons reads as two different products.
const MENU_ICON = {
  notifications: <Bell size={17} strokeWidth={1.8} />,
  account:       <UserRound size={17} strokeWidth={1.8} />,
  support:       <LifeBuoy size={17} strokeWidth={1.8} />,
  wishlist:      <Heart size={17} strokeWidth={1.8} />,
  appointments:  <CalendarCheck size={17} strokeWidth={1.8} />,
  rented:        <KeyRound size={17} strokeWidth={1.8} />,
  switch:        <ArrowLeftRight size={17} strokeWidth={1.8} />,
  logout:        <LogOut size={17} strokeWidth={1.8} />,
}

// Tabs a person uses in BOTH hats, where switching hat should change whose
// data you are looking at rather than which page you are on. `dashboard` is
// deliberately absent: renter mode has no dashboard, and DashboardPage's own
// redirect sends it to the map — the two must agree or they race.
const SHARED_TABS = new Set(['messages', 'appointments', 'notifications', 'settings', 'support'])

// A two-state switch, not a sixth tab. What shipped here was a lone pill —
// same height, same radius, same text size and weight as the tabs beside it —
// that replaced the entire navigation and threw you onto another screen when
// pressed. A segmented control on a filled track says "you are in one of two
// modes" before anybody touches it, which is the honest affordance for
// something that changes the whole shell.
function ModeSwitch({ hostMode, onSwitch, otherModeWaiting }) {
  const segments = [
    { key: 'renting', label: 'Renting', host: false },
    { key: 'hosting', label: 'Hosting', host: true },
  ]
  return (
    <div role="group" aria-label="Renting or hosting" className="hidden sm:flex items-center gap-1 p-1 rounded-full bg-slate-100 shrink-0">
      {segments.map((s) => {
        const active = s.host === hostMode
        const waiting = !active && otherModeWaiting > 0
        return (
          <button
            key={s.key}
            type="button"
            onClick={() => onSwitch(s.host)}
            aria-pressed={active}
            aria-label={waiting ? `${s.label} — ${otherModeWaiting} waiting` : s.label}
            className={`relative min-h-[40px] px-4 rounded-full text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
              active ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {s.label}
            {waiting && <span aria-hidden="true" className="absolute top-1 right-2 w-2 h-2 rounded-full bg-red-500" />}
          </button>
        )
      })}
    </div>
  )
}

// The tab-row unread pill. ActionMenu carries its own copy for menu items.
function Badge({ count }) {
  if (!count) return null
  return (
    <span className="min-w-[16px] h-4 px-1 flex items-center justify-center text-[11px] font-bold rounded-full bg-red-500 text-white">
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
          {icon && <span className={active ? 'text-brand-600' : 'text-slate-500'}>{icon}</span>}
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
    ...NAV_TABS.map((t) => ({ key: t.to, label: t.label, to: t.to, icon: t.icon, className: 'md:hidden' })),
    { key: 'divider', divider: true, className: 'md:hidden' },
    { key: 'login', label: 'Login / Sign up', onClick: openLoginModal },
  ]

  return (
    <>
      <div className="flex-1 flex justify-center min-w-0">
        <NavTabs tabs={tabs} />
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <ActionMenu trigger={<HamburgerIcon />} items={menuItems} />
        <button onClick={openLoginModal} aria-label="Log in" className="shrink-0">
          <AvatarCircle user={null} />
        </button>
      </div>
    </>
  )
}

// ── Traveler — logged in, not hosting ───────────────────────────────────────
function TravelerActions({ unreadMessages, unreadOtherMode, onSwitchMode, isOwner, profile }) {
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
    ...tabs.map((t) => ({ key: t.key ?? t.to, label: t.label, to: t.to, badge: t.badge, icon: t.icon, className: 'md:hidden' })),
    { key: 'divider-tabs', divider: true, className: 'md:hidden' },
    { key: 'wishlist',      label: 'Wishlist',      to: '/user?tab=wishlist',      icon: MENU_ICON.wishlist },
    { key: 'appointments',  label: 'Appointments',  to: '/user?tab=appointments',  icon: MENU_ICON.appointments },
    { key: 'leases',        label: 'Rented',        to: '/user?tab=leases',        icon: MENU_ICON.rented },
    { key: 'notifications', label: 'Notifications', to: '/user?tab=notifications', icon: MENU_ICON.notifications },
    { key: 'account',       label: 'Account',       to: '/user?tab=settings',      icon: MENU_ICON.account },
    { key: 'support',       label: 'Support',       to: '/user?tab=support',       icon: MENU_ICON.support },
    { key: 'divider',       divider: true },
    // Badged with the OTHER hat's unread, because the tab badge beside it now
    // counts only this one. Without it, a message waiting on your host side is
    // invisible from here and you'd have to switch modes on a hunch.
    { key: 'switch-to-host', label: 'Switch to host', onClick: () => onSwitchMode(true), icon: MENU_ICON.switch, badge: unreadOtherMode },
    { key: 'logout',        label: 'Log out', danger: true, icon: MENU_ICON.logout, onClick: () => { signOut(); navigate('/') } },
  ]

  return (
    <>
      <div className="flex-1 flex justify-center min-w-0">
        <NavTabs tabs={tabs} />
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {/* An owner wears both hats, so they get the switch. Someone who has
            never listed is not switching between two things they have — they
            are being invited to start, and a CTA is the honest shape for that
            (operator decision, see .claude/architecture.md's Navigation Modes). */}
        {isOwner ? (
          <ModeSwitch hostMode={false} onSwitch={onSwitchMode} otherModeWaiting={unreadOtherMode} />
        ) : (
          <button
            onClick={() => onSwitchMode(true)}
            className="hidden sm:inline-flex items-center min-h-[40px] text-sm font-semibold text-slate-700 border border-slate-200 hover:border-slate-400 px-4 rounded-full transition-colors"
          >
            Become a host
          </button>
        )}
        {/* NotificationBell existed, complete with an unread badge and a live
            `notification:new` socket listener, and NOTHING rendered it — so
            real-time notifications arrived on web with no indicator anywhere,
            reachable only by opening a hamburger menu and knowing to look.
            Hidden below sm where the header is already tight; the hamburger
            still lists Notifications there. */}
        <div className="hidden sm:block shrink-0"><NotificationBell /></div>
        <ActionMenu trigger={<HamburgerIcon />} items={menuItems} />
        <Link to="/user?tab=settings" aria-label="Your account" className="shrink-0">
          <AvatarCircle user={profile} />
        </Link>
      </div>
    </>
  )
}

// ── Host mode — persistent, replaces the traveler nav everywhere ───────────
function HostActions({ unreadMessages, unreadOtherMode, onSwitchMode, profile }) {
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
    ...tabs.map((t) => ({ key: `tab-${t.key}`, label: t.label, to: t.to, icon: TAB_MENU_ICON[t.key] })),
    { key: 'divider-tabs', divider: true },
    { key: 'notifications',      label: 'Notifications',      to: '/user?tab=notifications', icon: MENU_ICON.notifications },
    { key: 'account',            label: 'Account',             to: '/user?tab=settings',      icon: MENU_ICON.account },
    { key: 'support',            label: 'Support',             to: '/user?tab=support',       icon: MENU_ICON.support },
    { key: 'divider',            divider: true },
    // See the matching note in TravelerActions: this badge is the renter-side
    // unread, which host mode's Inbox deliberately does not list.
    { key: 'switch-to-tenant',   label: 'Switch to tenant',    onClick: () => onSwitchMode(false), icon: MENU_ICON.switch, badge: unreadOtherMode },
    { key: 'logout',             label: 'Log out', danger: true, icon: MENU_ICON.logout, onClick: () => { signOut(); navigate('/') } },
  ]

  return (
    <>
      <div className="flex-1 flex justify-center min-w-0">
        <NavTabs tabs={tabs} />
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <ModeSwitch hostMode onSwitch={onSwitchMode} otherModeWaiting={unreadOtherMode} />
        {/* NotificationBell existed, complete with an unread badge and a live
            `notification:new` socket listener, and NOTHING rendered it — so
            real-time notifications arrived on web with no indicator anywhere,
            reachable only by opening a hamburger menu and knowing to look.
            Hidden below sm where the header is already tight; the hamburger
            still lists Notifications there. */}
        <div className="hidden sm:block shrink-0"><NotificationBell /></div>
        <ActionMenu trigger={<HamburgerIcon />} items={menuItems} />
        <Link to="/user?tab=settings" aria-label="Your account" className="shrink-0">
          <AvatarCircle user={profile} />
        </Link>
      </div>
    </>
  )
}

export default function Header() {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const hostMode = useUiStore((s) => s.hostMode)
  const setHostMode = useUiStore((s) => s.setHostMode)
  const openFilterModal = useUiStore((s) => s.openFilterModal)
  const mapFilterCount = useFilterStore((s) => countActiveFilters(s.filters))
  const isMapPage = pathname === '/' || pathname.startsWith('/properties')

  // Per HAT, not per account. ChatPanel shows host mode only the threads you
  // own and renter mode only the ones you started, so the whole-account total
  // badged "Inbox · 1" for a message sitting in a thread host mode does not
  // list — the badge pointed at an empty inbox and the message was reachable
  // only by guessing that you had to switch modes.
  //
  // No refetchInterval on either query: useRealtimeUpdates (mounted app-wide in
  // App.jsx) invalidates both keys off the socket events the backend already
  // emits to the personal room, and re-syncs on reconnect and window focus.
  const { data: unread } = useQuery({
    queryKey: ['chat-unread'],
    queryFn: () => chatService.unreadCount().then((r) => r.data),
    enabled: !!user,
  })
  // Notifications are per hat too, and the switch is the only place that can
  // say so — a visit request for your flat is invisible from renter mode, and
  // nothing else on screen would suggest looking.
  const { data: unreadNotifs } = useQuery({
    queryKey: ['notification-unread'],
    queryFn: () => notificationService.unread().then((r) => r.data),
    enabled: !!user,
  })

  const unreadMessages = (hostMode ? unread?.asOwner : unread?.asTenant) ?? 0
  // What is waiting in the mode you are NOT in — messages and notifications
  // together, because the switch answers one question: is there anything over
  // there?
  const unreadOtherMode =
    ((hostMode ? unread?.asTenant : unread?.asOwner) ?? 0) +
    ((hostMode ? unreadNotifs?.asTenant : unreadNotifs?.asOwner) ?? 0)

  const { data: profile } = useQuery({
    queryKey: ['me'],
    queryFn: () => authService.getMe().then((r) => r.data),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  })

  const isOwner = profile?.role === 'OWNER'

  // Switching hats moves you as little as it can. Messages, Appointments,
  // Notifications, Account and Support exist for both hats and show the same
  // page with the other side's data, so a switch there is a switch, not a
  // journey — being thrown onto the map from your own inbox is what made this
  // control read as broken.
  //
  // Everything else lands on that hat's home. `?tab=dashboard` MUST be one of
  // those: renter mode has no dashboard, and DashboardPage's own redirect sends
  // it to '/' — the mode flips while that tab is still mounted, so the two
  // navigate calls race and whichever fires last wins. They have to agree.
  function switchMode(next) {
    if (next === hostMode) return
    setHostMode(next)
    const tab = new URLSearchParams(search).get('tab')
    if (pathname === '/user' && SHARED_TABS.has(tab)) return
    navigate(next ? '/user?tab=dashboard' : '/')
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
      {/* One container for every mode (2026-07-27): guest/traveler used a
          centered max-w-7xl with wider padding while host ran edge-to-edge,
          so the wordmark and avatar jumped sideways on every mode switch and
          login. Full-width with the host paddings is now the shape for all. */}
      <div className="h-16 flex items-center justify-between gap-4 w-full px-4 sm:px-6 md:px-8">
        <Link to={user && hostMode ? '/user?tab=dashboard' : '/'} className="flex items-center gap-2 no-underline shrink-0">
          <span className="font-display font-bold text-lg sm:text-xl text-slate-900 tracking-tight">
            Stay<span className="text-brand-600">OnMap</span>
          </span>
        </Link>

        {!user ? (
          <GuestActions />
        ) : hostMode ? (
          <HostActions unreadMessages={unreadMessages} unreadOtherMode={unreadOtherMode} onSwitchMode={switchMode} profile={profile ?? user} />
        ) : (
          <TravelerActions unreadMessages={unreadMessages} unreadOtherMode={unreadOtherMode} onSwitchMode={switchMode} isOwner={isOwner} profile={profile ?? user} />
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
