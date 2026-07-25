import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Check, Heart, Navigation, ArrowRight, Phone, Lock, LifeBuoy } from 'lucide-react'
import { useAuth } from '@features/auth/hooks/useAuth'
import SEOMeta from '@components/common/SEOMeta'
import { propertyService } from '@services/property.service'
import { authService } from '@services/auth.service'
import { savedService } from '@services/saved.service'
import { notificationService } from '@services/notification.service'
import { appointmentService } from '@services/appointment.service'
import { leaseService } from '@services/lease.service'
import { AmenityIcon } from '@components/common/AmenityIcon'
import { formatRent, formatCurrency } from '@utils/format'
import Modal from '@components/common/Modal'
import NotificationCenter from '@features/notifications/components/NotificationCenter'
import ChatPanel from '@features/chat/components/ChatPanel'
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
function ComingSoon({ icon: IconComp, title, description }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500 mb-4">
        <IconComp size={24} strokeWidth={1.8} />
      </div>
      <h2 className="text-lg font-bold text-slate-800 mb-1">{title}</h2>
      <p className="text-sm text-slate-500 max-w-xs">{description}</p>
    </div>
  )
}

// ── Section: Wishlist ─────────────────────────────────────────────────────
function WishlistSection() {
  const { data: saved = [], isLoading } = useQuery({
    queryKey: ['saved'],
    queryFn: () => savedService.getMySaved().then(r => r.data),
  })

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Wishlist</h1>
          <p className="text-sm text-slate-500 mt-0.5">Properties you&apos;ve saved</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="bg-slate-100 animate-pulse rounded-xl h-64" />)}
        </div>
      </div>
    )
  }

  if (!saved.length) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500 mb-4">
          <Heart size={24} strokeWidth={1.8} />
        </div>
        <h2 className="text-lg font-bold text-slate-800 mb-1">No saved properties</h2>
        <p className="text-sm text-slate-500 max-w-xs">
          Tap the heart on any listing to save it here for later.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Wishlist</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {saved.length} saved {saved.length === 1 ? 'property' : 'properties'}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {saved.map(({ property }) => (
          <WishlistCard key={property.id} property={property} />
        ))}
      </div>
    </div>
  )
}

function WishlistStars({ score }) {
  const clamped = Math.max(0, Math.min(5, score ?? 0))
  return (
    <div className="flex gap-0.5 items-center">
      {Array.from({ length: 5 }).map((_, i) => {
        const filled = clamped >= i + 1
        const half   = !filled && clamped >= i + 0.5
        const id     = `ws-${i}`
        return (
          <svg key={i} width="14" height="14" viewBox="0 0 24 24">
            {half && (
              <defs>
                <linearGradient id={id} x1="0" x2="1" y1="0" y2="0">
                  <stop offset="50%" stopColor="#f59e0b"/>
                  <stop offset="50%" stopColor="#e2e8f0"/>
                </linearGradient>
              </defs>
            )}
            <path
              fill={half ? `url(#${id})` : filled ? '#f59e0b' : '#e2e8f0'}
              d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            />
          </svg>
        )
      })}
    </div>
  )
}

