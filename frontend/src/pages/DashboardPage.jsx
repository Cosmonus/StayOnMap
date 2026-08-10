import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@features/auth/hooks/useAuth'
import SEOMeta from '@components/common/SEOMeta'
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
import SupportCenter from '@features/support/components/SupportCenter'


function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function dateKey(d) {
  const dt = new Date(d)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

const EVENT_TYPE_LABEL = { appointment: 'Visit request', 'lease-start': 'Lease starts', 'lease-end': 'Lease ends' }

// Both endpoints return EVERY status — `getOwnerAppointments` and `GET /leases`
// filter by nothing. Plotting all of them puts dates on the calendar that are
// never going to happen: a visit the host already rejected, or a lease offer
// the renter turned down, sat there looking exactly like a live booking.
// Mirrored in mobile/src/features/host/screens/CalendarScreen.js — keep in sync.
const LIVE_APPOINTMENT = new Set(['PENDING', 'ACCEPTED', 'RESCHEDULED', 'RESCHEDULE_REQUESTED'])
// OFFERED/ACTIVE are ahead of you and EXPIRED ran its course, so its dates are
// accurate history. REJECTED never became a tenancy at all, and a TERMINATED
// one ended on `terminatedAt` — the `endDate` still on the row is the date it
// was *going* to end, which is the one date it definitely did not.
const LIVE_LEASE = new Set(['OFFERED', 'ACTIVE', 'EXPIRED'])

function CalendarSection() {
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  })
  const [selectedKey, setSelectedKey] = useState(null)

  const {
    data: appointments = [], isLoading: loadingAppts, isError: apptFailed, refetch: refetchAppts,
  } = useQuery({
    queryKey: ['owner-appointments'],
    queryFn: () => appointmentService.owner().then(r => r.data),
  })

  const {
    data: leaseData, isLoading: loadingLeases, isError: leasesFailed, refetch: refetchLeases,
  } = useQuery({
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
  appointments.filter(a => LIVE_APPOINTMENT.has(a.status)).forEach(a => addEvent(a.requestedDate, {
    type: 'appointment',
    label: a.property?.title ?? 'Visit',
    person: a.tenant?.name,
    detail: formatTime(a.requestedTime),
  }))
  leases.filter(l => LIVE_LEASE.has(l.status)).forEach(l => {
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

  const heading = (
    <div>
      <h1 className="text-xl font-bold text-slate-900">Calendar</h1>
      <p className="text-sm text-slate-500 mt-0.5">Upcoming appointments and lease dates</p>
    </div>
  )

  // Both queries default to an empty list, so a dropped connection or an
  // expired session rendered a normal-looking month with no bookings in it —
  // the host cannot tell "nothing scheduled" from "we never loaded it".
  if (apptFailed || leasesFailed) {
    return (
      <div className="space-y-5">
        {heading}
        <div className="text-center py-16">
          <p className="text-sm text-slate-600">We couldn&apos;t load your calendar.</p>
          <button
            onClick={() => { refetchAppts(); refetchLeases() }}
            className="min-h-[44px] mt-3 px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:border-slate-400"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (loadingAppts || loadingLeases) {
    return (
      <div className="space-y-5">
        {heading}
        <div className="h-[360px] max-w-md rounded-2xl bg-slate-100 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {heading}

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
      // The mode-switch badge reads its own count (Header's ['notification-unread'],
      // 60s poll) — without this it kept advertising messages in the hat you had
      // just cleared for the better part of a minute.
      qc.invalidateQueries({ queryKey: ['notification-unread'] })
    }).catch(() => {})
  }, [section, qc, hostMode])

  const { data: profile } = useQuery({
    queryKey: ['me'],
    queryFn: () => authService.getMe().then(r => r.data),
    enabled: !!user,
    staleTime: 0,
  })
  const isOwner = profile?.role === 'OWNER'

  // The renter-mode overview was DELETED 2026-07-27 — it was a second, staler
  // dashboard (static "Role: Tenant" tiles) living beside HostDashboard, and
  // platform metrics belong to the admin panel, not a user. Where ?tab=dashboard
  // goes instead depends on why you're here: a tenant who clicked "Become a
  // host" (hostMode on, no OWNER role yet — Header sends them to this URL)
  // belongs in the host intro at /list; renter mode goes to the MAP — the
  // renter's first page. The map, not the wishlist: "Exit hosting" flips the
  // mode while this tab is still mounted, so this effect races the header's
  // own navigate('/') — the two must agree on the destination or whichever
  // fires last wins (this one sent people to the wishlist until 2026-07-27).
  // Waits for the profile so a host-mode owner isn't bounced while their role
  // is still loading.
  useEffect(() => {
    if (section !== 'dashboard' || !profile) return
    if (hostMode && isOwner) return
    navigate(hostMode ? '/list' : '/', { replace: true })
  }, [section, profile, hostMode, isOwner, navigate])

  const isFullBleed = section === 'properties' || section === 'messages'

  function renderSection() {
    switch (section) {
      case 'dashboard':
        // Host mode only — the renter side has no dashboard (see the redirect
        // above). Null while the profile loads or the redirect is in flight.
        return hostMode && isOwner
          ? <HostDashboard onAddListing={() => navigate('/list?new=1')} />
          : null
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
        // SupportCenter, not the static SupportSection above it. That screen
        // was a list of links and a mailto: it could route somebody to the
        // right page but could not TAKE a request, so anything it did not
        // cover fell out of the product into an email nobody could track. A
        // case is answerable, and both sides can see it.
        return <SupportCenter />
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
