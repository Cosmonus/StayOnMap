import { useState, useEffect } from 'react'

// ── Icons ───────────────────────────────────────────────────────────────────
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
}

const NAV_MAIN = [
  { id: 'dashboard',     label: 'Dashboard',     icon: 'dashboard' },
  { id: 'properties',    label: 'Properties',    icon: 'properties' },
  { id: 'my-listings',   label: 'My Listings',   icon: 'myListings' },
  { id: 'appointments',  label: 'Appointments',  icon: 'appointments' },
  { id: 'wishlist',      label: 'Wishlist',      icon: 'wishlist' },
  { id: 'messages',      label: 'Messages',      icon: 'messages' },
  { id: 'notifications', label: 'Notifications', icon: 'notifications' },
]

const NAV_BOTTOM = [
  { id: 'settings',      label: 'Settings',      icon: 'settings' },
  { id: 'support',       label: 'Support',       icon: 'support' },
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

function NavItem({ id, label, icon, active, collapsed, onClick }) {
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
          : 'border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800',
      ].join(' ')}
    >
      <NavIcon d={ICONS[icon]} size={collapsed ? 20 : 18} />
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  )
}

export default function DashboardSidebar({ active, onChange }) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true' } catch { return false }
  })

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(collapsed)) } catch { /* noop */ }
  }, [collapsed])

  return (
    <aside
      className={`hidden md:flex shrink-0 bg-white border-r border-slate-200 flex-col transition-all duration-300 ${
        collapsed ? 'w-[68px]' : 'w-[220px]'
      }`}
    >
      {/* Toggle button */}
      <div className={`shrink-0 px-3 pt-4 pb-2 ${collapsed ? 'flex justify-center' : 'flex justify-end'}`}>
        <button
          onClick={() => setCollapsed(v => !v)}
          className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors text-slate-400 hover:text-slate-600"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {collapsed ? (
              <>
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 3v18" />
                <path d="M14 9l3 3-3 3" />
              </>
            ) : (
              <>
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 3v18" />
                <path d="M16 15l-3-3 3-3" />
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Section label */}
      {!collapsed && (
        <div className="px-5 pt-1 pb-1">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Menu</p>
        </div>
      )}

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto space-y-0">
        {NAV_MAIN.map(item => (
          <NavItem key={item.id} {...item} active={active} collapsed={collapsed} onClick={onChange} />
        ))}
      </nav>

      {/* Divider */}
      <div className="border-t border-slate-100" />

      {/* Bottom nav */}
      <nav className="shrink-0 space-y-0 py-3">
        {!collapsed && (
          <div className="px-5 pb-1">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">General</p>
          </div>
        )}
        {NAV_BOTTOM.map(item => (
          <NavItem key={item.id} {...item} active={active} collapsed={collapsed} onClick={onChange} />
        ))}
      </nav>
    </aside>
  )
}
