import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  LayoutDashboard, MapPin, Building2, Heart, MessageCircle, Calendar, Bell,
  Settings, LifeBuoy, FileText, LogOut,
  ClipboardCheck, Users, TriangleAlert, Star, BarChart3, TrendingUp, ScrollText,
  ChevronsUpDown, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react'

const ICONS = {
  dashboard: LayoutDashboard,
  properties: MapPin,
  myListings: Building2,
  wishlist: Heart,
  messages: MessageCircle,
  appointments: Calendar,
  notifications: Bell,
  settings: Settings,
  support: LifeBuoy,
  leases: FileText,
  logout: LogOut,
  // Admin-specific
  overview: LayoutDashboard,
  queue: ClipboardCheck,
  users: Users,
  reports: TriangleAlert,
  reviews: Star,
  monitor: BarChart3,
  supply: TrendingUp,
  activity: ScrollText,
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
  { id: 'supply',          label: 'Supply',           icon: 'supply' },
  { id: 'admin-properties',label: 'All Properties',   icon: 'properties' },
  { id: 'review-listings', label: 'Review Listings',  icon: 'queue' },
  { id: 'users',           label: 'Users',            icon: 'users' },
  { id: 'waitlist',        label: 'Waitlist',         icon: 'users' },
  { id: 'support',         label: 'Support',          icon: 'support' },
  { id: 'reports',         label: 'Reports',          icon: 'reports' },
  { id: 'reviews',         label: 'Reviews',          icon: 'reviews' },
  { id: 'verifications',   label: 'Verifications',    icon: 'queue' },
  { id: 'monitor',         label: 'System Monitor',   icon: 'monitor' },
  { id: 'activity',        label: 'Activity Log',     icon: 'activity' },
]

// `help-center` was here until 2026-08-10 with no case in AdminPage's switch —
// clicking it highlighted Help Center and rendered Overview. Removed rather
// than stubbed: never draw a control that does nothing.
const ADMIN_BOTTOM_NAV = [
  { id: 'settings', label: 'Settings', icon: 'settings' },
]

const USER_BOTTOM_NAV = [
  { id: 'settings', label: 'Settings', icon: 'settings' },
  { id: 'support',  label: 'Support',  icon: 'support' },
]

const STORAGE_KEY = 'staynear:sidebar-collapsed'

function NavIcon({ d: IconComp, size = 18 }) {
  return <IconComp width={size} height={size} strokeWidth={1.8} className="shrink-0" />
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
      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{text}</p>
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
        className="min-h-[44px] w-full flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-slate-50 transition-colors"
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
          <p className="text-[11px] text-slate-500 truncate">{subtitle}</p>
        </div>
        <ChevronsUpDown size={14} color="#94a3b8" strokeWidth={2} className="shrink-0" />
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
        <Link to="/admin" className="no-underline flex items-center gap-2.5">
          {!collapsed && (
            <span className="font-display font-bold text-lg text-slate-900 tracking-tight">
              Stay<span className="text-brand-600">OnMap</span>
            </span>
          )}
        </Link>
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors text-slate-500 hover:text-slate-600"
            title="Collapse sidebar"
          >
            <PanelLeftClose size={14} strokeWidth={2} />
          </button>
        )}
      </div>

      {/* Expand button (collapsed only) */}
      {collapsed && (
        <div className="flex justify-center pb-2">
          <button
            onClick={() => setCollapsed(false)}
            className="w-7 h-7 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors text-slate-500 hover:text-slate-600"
            title="Expand sidebar"
          >
            <PanelLeftOpen size={14} strokeWidth={2} />
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
