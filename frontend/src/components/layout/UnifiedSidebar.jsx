import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

const ICONS = {
  dashboard:     'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  properties:    'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z M15 10a3 3 0 11-6 0 3 3 0 016 0z',
  myListings:    'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  wishlist:      'M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z',
  messages:      'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
  appointments:  'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  notifications: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
  settings:      'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
  support:       'M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z',
  leases:        'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  logout:        'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1',
  helpCircle:    'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zm0-6v.01M12 12a2 2 0 10-1-3.75',
  // Admin-specific
  overview:      'M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z',
  queue:         'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  users:         'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  reports:       'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  reviews:       'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z',
  monitor:       'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
}

const USER_NAV = [
  { id: 'dashboard',     label: 'Dashboard',     icon: 'dashboard' },
  { id: 'properties',    label: 'Properties',    icon: 'properties' },
  { id: 'my-listings',   label: 'My Listings',   icon: 'myListings' },
  { id: 'appointments',  label: 'Appointments',  icon: 'appointments' },
  { id: 'leases',        label: 'Leases',        icon: 'leases' },
  { id: 'wishlist',      label: 'Wishlist',      icon: 'wishlist' },
  { id: 'messages',      label: 'Messages',      icon: 'messages' },
  { id: 'notifications', label: 'Notifications', icon: 'notifications' },
]

const ADMIN_NAV = [
  { id: 'overview',        label: 'Dashboard',       icon: 'overview' },
  { id: 'admin-properties',label: 'All Properties',   icon: 'properties' },
  { id: 'review-listings', label: 'Review Listings',  icon: 'queue' },
  { id: 'users',           label: 'Users',            icon: 'users' },
  { id: 'reports',         label: 'Reports',          icon: 'reports' },
  { id: 'reviews',         label: 'Reviews',          icon: 'reviews' },
  { id: 'monitor',         label: 'System Monitor',   icon: 'monitor' },
]

const ADMIN_BOTTOM_NAV = [
  { id: 'help-center', label: 'Help Center', icon: 'helpCircle' },
  { id: 'settings',    label: 'Settings',    icon: 'settings' },
]

const USER_BOTTOM_NAV = [
  { id: 'settings', label: 'Settings', icon: 'settings' },
  { id: 'support',  label: 'Support',  icon: 'support' },
]

const STORAGE_KEY = 'staynear:sidebar-collapsed'

function NavIcon({ d, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className="shrink-0"
    >
      <path d={d} />
    </svg>
  )
}

