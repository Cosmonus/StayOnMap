import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Check } from 'lucide-react'
import { useAuth } from '@features/auth/hooks/useAuth'
import SEOMeta from '@components/common/SEOMeta'
import { propertyService } from '@services/property.service'
import { authService } from '@services/auth.service'
import { notificationService } from '@services/notification.service'
import { appointmentService } from '@services/appointment.service'
import { leaseService } from '@services/lease.service'
import { formatRent } from '@utils/format'
import { formatTime } from '@utils/time'
import Modal from '@components/common/Modal'
import NotificationCenter from '@features/notifications/components/NotificationCenter'
import ChatPanel from '@features/chat/components/ChatPanel'
import HostDashboard from '@features/host/components/HostDashboard'
import SavedHomes from '@features/wishlist/components/SavedHomes'
import { useUiStore } from '@store/uiStore'
import MapView from '@features/map/components/MapView'
import MapRightPanel from '@features/map/components/MapRightPanel'

import AppointmentManager from '@features/appointments/components/AppointmentManager'
import LeaseManager from '@features/leases/components/LeaseManager'
import SettingsPanel from '@features/settings/components/SettingsPanel'
import PointsCard from '@features/points/components/PointsCard'

// ── Section: Overview ──────────────────────────────────────────────────────
function OverviewSection({ listings, isOwner, onListProperty }) {
  const stats = isOwner
    ? [
        { label: 'My listings',    value: listings.length,                                       color: 'text-slate-800' },
        { label: 'Active',         value: listings.filter(l => l.status === 'ACTIVE').length,   color: 'text-slate-800' },
        { label: 'Pending review', value: listings.filter(l => l.status === 'PENDING').length,  color: 'text-slate-500' },
        { label: 'Drafts',         value: listings.filter(l => l.status === 'DRAFT').length,    color: 'text-slate-500' },
      ]
    : [
        { label: 'Listings',  value: '0',      color: 'text-slate-500' },
        { label: 'Role',      value: 'Tenant', color: 'text-slate-500' },
        { label: 'Visits',    value: '—',      color: 'text-slate-500' },
      ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">Welcome back — here&apos;s your overview.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 p-5">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">{label}</p>
            <p className={`text-3xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <PointsCard />

      <div>
        <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Quick actions</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={onListProperty}
            className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 hover:border-slate-300 transition-all text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-[#111111] flex items-center justify-center shrink-0">
              <Plus size={18} strokeWidth={1.8} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">List a property</p>
              <p className="text-xs text-slate-500">Add a new rental to StayOnMap</p>
            </div>
          </button>
          <Link
            to="?tab=properties"
            className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-100 hover:border-slate-300 transition-all no-underline"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 text-slate-600">
              <Check size={18} strokeWidth={1.8} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Browse properties</p>
              <p className="text-xs text-slate-500">Explore rentals on the map</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}

// ── Section: Placeholder ───────────────────────────────────────────────────
// Support was a ComingSoon stub: an icon, a heading, one sentence, and no way
// to reach anybody — on a platform that asks people to hand a deposit to a
// stranger. Everything here already existed somewhere else in the product; the
// only thing missing was a route to it from the menu item called Support.
const SUPPORT_EMAIL = 'hello@cosmonus.com'

const SUPPORT_ROUTES = [
  {
    key: 'listing',
    title: 'Something wrong with a listing',
    body: 'Wrong price, fake photos, a broker posing as an owner — report it from the listing page and our trust team reviews it. Reports are acted on, not queued.',
    action: { label: 'Browse listings', to: '/properties' },
  },
  {
    key: 'visit',
    title: 'A visit or a message',
    body: 'Visit requests and every conversation with an owner live in your account. You can cancel a visit you no longer want from the same place you requested it.',
    action: { label: 'Your appointments', to: '/user?tab=appointments' },
  },
  {
    key: 'account',
    title: 'Your account, privacy or devices',
    body: 'Change what other people can see, review the devices you are signed in on, reset your password, or delete the account outright.',
    action: { label: 'Account settings', to: '/user?tab=settings' },
  },
  {
    key: 'rules',
    title: 'How StayOnMap works',
    body: 'What we verify before a listing goes on the map, how the scores are calculated, and what we refuse to guess at.',
    action: { label: 'Read the rules', to: '/rules' },
  },
]

function SupportSection() {
  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Help &amp; Support</h1>
        <p className="text-sm text-slate-600 mt-1">
          A real person reads {SUPPORT_EMAIL} — usually the same day. Start with whichever of these fits.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {SUPPORT_ROUTES.map((r) => (
          <div key={r.key} className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col">
            <h2 className="text-sm font-bold text-slate-900">{r.title}</h2>
            <p className="text-sm text-slate-600 mt-1.5 leading-relaxed flex-1">{r.body}</p>
            <Link
              to={r.action.to}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 no-underline hover:underline underline-offset-4"
            >
              {r.action.label} →
            </Link>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="text-sm font-bold text-slate-900">Still stuck?</h2>
        <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">
          Email us with the listing link or the name of the person you were dealing with — that is almost
          always what we need to sort it out in one reply.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="inline-flex min-h-[44px] items-center px-5 text-sm font-semibold text-white bg-[#111111] hover:bg-[#2a2a2a] rounded-xl no-underline transition-colors"
          >
            Email {SUPPORT_EMAIL}
          </a>
          <Link
            to="/contact"
            className="inline-flex min-h-[44px] items-center px-5 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl no-underline transition-colors"
          >
            Use the contact form
          </Link>
        </div>
      </div>
    </div>
  )
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function dateKey(d) {
  const dt = new Date(d)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

const EVENT_TYPE_LABEL = { appointment: 'Visit request', 'lease-start': 'Lease starts', 'lease-end': 'Lease ends' }

function CalendarSection() {
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [selectedKey, setSelectedKey] = useState(null)

  const { data: appointments = [] } = useQuery({
    queryKey: ['owner-appointments'],
    queryFn: () => appointmentService.owner().then(r => r.data),
  })

  const { data: leaseData } = useQuery({
    queryKey: ['leases'],
    queryFn: () => leaseService.getMyLeases().then(r => r.data),
  })
  const leases = leaseData?.asOwner ?? []

  const events = new Map()
  function addEvent(rawDate, entry) {
    if (!rawDate) return
    const key = dateKey(rawDate)
    if (!events.has(key)) events.set(key, [])
    events.get(key).push(entry)
  }
  appointments.forEach(a => addEvent(a.requestedDate, {
    type: 'appointment',
    label: a.property?.title ?? 'Visit',
    person: a.tenant?.name,
    detail: formatTime(a.requestedTime),
  }))
  leases.forEach(l => {
    addEvent(l.startDate, { type: 'lease-start', label: l.property?.title ?? 'Lease starts', person: l.tenant?.name, detail: formatRent(l.rentAmount) })
    addEvent(l.endDate, { type: 'lease-end', label: l.property?.title ?? 'Lease ends', person: l.tenant?.name, detail: formatRent(l.rentAmount) })
  })

  const total = daysInMonth(cursor.year, cursor.month)
  const firstWeekday = new Date(cursor.year, cursor.month, 1).getDay()
  const cells = Array.from({ length: firstWeekday }, () => null).concat(
    Array.from({ length: total }, (_, i) => i + 1)
  )
  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const DOT_COLOR = { appointment: 'bg-amber-400', 'lease-start': 'bg-green-500', 'lease-end': 'bg-slate-400' }

  const selectedEvents = selectedKey ? (events.get(selectedKey) ?? []) : []
  const selectedLabel = selectedKey
    ? new Date(`${selectedKey}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : ''

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Calendar</h1>
        <p className="text-sm text-slate-500 mt-0.5">Upcoming appointments and lease dates</p>
      </div>

      <div className="bg-white border border-slate-100 rounded-2xl p-5 max-w-md">
        <div className="flex items-center justify-between mb-4">
          <button type="button" onClick={() => setCursor(c => c.month === 0 ? { year: c.year - 1, month: 11 } : { ...c, month: c.month - 1 })} className="text-slate-500 hover:text-slate-700 px-2">‹</button>
          <p className="text-sm font-bold text-slate-900">{monthLabel}</p>
          <button type="button" onClick={() => setCursor(c => c.month === 11 ? { year: c.year + 1, month: 0 } : { ...c, month: c.month + 1 })} className="text-slate-500 hover:text-slate-700 px-2">›</button>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <div key={i} className="text-center text-[11px] font-semibold text-slate-500 py-1">{d}</div>
          ))}
          {cells.map((day, i) => {
            if (!day) return <div key={i} />
            const key = `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const dayEvents = events.get(key) ?? []
            return (
              <button
                key={i}
                type="button"
                onClick={() => setSelectedKey(key)}
                aria-label={`${key}${dayEvents.length ? `, ${dayEvents.length} booking${dayEvents.length > 1 ? 's' : ''}` : ''}`}
                className="aspect-square flex flex-col items-center justify-center gap-0.5 rounded-lg hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <span className="text-xs font-mono text-slate-700">{day}</span>
                {dayEvents.length > 0 && (
                  <div className="flex gap-0.5">
                    {dayEvents.slice(0, 3).map((e, idx) => (
                      <span key={idx} className={`w-1.5 h-1.5 rounded-full ${DOT_COLOR[e.type]}`} />
                    ))}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" /> Appointment</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500" /> Lease starts</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-400" /> Lease ends</span>
      </div>

      <Modal isOpen={!!selectedKey} onClose={() => setSelectedKey(null)} title={selectedLabel} size="sm">
        {selectedEvents.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">No bookings on this date.</p>
        ) : (
          <div className="space-y-3">
            {selectedEvents.map((e, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 rounded-xl border border-slate-100">
                <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${DOT_COLOR[e.type]}`} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{e.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {EVENT_TYPE_LABEL[e.type]}{e.person ? ` · ${e.person}` : ''}{e.detail ? ` · ${e.detail}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const section = searchParams.get('tab') ?? 'dashboard'
  // Subscribe to the single field, not the store — see .claude/frontend.md.
  const hostMode = useUiStore((st) => st.hostMode)
  const setHostMode = useUiStore((st) => st.setHostMode)
  const qc = useQueryClient()

  // `?mode=` comes from a push notification's click URL, which the service
  // worker opens (push.service.js sets it from the notification's audience).
  // Notifications are per hat now, so landing in the wrong mode means landing
  // on a list that deliberately excludes the very thing you tapped. Read once
  // and dropped from the URL so a later manual mode switch isn't undone by a
  // refresh.
  const mode = searchParams.get('mode')
  useEffect(() => {
    if (mode !== 'host' && mode !== 'tenant') return
    const wants = mode === 'host'
    if (wants !== hostMode) setHostMode(wants)
    const next = new URLSearchParams(searchParams)
    next.delete('mode')
    navigate({ search: next.toString() }, { replace: true })
  }, [mode, hostMode, setHostMode, searchParams, navigate])

  useEffect(() => {
    if (section !== 'messages') return
    qc.invalidateQueries({ queryKey: ['chat-unread'] })
    // Only THIS hat's message notifications: the inbox you just opened shows
    // one side's threads, so it can't have caught you up on the other's.
    notificationService.markAllByType('MESSAGE', hostMode ? 'OWNER' : 'TENANT').then(() => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
    }).catch(() => {})
  }, [section, qc, hostMode])

  const { data: profile } = useQuery({
    queryKey: ['me'],
    queryFn: () => authService.getMe().then(r => r.data),
    enabled: !!user,
    staleTime: 0,
  })
  const isOwner = profile?.role === 'OWNER'

  const { data: listings = [] } = useQuery({
    queryKey: ['my-listings'],
    queryFn: () => propertyService.getMyListings().then(r => r.data),
    enabled: !!user,
  })

  const isFullBleed = section === 'properties' || section === 'messages'

  function renderSection() {
    switch (section) {
      case 'dashboard':
        // Host mode asks a different question than renter mode: "is anyone
        // waiting on me?" rather than "what have I saved?". Same tab, two
        // surfaces — the mode toggle is what chooses (see .claude/architecture.md).
        return hostMode && isOwner
          ? <HostDashboard onAddListing={() => navigate('/list?new=1')} />
          : <OverviewSection listings={listings} isOwner={isOwner} onListProperty={() => navigate('/list?new=1')} />
      case 'properties':
        return (
          <div className="relative w-full h-full overflow-hidden">
            <MapView contained />
            <MapRightPanel topClass="top-16" />
          </div>
        )
      case 'appointments':
        return <AppointmentManager />
      case 'leases':
        return <LeaseManager />
      case 'calendar':
        return <CalendarSection />
      case 'wishlist':
        return <SavedHomes />
      case 'messages':
        return <ChatPanel />
      case 'notifications':
        return <NotificationCenter />
      case 'settings':
        return <SettingsPanel />
      case 'support':
        return <SupportSection />
      default:
        return null
    }
  }

  return (
    // h-dvh, not h-screen. `100vh` on a phone is the LARGE viewport — it does
    // not shrink for the browser's URL bar and does not move for the keyboard —
    // so the bottom of this column (the chat input) sat under the browser
    // chrome, and with the keyboard open it was off-screen entirely. index.css
    // already uses 100dvh on the body for the same reason.
    <div className="flex flex-col h-dvh bg-slate-50 pt-16">
      <SEOMeta title="Dashboard" noindex />
      <main className={`flex-1 overflow-hidden ${isFullBleed ? '' : 'px-4 md:px-8 py-4 md:py-8 overflow-y-auto'}`}>
        {renderSection()}
      </main>
    </div>
  )
}