function WishlistCard({ property }) {
  const qc = useQueryClient()

  const unsave = useMutation({
    mutationFn: () => savedService.unsave(property.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved'] }),
  })

  const bhkLabel = property.type === 'PG'
    ? `${property.sharing}-Sharing PG`
    : property.bhk ? `${property.bhk} BHK` : null

  const furnished = property.furnished
    ? property.furnished.charAt(0) + property.furnished.slice(1).toLowerCase().replace('_', ' ')
    : null

  const typeLabel = property.type
    ? property.type.replace(/_/g, ' ').charAt(0) + property.type.replace(/_/g, ' ').slice(1).toLowerCase()
    : null

  const score       = Number(property.trustScore?.overallScore ?? 0)
  const reviewCount = property.trustScore?.totalReviews ?? 0

  const directionsUrl = property.lat && property.lng
    ? `https://www.google.com/maps/dir/?api=1&destination=${property.lat},${property.lng}`
    : property.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([property.address, property.city].filter(Boolean).join(', '))}`
    : null

  return (
    <div
      className="w-full bg-white rounded-2xl overflow-hidden border border-slate-100"
      style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)' }}
    >
      {/* ── Header ── */}
      <div className="flex items-start gap-2 px-4 pt-4 pb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">
            {property.title}
          </h3>
          {property.address && (
            <p className="text-[11px] text-slate-500 mt-0.5 leading-tight line-clamp-1">
              {property.address}{property.city ? `, ${property.city}` : ''}
            </p>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); unsave.mutate() }}
          className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
          aria-label="Remove from wishlist"
        >
          <Heart size={16} fill="currentColor" />
        </button>
      </div>

      {/* ── Body ── */}
      <div className="px-4 pb-4 flex flex-col gap-4">

        {/* Pills */}
        {(bhkLabel || furnished || typeLabel) && (
          <div className="flex flex-wrap gap-1.5 -mt-1">
            {bhkLabel  && <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-50 text-brand-700">{bhkLabel}</span>}
            {furnished && <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">{furnished}</span>}
            {typeLabel && <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-50 text-violet-700">{typeLabel}</span>}
          </div>
        )}

        {/* Pricing */}
        <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 overflow-hidden">
          <div className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
            <span className="text-xs text-slate-500">Monthly rent</span>
            <span className="text-sm font-bold text-slate-900">{formatRent(Number(property.rent))}</span>
          </div>
          {Number(property.deposit) > 0 && (
            <div className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
              <span className="text-xs text-slate-500">Security deposit</span>
              <span className="text-sm font-bold text-slate-700">{formatCurrency(Number(property.deposit))}</span>
            </div>
          )}
          <div className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
            <span className="text-xs text-slate-500">Maintenance</span>
            <span className="text-sm font-bold text-slate-700">{Number(property.maintenance) > 0 ? `${formatCurrency(Number(property.maintenance))}/mo` : 'Not included'}</span>
          </div>
        </div>

        {/* Amenities */}
        {property.amenities?.length > 0 && (
          <div>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Amenities</p>
            <div className="flex flex-wrap gap-1.5">
              {property.amenities.slice(0, 10).map((a) => (
                <span
                  key={a.amenityId ?? a.amenity?.name}
                  className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[11px] text-slate-600 font-medium"
                >
                  <span className="text-slate-500 shrink-0">
                    <AmenityIcon name={a.amenity?.name} size={13} />
                  </span>
                  {a.amenity?.name}
                </span>
              ))}
              {property.amenities.length > 10 && (
                <span className="px-2 py-1 text-[11px] text-slate-500 bg-slate-50 border border-slate-100 rounded-lg">
                  +{property.amenities.length - 10}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Directions & Owner contact */}
        <div className="flex flex-col gap-2">
          {directionsUrl && (
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-brand-50 border border-brand-100 hover:bg-brand-100 transition-colors no-underline"
            >
              <Navigation size={16} color="#0d8a5f" />
              <span className="flex-1 text-xs font-semibold text-brand-700">Get directions</span>
              <ArrowRight size={12} color="#0d8a5f" strokeWidth={2.5} />
            </a>
          )}

          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 border border-dashed border-slate-200">
            <span className="text-slate-300">
              <Phone size={15} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-500 font-medium">Owner contact</p>
              <p className="text-[11px] text-slate-300 mt-0.5">Request a visit to unlock</p>
            </div>
            <Lock size={13} color="#cbd5e1" />
          </div>
        </div>

        {/* Stay Score */}
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-100">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-amber-700 uppercase tracking-widest mb-1">Stay Score</p>
            <div className="flex items-center gap-2">
              <WishlistStars score={score} />
              <span className="text-sm font-bold text-slate-800">
                {score > 0 ? score.toFixed(1) : '—'}
                <span className="text-xs font-normal text-slate-500">/5</span>
              </span>
              {reviewCount > 0 && (
                <span className="text-[11px] text-slate-500">({reviewCount})</span>
              )}
            </div>
          </div>
          {score === 0 && (
            <span className="text-xs text-amber-600 font-medium">No reviews yet</span>
          )}
        </div>

        {/* CTA */}
        <Link
          to={`/property/${property.id}`}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-sm font-bold text-white no-underline transition-colors duration-150 active:scale-[0.98]"
        >
          More details
          <ArrowRight size={13} strokeWidth={2.5} />
        </Link>
      </div>
    </div>
  )
}

// ── Section: Calendar ──────────────────────────────────────────────────────
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
    detail: a.requestedTime,
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
          <button type="button" aria-label="Previous month" onClick={() => setCursor(c => c.month === 0 ? { year: c.year - 1, month: 11 } : { ...c, month: c.month - 1 })} className="text-slate-500 hover:text-slate-700 w-8 h-8 flex items-center justify-center"><span aria-hidden="true">‹</span></button>
          <p className="text-sm font-bold text-slate-900">{monthLabel}</p>
          <button type="button" aria-label="Next month" onClick={() => setCursor(c => c.month === 11 ? { year: c.year + 1, month: 0 } : { ...c, month: c.month + 1 })} className="text-slate-500 hover:text-slate-700 w-8 h-8 flex items-center justify-center"><span aria-hidden="true">›</span></button>
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
                className="aspect-square flex flex-col items-center justify-center gap-0.5 rounded-lg hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500"
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
  const qc = useQueryClient()

  useEffect(() => {
    if (section !== 'messages') return
    qc.invalidateQueries({ queryKey: ['chat-unread'] })
    notificationService.markAllByType('MESSAGE').then(() => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
    }).catch(() => {})
  }, [section, qc])

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
        return <OverviewSection listings={listings} isOwner={isOwner} onListProperty={() => navigate('/list')} />
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
        return <WishlistSection />
      case 'messages':
        return <ChatPanel />
      case 'notifications':
        return <NotificationCenter />
      case 'settings':
        return <SettingsPanel />
      case 'support':
        return <ComingSoon icon={LifeBuoy} title="Help &amp; Support" description="Get help with listings, appointments, and anything else." />
      default:
        return null
    }
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 pt-16">
      <SEOMeta title="Dashboard" noindex />
      <main className={`flex-1 overflow-hidden ${isFullBleed ? '' : 'px-4 md:px-8 py-4 md:py-8 overflow-y-auto'}`}>
        {renderSection()}
      </main>
    </div>
  )
}