function NavItem({ id, label, icon, active, collapsed, onClick, badge }) {
  const isActive = active === id
  return (
    <button
      onClick={() => onClick(id)}
      title={collapsed ? label : undefined}
      className={[
        'w-full flex items-center gap-3 text-sm font-medium transition-all duration-200 text-left group',
        collapsed ? 'justify-center py-2.5 border-l-2' : 'px-5 py-2.5 border-l-2',
        isActive
          ? 'border-[#111111] bg-[#111111] text-white'
          : 'border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-800',
      ].join(' ')}
    >
      <div className="relative shrink-0">
        <NavIcon d={ICONS[icon]} size={collapsed ? 20 : 18} />
        {badge > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[11px] font-bold text-white bg-red-500 rounded-full">
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </div>
      {!collapsed && <span className="truncate flex-1">{label}</span>}
      {!collapsed && badge > 0 && (
        <span className={`shrink-0 min-w-[20px] h-5 px-1 flex items-center justify-center text-[11px] font-bold rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-red-100 text-red-600'}`}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  )
}

function SectionLabel({ text, collapsed }) {
  if (collapsed) return <div className="my-1 mx-4 border-t border-slate-200" />
  return (
    <div className="px-5 pt-4 pb-1">
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{text}</p>
    </div>
  )
}

/* ── Profile card at sidebar bottom (works for both admin and user) ── */
function ProfileCard({ collapsed, onLogout, userName, userEmail, avatarUrl }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const ref = useRef(null)

  const displayName = userName || userEmail?.split('@')[0] || 'User'
  const initial = displayName[0]?.toUpperCase() || 'U'
  const subtitle = userEmail || 'Member'

  useEffect(() => {
    if (!menuOpen) return
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) setMenuOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  if (collapsed) {
    return (
      <div className="flex justify-center py-3">
        <button
          onClick={() => setMenuOpen(v => !v)}
          title={displayName}
          className="relative"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-[#111111] text-white text-sm font-bold flex items-center justify-center hover:bg-[#2a2a2a] transition-colors">
              {initial}
            </div>
          )}
        </button>
        {menuOpen && (
          <div ref={ref} className="absolute bottom-14 left-1/2 -translate-x-1/2 w-40 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50">
            <div className="px-3 py-2 border-b border-slate-100">
              <p className="text-xs font-semibold text-slate-700 truncate">{displayName}</p>
            </div>
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
            >
              <NavIcon d={ICONS.logout} size={14} />
              Log out
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="relative px-4 py-3" ref={ref}>
      <button
        onClick={() => setMenuOpen(v => !v)}
        className="w-full flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-slate-50 transition-colors"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-[#111111] text-white text-sm font-bold flex items-center justify-center shrink-0">
            {initial}
          </div>
        )}
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-semibold text-slate-800 truncate">{displayName}</p>
          <p className="text-[11px] text-slate-400 truncate">{subtitle}</p>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <path d="M7 10l5-5 5 5M7 14l5 5 5-5" />
        </svg>
      </button>

      {menuOpen && (
        <div className="absolute bottom-full left-4 right-4 mb-1 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
          >
            <NavIcon d={ICONS.logout} size={15} />
            Log out
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * @param {{
 *   active: string,
 *   onChange: (id: string) => void,
 *   isAdmin?: boolean,
 *   onLogout?: () => void,
 *   userName?: string,
 *   userEmail?: string,
 *   avatarUrl?: string,
 *   notificationSlot?: React.ReactNode,
 *   badges?: Record<string, number>,
 * }} props
 */
export default function UnifiedSidebar({ active, onChange, isAdmin = false, onLogout, userName, userEmail, avatarUrl, notificationSlot, badges = {} }) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true' } catch { return false }
  })

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(collapsed)) } catch (_) { /* noop */ }
  }, [collapsed])

  return (
    <aside
      className={`hidden md:flex shrink-0 bg-white border-r border-slate-200 flex-col transition-all duration-300 ${
        collapsed ? 'w-[68px]' : 'w-[240px]'
      }`}
      style={{ background: '#fafaf8' }}
    >
      {/* Brand */}
      <div className={`shrink-0 px-5 pt-5 pb-2 flex items-center ${collapsed ? 'justify-center px-0' : 'justify-between'}`}>
        <Link to="/dashboard" className="no-underline flex items-center gap-2.5">
          {!collapsed && (
            <span className="font-display font-bold text-lg text-slate-900 tracking-tight">
              Stay<span className="text-brand-600">OnMap</span>
            </span>
          )}
        </Link>
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors text-slate-400 hover:text-slate-600"
            title="Collapse sidebar"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 3v18" />
              <path d="M16 15l-3-3 3-3" />
            </svg>
          </button>
        )}
      </div>

      {/* Expand button (collapsed only) */}
      {collapsed && (
        <div className="flex justify-center pb-2">
          <button
            onClick={() => setCollapsed(false)}
            className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors text-slate-400 hover:text-slate-600"
            title="Expand sidebar"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 3v18" />
              <path d="M14 9l3 3-3 3" />
            </svg>
          </button>
        </div>
      )}

      {/* Navigation */}
      {isAdmin ? (
        <>
          <SectionLabel text="Main" collapsed={collapsed} />
          <nav className="space-y-0">
            {ADMIN_NAV.map(item => (
              <NavItem key={item.id} {...item} active={active} collapsed={collapsed} onClick={onChange} badge={badges[item.id]} />
            ))}
          </nav>
        </>
      ) : (
        <>
          <SectionLabel text="Menu" collapsed={collapsed} />
          <nav className="space-y-0">
            {USER_NAV.map(item => (
              <NavItem key={item.id} {...item} active={active} collapsed={collapsed} onClick={onChange} badge={badges[item.id]} />
            ))}
          </nav>
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom nav */}
      <div className="border-t border-slate-200">
        <nav className="shrink-0 space-y-0 py-2">
          {(isAdmin ? ADMIN_BOTTOM_NAV : USER_BOTTOM_NAV).map(item => (
            <NavItem key={item.id} {...item} active={active} collapsed={collapsed} onClick={onChange} badge={badges[item.id]} />
          ))}
        </nav>
      </div>

      {/* Notification bell slot (user only) */}
      {notificationSlot && (
        <div className={`border-t border-slate-200 ${collapsed ? 'flex justify-center py-2' : 'px-5 py-2'}`}>
          {notificationSlot}
        </div>
      )}

      {/* Profile card */}
      {onLogout && (
        <div className="border-t border-slate-200">
          <ProfileCard
            collapsed={collapsed}
            onLogout={onLogout}
            userName={userName}
            userEmail={userEmail}
            avatarUrl={avatarUrl}
          />
        </div>
      )}
    </aside>
  )
}
