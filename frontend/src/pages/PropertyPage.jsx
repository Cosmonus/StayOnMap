import { useState, useCallback, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@features/auth/hooks/useAuth'
import { propertyService } from '@services/property.service'
import { formatRent, formatCurrency, imgUrl } from '@utils/format'
import TrustBadge         from '@components/common/TrustBadge'
import RiskAlert          from '@components/common/RiskAlert'
import TrustScoreWidget   from '@features/trust/components/TrustScoreWidget'
import AppointmentForm    from '@features/appointments/components/AppointmentForm'
import { appointmentService } from '@services/appointment.service'
import { chatService } from '@services/chat.service'
import { toast } from '@components/common/Toaster'
import { googleMapsReady, createHtmlMarker } from '@lib/googleMaps'
import ReviewsSection     from '@features/reviews/components/ReviewsSection'
import ReportButton       from '@features/reports/components/ReportButton'
import UnifiedSidebar     from '@components/layout/UnifiedSidebar'
import Header             from '@components/layout/Header'
import Footer             from '@components/layout/Footer'
import LoginModal         from '@features/auth/components/LoginModal'
import { AmenityIcon }   from '@components/common/AmenityIcon'
import { savedService }  from '@services/saved.service'
import SEOMeta             from '@components/common/SEOMeta'
import { BRAND, canonical } from '@lib/seo'
import PropertyAreaInsight from '@features/areas/components/PropertyAreaInsight'

// ── Helpers ──────────────────────────────────────────────────────────────────
function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function availabilityTag(property) {
  const { status, availableFrom } = property
  if (status === 'INACTIVE' || status === 'SUSPENDED')
    return { label: 'Not Available', dot: 'bg-slate-400', text: 'text-slate-500', bg: 'bg-slate-50' }
  if (status === 'PENDING')
    return { label: 'Awaiting Approval', dot: 'bg-amber-400', text: 'text-amber-600', bg: 'bg-amber-50' }
  if (status === 'DRAFT')
    return { label: 'Draft', dot: 'bg-slate-300', text: 'text-slate-400', bg: 'bg-slate-50' }
  if (availableFrom) {
    const d = new Date(availableFrom)
    if (d > new Date())
      return {
        label: `Available from ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`,
        dot: 'bg-blue-500', text: 'text-blue-600', bg: 'bg-blue-50',
      }
  }
  return { label: 'Available Now', dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' }
}

function formatType(type) {
  if (!type) return ''
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatFurnished(f) {
  if (!f) return ''
  const map = { FULLY: 'Fully Furnished', SEMI: 'Semi Furnished', UNFURNISHED: 'Unfurnished' }
  return map[f] ?? f
}

// ── SVG Icons (inline, no deps) ──────────────────────────────────────────────
function Icon({ d, className = 'w-4 h-4', strokeWidth = '1.8' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

const ICONS = {
  back:     'M19 12H5M12 5l-7 7 7 7',
  share:    'M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13',
  heart:    'M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z',
  pin:      'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z',
  pinDot:   'M15 11a3 3 0 11-6 0 3 3 0 016 0z',
  chevL:    'M15 18l-6-6 6-6',
  chevR:    'M9 18l6-6-6-6',
  close:    'M18 6L6 18M6 6l12 12',
  grid:     'M4 6h16M4 12h16M4 18h16',
  area:     'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  floor:    'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16M3 21h18M9 7h1M9 11h1M9 15h1M14 7h1M14 11h1M14 15h1',
  compass:  'M12 2L12 22M2 12L22 12',
  calendar: 'M8 7V3M16 7V3M3 11h18M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z',
  users:    'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  check:    'M20 6L9 17l-5-5',
  x:        'M18 6L6 18M6 6l12 12',
}

// ── Image Lightbox ──────────────────────────────────────────────────────────
function Lightbox({ images, startIndex, onClose }) {
  const [idx, setIdx] = useState(startIndex)
  const len = images.length

  const handleKey = useCallback((e) => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'ArrowLeft') setIdx(i => (i - 1 + len) % len)
    if (e.key === 'ArrowRight') setIdx(i => (i + 1) % len)
  }, [len, onClose])

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center"
      onClick={onClose}
      onKeyDown={handleKey}
      tabIndex={0}
      role="dialog"
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
      >
        <Icon d={ICONS.close} className="w-5 h-5 text-white" strokeWidth="2" />
      </button>

      {/* Counter */}
      <div className="absolute top-5 left-1/2 -translate-x-1/2 text-white/70 text-sm font-medium">
        {idx + 1} / {len}
      </div>

      {/* Image */}
      <img
        src={imgUrl(images[idx]?.url, 'detail')}
        alt={`Photo ${idx + 1}`}
        className="max-h-[85vh] max-w-[90vw] object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />

      {/* Nav */}
      {len > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); setIdx(i => (i - 1 + len) % len) }}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <Icon d={ICONS.chevL} className="w-5 h-5 text-white" strokeWidth="2.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setIdx(i => (i + 1) % len) }}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <Icon d={ICONS.chevR} className="w-5 h-5 text-white" strokeWidth="2.5" />
          </button>
        </>
      )}

      {/* Thumbnails */}
      {len > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 max-w-[90vw] overflow-x-auto no-scrollbar px-2">
          {images.map((img, i) => (
            <button
              key={img.id ?? i}
              onClick={(e) => { e.stopPropagation(); setIdx(i) }}
              className={`shrink-0 w-14 h-10 rounded-lg overflow-hidden border-2 transition-all ${i === idx ? 'border-white opacity-100 scale-105' : 'border-transparent opacity-50 hover:opacity-80'}`}
            >
              <img src={imgUrl(img.url, 'card')} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Image Gallery (Grid + Carousel) ─────────────────────────────────────────
function ImageGallery({ images, onOpenLightbox }) {
  const [mobileIdx, setMobileIdx] = useState(0)
  const list = images ?? []

  if (!list.length) {
    return (
      <div className="aspect-video bg-slate-100 rounded-2xl flex items-center justify-center">
        <div className="text-center text-slate-300">
          <svg className="w-16 h-16 mx-auto mb-2" fill="currentColor" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
          <p className="text-sm">No photos available</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Desktop: Grid layout */}
      <div className="hidden md:grid grid-cols-4 grid-rows-2 gap-2 rounded-2xl overflow-hidden h-[420px]">
        {/* Main large image */}
        <button
          onClick={() => onOpenLightbox(0)}
          className="col-span-2 row-span-2 relative group overflow-hidden"
        >
          <img src={list[0]?.url} alt="Property" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
        </button>

        {/* Secondary images */}
        {list.slice(1, 5).map((img, i) => (
          <button
            key={img.id ?? i}
            onClick={() => onOpenLightbox(i + 1)}
            className="relative group overflow-hidden"
          >
            <img src={img.url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
            {/* "View all" overlay on last visible image */}
            {i === 3 && list.length > 5 && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <span className="text-white font-semibold text-sm">+{list.length - 5} photos</span>
              </div>
            )}
          </button>
        ))}

        {/* Fill empty slots if < 5 images */}
        {list.length < 5 && Array.from({ length: Math.min(4, 5 - list.length) }).map((_, i) => (
          <div key={`empty-${i}`} className="bg-slate-100" />
        ))}
      </div>

      {/* Mobile: Carousel */}
      <div className="md:hidden relative rounded-2xl overflow-hidden">
        <button onClick={() => onOpenLightbox(mobileIdx)} className="w-full">
          <div className="aspect-[4/3] bg-slate-100">
            <img src={list[mobileIdx]?.url} alt="Property" className="w-full h-full object-cover" />
          </div>
        </button>
        {list.length > 1 && (
          <>
            <button
              onClick={() => setMobileIdx(i => (i - 1 + list.length) % list.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center"
            >
              <Icon d={ICONS.chevL} className="w-4 h-4 text-white" strokeWidth="2.5" />
            </button>
            <button
              onClick={() => setMobileIdx(i => (i + 1) % list.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center"
            >
              <Icon d={ICONS.chevR} className="w-4 h-4 text-white" strokeWidth="2.5" />
            </button>
            <div className="absolute bottom-3 right-4 bg-black/50 text-white text-xs font-medium px-2.5 py-1 rounded-full">
              {mobileIdx + 1} / {list.length}
            </div>
          </>
        )}
      </div>
    </>
  )
}

// ── Section components ───────────────────────────────────────────────────────
function SectionCard({ id, title, children, className = '' }) {
  return (
    <section id={id} className={`bg-white rounded-2xl border border-slate-100 p-6 ${className}`}>
      {title && <h2 className="text-lg font-bold text-slate-900 mb-4">{title}</h2>}
      {children}
    </section>
  )
}

function DetailRow({ icon, label, value }) {
  if (!value) return null
  return (
    <div className="flex items-center gap-3 py-3 border-b border-slate-50 last:border-0">
      <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center shrink-0">
        <Icon d={icon} className="w-4 h-4 text-slate-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-400 leading-none mb-0.5">{label}</p>
        <p className="text-sm font-medium text-slate-800">{value}</p>
      </div>
    </div>
  )
}

function PriceRow({ label, value, accent }) {
  if (!value) return null
  return (
    <div className="flex justify-between items-center py-3 border-b border-slate-50 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-sm font-semibold ${accent ? 'text-brand-600' : 'text-slate-800'}`}>{value}</span>
    </div>
  )
}

// ── Interested People (owner view) ───────────────────────────────────────────
const STATUS_STYLE = {
  PENDING:     { label: 'Pending',     bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-400' },
  ACCEPTED:    { label: 'Accepted',    bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  REJECTED:    { label: 'Rejected',    bg: 'bg-red-50',     text: 'text-red-600',     dot: 'bg-red-400' },
  RESCHEDULED: { label: 'Rescheduled', bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-400' },
  CANCELLED:   { label: 'Cancelled',   bg: 'bg-slate-100',  text: 'text-slate-500',   dot: 'bg-slate-400' },
}

function InterestedPeoplePanel({ propertyId }) {
  const [expandedId, setExpandedId] = useState(null)
  const [chattingId, setChattingId] = useState(null)
  const navigate = useNavigate()

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['property-appointments', propertyId],
    queryFn: () => appointmentService.forProperty(propertyId).then(r => r.data),
  })

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-3 p-3">
            <div className="w-10 h-10 rounded-full bg-slate-200" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-28 bg-slate-200 rounded" />
              <div className="h-3 w-20 bg-slate-100 rounded" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!appointments.length) {
    return (
      <div className="text-center py-8">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
          <Icon d={ICONS.users} className="w-5 h-5 text-slate-400" />
        </div>
        <p className="text-sm font-medium text-slate-600">No interest yet</p>
        <p className="text-xs text-slate-400 mt-1">People who request visits will appear here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {appointments.map(apt => {
        const tenant = apt.tenant ?? {}
        const initial = tenant.name?.[0]?.toUpperCase() ?? tenant.email?.[0]?.toUpperCase() ?? '?'
        const displayName = tenant.name ?? tenant.email ?? 'Unknown'
        const isOpen = expandedId === apt.id
        const st = STATUS_STYLE[apt.status] ?? STATUS_STYLE.PENDING
        const date = new Date(apt.requestedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

        return (
          <div key={apt.id} className="rounded-xl border border-slate-100 overflow-hidden">
            {/* Row: avatar + name + chat icon */}
            <div className="flex items-center gap-3 px-4 py-3">
              {/* Avatar — click to expand */}
              <button onClick={() => setExpandedId(isOpen ? null : apt.id)} className="shrink-0">
                {tenant.avatarUrl ? (
                  <img src={tenant.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-sm font-bold">
                    {initial}
                  </div>
                )}
              </button>

              {/* Name + status — click to expand */}
              <button onClick={() => setExpandedId(isOpen ? null : apt.id)} className="flex-1 min-w-0 text-left">
                <p className="text-sm font-semibold text-slate-800 truncate">{displayName}</p>
                <div className={`inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded-full ${st.bg}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
                  <span className={`text-[10px] font-semibold ${st.text}`}>{st.label}</span>
                </div>
              </button>

              {/* Chat icon — navigates to messages */}
              <button
                onClick={async () => {
                  if (!tenant.id) return
                  setChattingId(apt.id)
                  try {
                    await chatService.startWithTenant(propertyId, tenant.id)
                    navigate('/user?tab=messages')
                  } catch {
                    toast.error('Error', 'Could not open chat')
                  } finally {
                    setChattingId(null)
                  }
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-brand-50 text-brand-600 hover:bg-brand-100 transition-colors disabled:opacity-50"
                disabled={chattingId === apt.id}
                title="Message this person"
              >
                {chattingId === apt.id ? (
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                  </svg>
                )}
              </button>
            </div>

            {/* Expanded detail */}
            {isOpen && (
              <div className="px-4 pb-4 pt-1 border-t border-slate-50 space-y-3">
                {/* Interest info */}
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Icon d={ICONS.calendar} className="w-3.5 h-3.5" />
                  <span>Requested for {date} at {apt.requestedTime}</span>
                </div>

                {/* Mobile number */}
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                    <svg className="w-3.5 h-3.5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                    </svg>
                  </div>
                  <a href={`tel:${apt.contactNumber}`} className="text-sm font-medium text-slate-800 hover:text-brand-600 transition-colors no-underline">
                    +91 {apt.contactNumber}
                  </a>
                </div>

                {/* Message */}
                {apt.message && (
                  <div className="bg-slate-50 rounded-xl px-3 py-2.5">
                    <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Message</p>
                    <p className="text-sm text-slate-600 leading-relaxed">{apt.message}</p>
                  </div>
                )}

                {/* Email */}
                {tenant.email && (
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                    <span>{tenant.email}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Appointment section — aware of existing bookings ────────────────────────
const APPT_DISPLAY = {
  PENDING:     { icon: '🕐', label: 'Visit requested',      bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-800'   },
  ACCEPTED:    { icon: '✅', label: 'Visit confirmed',       bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-800' },
  RESCHEDULED: { icon: '🔄', label: 'Reschedule requested', bg: 'bg-blue-50',    border: 'border-blue-200',    text: 'text-blue-800'    },
}

function AppointmentSection({ propertyId, windowStart, windowEnd }) {
  const [forceForm, setForceForm] = useState(false)

  const { data: myAppointments = [], isLoading } = useQuery({
    queryKey: ['my-appointments'],
    queryFn: () => appointmentService.mine().then(r => r.data),
    staleTime: 60 * 1000,
  })

  const existing = myAppointments
    .filter(a => a.propertyId === propertyId)
    .sort((a, b) => new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0))[0]

  const needsAction = !existing
    || existing.status === 'REJECTED'
    || existing.status === 'CANCELLED'
    || existing.status === 'RESCHEDULED'

  const showForm = needsAction || forceForm

  if (isLoading) {
    return <div className="h-16 bg-slate-100 rounded-xl animate-pulse" />
  }

  if (!showForm && existing) {
    const cfg = APPT_DISPLAY[existing.status]
    const date = existing.requestedDate
      ? new Date(existing.requestedDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      : null

    return (
      <div className={`rounded-xl border p-4 space-y-2 ${cfg.bg} ${cfg.border}`}>
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">{cfg.icon}</span>
          <span className={`text-sm font-bold ${cfg.text}`}>{cfg.label}</span>
        </div>
        {date && (
          <p className={`text-xs ${cfg.text} opacity-80`}>
            {date}{existing.requestedTime ? ` · ${existing.requestedTime}` : ''}
          </p>
        )}
        {existing.ownerNote && (
          <p className={`text-xs italic ${cfg.text} opacity-70`}>&ldquo;{existing.ownerNote}&rdquo;</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {existing?.status === 'REJECTED' && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3">
          <p className="text-xs font-semibold text-red-700">Your previous request was declined</p>
          {existing.ownerNote && (
            <p className="text-xs text-red-600 mt-0.5 italic">&ldquo;{existing.ownerNote}&rdquo;</p>
          )}
          <p className="text-xs text-red-500 mt-1">You can send a new request below.</p>
        </div>
      )}
      {existing?.status === 'RESCHEDULED' && (
        <div className="rounded-xl bg-blue-50 border border-blue-200 p-3">
          <p className="text-xs font-semibold text-blue-700">The owner requested a reschedule</p>
          {existing.ownerNote && (
            <p className="text-xs text-blue-600 mt-0.5 italic">&ldquo;{existing.ownerNote}&rdquo;</p>
          )}
          <p className="text-xs text-blue-500 mt-1">Pick a new date and time below.</p>
        </div>
      )}
      <AppointmentForm propertyId={propertyId} onSuccess={() => setForceForm(false)} windowStart={windowStart} windowEnd={windowEnd} />
    </div>
  )
}

// ── Login Gate — shown to guests in place of action forms ────────────────────
function LoginGate({ onLogin }) {
  return (
    <div className="text-center py-6">
      <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-4">
        <svg className="w-7 h-7 text-brand-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
      </div>
      <h3 className="text-base font-bold text-slate-800 mb-1">Sign in to contact the owner</h3>
      <p className="text-sm text-slate-400 mb-5 max-w-[240px] mx-auto">
        Create a free account to request visits, chat with owners, and save properties.
      </p>
      <button
        onClick={onLogin}
        className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all"
        style={{ background: '#111111' }}
      >
        Sign in or create account
      </button>
      <p className="text-xs text-slate-400 mt-3">Zero brokerage. Always free for tenants.</p>
    </div>
  )
}

// ── OwnerTrust display ───────────────────────────────────────────────────────
const OWNER_TRUST_COLORS = {
  EXCELLENT: { pill: 'bg-emerald-50 text-emerald-700 border-emerald-200', bar: 'bg-emerald-500' },
  HIGH:      { pill: 'bg-green-50  text-green-700  border-green-200',     bar: 'bg-green-500'   },
  MEDIUM:    { pill: 'bg-yellow-50 text-yellow-700 border-yellow-200',    bar: 'bg-yellow-500'  },
  LOW:       { pill: 'bg-orange-50 text-orange-700 border-orange-200',    bar: 'bg-orange-400'  },
}

function OwnerTrustPill({ ownerTrust }) {
  const cfg = OWNER_TRUST_COLORS[ownerTrust.level] ?? OWNER_TRUST_COLORS.MEDIUM
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full border ${cfg.pill}`}>
      OwnerTrust: {ownerTrust.score}/100
    </span>
  )
}

function OwnerTrustBar({ ownerTrust }) {
  const cfg = OWNER_TRUST_COLORS[ownerTrust.level] ?? OWNER_TRUST_COLORS.MEDIUM
  return (
    <div className="mt-2.5 space-y-1">
      <div className="flex items-center justify-between text-[10px] text-slate-400">
        <span className="font-medium">OwnerTrust™</span>
        <span>{ownerTrust.level?.charAt(0) + ownerTrust.level?.slice(1).toLowerCase()} · {ownerTrust.score}/100</span>
      </div>
      <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${cfg.bar}`} style={{ width: `${ownerTrust.score}%` }} />
      </div>
      {ownerTrust.responseRate > 0 && (
        <p className="text-[10px] text-slate-400">{ownerTrust.responseRate.toFixed(0)}% response rate</p>
      )}
    </div>
  )
}

// ── Location map card ────────────────────────────────────────────────────────
function PropertyLocationMap({ lat, lng }) {
  const containerRef = useRef(null)

  useEffect(() => {
    if (!lat || !lng || !containerRef.current) return
    let marker = null
    let cancelled = false

    googleMapsReady.then(() => {
      if (cancelled || !containerRef.current) return
      const center = { lat: Number(lat), lng: Number(lng) }
      const map = new window.google.maps.Map(containerRef.current, {
        center,
        zoom: 15,
        mapTypeId: 'roadmap',
        disableDefaultUI: true,
        gestureHandling: 'none',
        clickableIcons: false,
      })
      const el = document.createElement('div')
      el.style.cssText = [
        'width:14px', 'height:14px', 'border-radius:50%',
        'background:#0284c7', 'border:3px solid white',
        'box-shadow:0 2px 8px rgba(2,132,199,0.55)',
      ].join(';')
      marker = createHtmlMarker({ element: el, lat: center.lat, lng: center.lng, map })
    })

    return () => { cancelled = true; marker?.remove() }
  }, [lat, lng])

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`

  return (
    <section className="relative bg-white rounded-2xl border border-slate-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-900">Map</h2>
        <a
          href={directionsUrl}
          target="_blank"
          rel="noreferrer"
          className="relative z-10 flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-xl transition-colors"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6-3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          Directions
        </a>
      </div>
      <div ref={containerRef} className="w-full h-64 rounded-xl overflow-hidden bg-slate-100" />
    </section>
  )
}

// ── Loading state ────────────────────────────────────────────────────────────
function PageSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 animate-pulse">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="h-5 w-32 bg-slate-200 rounded" />
        <div className="hidden md:grid grid-cols-4 grid-rows-2 gap-2 rounded-2xl overflow-hidden h-[420px]">
          <div className="col-span-2 row-span-2 bg-slate-200" />
          <div className="bg-slate-200" />
          <div className="bg-slate-200" />
          <div className="bg-slate-200" />
          <div className="bg-slate-200" />
        </div>
        <div className="h-8 w-96 bg-slate-200 rounded-lg" />
        <div className="h-5 w-64 bg-slate-200 rounded" />
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function PropertyPage() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const qc = useQueryClient()
  const [lightboxIdx, setLightboxIdx] = useState(null)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)

  const { data: property, isLoading, error } = useQuery({
    queryKey: ['property', id],
    queryFn: () => propertyService.getById(id).then(r => r.data),
  })

  // Check if this property is already saved
  const { data: savedList } = useQuery({
    queryKey: ['saved'],
    queryFn: () => savedService.getMySaved().then(r => r.data),
    enabled: !!user,
  })

  useEffect(() => {
    if (savedList && id) {
      setSaved(savedList.some(s => s.propertyId === id))
    }
  }, [savedList, id])

  const saveMutation = useMutation({
    mutationFn: (isSaving) =>
      isSaving ? savedService.save(id) : savedService.unsave(id),
    onMutate: (isSaving) => setSaved(isSaving),
    onError: (_err, isSaving) => setSaved(!isSaving),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved'] }),
  })

  const handleShare = useCallback(() => {
    const url = window.location.href
    if (navigator.share) {
      navigator.share({ title: property?.title, url })
    } else {
      navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [property?.title])

  // Guest layout wrapper (public header + footer)
  const GuestShell = ({ children }) => (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />
      <div className="flex-1 pt-16">{children}</div>
      <Footer />
      <LoginModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
    </div>
  )

  // Logged-in layout wrapper (sidebar only, no header/footer)
  const userName = user?.user_metadata?.name ?? ''
  const userEmail = user?.email ?? ''
  const userAvatar = user?.user_metadata?.avatar_url ?? ''

  const DashShell = ({ children }) => (
    <div className="flex h-screen bg-slate-50">
      <UnifiedSidebar
        active="properties"
        onChange={(tabId) => navigate(`/user?tab=${tabId}`)}
        onLogout={signOut}
        userName={userName}
        userEmail={userEmail}
        avatarUrl={userAvatar}
      />
      {children}
    </div>
  )

  const Shell = user ? DashShell : GuestShell

  if (isLoading) {
    return <Shell><PageSkeleton /></Shell>
  }

  if (error || !property) {
    return (
      <Shell>
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-24">
          <svg className="w-16 h-16 mb-4 text-slate-200" fill="currentColor" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
          <p className="text-lg font-semibold text-slate-700">Property not found</p>
          <p className="text-sm mt-1">This listing may have been removed or is no longer available.</p>
          <button onClick={() => navigate(-1)} className="mt-6 px-5 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors">
            Go back
          </button>
        </div>
      </Shell>
    )
  }

  const avail    = availabilityTag(property)
  const bhkLabel = property.type === 'PG'
    ? `${property.sharing}-Sharing PG`
    : property.bhk ? `${property.bhk} BHK` : null

  const floorLabel = (() => {
    if (property.floor && property.totalFloors) return `${ordinal(property.floor)} floor of ${property.totalFloors}`
    if (property.floor)       return `${ordinal(property.floor)} floor`
    if (property.totalFloors) return `${property.totalFloors}-floor building`
    return null
  })()

  const images = property.images ?? []
  const isOwner = user?.id === property.ownerId

  // ── SEO ──────────────────────────────────────────────────────────────────
  const primaryImage = images.find(i => i.isPrimary)?.url ?? images[0]?.url
  const seoTitle = [bhkLabel, formatType(property.type), 'in', property.city]
    .filter(Boolean).join(' ')
  const seoDesc = [
    bhkLabel, formatType(property.type), 'for rent in', property.area ? `${property.area}, ` : '', property.city,
    '—', formatRent(property.rent), property.furnished ? `· ${formatFurnished(property.furnished)}` : '',
    '· No brokerage ·', BRAND.name,
  ].filter(Boolean).join(' ')

  const propertyJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: property.title,
    description: property.description ?? seoDesc,
    url: canonical(`/property/${id}`),
    image: primaryImage ?? undefined,
    offers: {
      '@type': 'Offer',
      price: property.rent,
      priceCurrency: 'INR',
      priceSpecification: { '@type': 'UnitPriceSpecification', priceType: 'monthly' },
    },
    address: {
      '@type': 'PostalAddress',
      streetAddress: property.address ?? '',
      addressLocality: property.city,
      addressRegion: property.state ?? '',
      postalCode: property.pincode ?? '',
      addressCountry: 'IN',
    },
  }

  return (
    <Shell>
        {/* ── Page-level SEO ───────────────────────────────────────── */}
        <SEOMeta
          title={seoTitle}
          description={seoDesc.slice(0, 160)}
          image={primaryImage}
          canonical={canonical(`/property/${id}`)}
          jsonLd={propertyJsonLd}
        />
        {/* ── Scrollable main content ──────────────────────────────── */}
        <main className="flex-1 overflow-y-auto">

      {/* Lightbox */}
      {lightboxIdx !== null && images.length > 0 && (
        <Lightbox images={images} startIndex={lightboxIdx} onClose={() => setLightboxIdx(null)} />
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-24 lg:pb-10">

        {/* ── Top bar: Back + Actions ─────────────────────────────── */}
        <div className="flex items-center justify-between py-4">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            <Icon d={ICONS.back} className="w-4 h-4" />
            <span className="hidden sm:inline">Back to properties</span>
            <span className="sm:hidden">Back</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 transition-all"
            >
              <Icon d={ICONS.share} className="w-4 h-4" />
              {copied ? 'Copied!' : 'Share'}
            </button>
            <button
              onClick={() => user ? saveMutation.mutate(!saved) : setLoginOpen(true)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all border ${saved ? 'bg-red-50 text-red-600 border-red-200' : 'text-slate-600 hover:bg-white hover:shadow-sm border-transparent hover:border-slate-200'}`}
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d={ICONS.heart} />
              </svg>
              {saved ? 'Saved' : 'Save'}
            </button>
          </div>
        </div>

        {/* ── Risk Alert ──────────────────────────────────────────── */}
        <RiskAlert riskScore={property.riskScore} />

        {/* ── Image Gallery ───────────────────────────────────────── */}
        <ImageGallery images={images} onOpenLightbox={setLightboxIdx} />

        {/* ── Title + Price Header ─────────────────────────────────── */}
        <div className="mt-6 mb-6">
          {/* Availability badge */}
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-3 ${avail.bg}`}>
            <span className={`w-2 h-2 rounded-full shrink-0 ${avail.dot}`} />
            <span className={`text-xs font-semibold ${avail.text}`}>{avail.label}</span>
          </div>

          {/* Title + Price */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="min-w-0 space-y-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">{property.title}</h1>
              {property.displayId && (
                <button
                  onClick={() => { navigator.clipboard.writeText(property.displayId); }}
                  title="Click to copy ID"
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 text-[11px] font-mono font-semibold text-slate-500 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  {property.displayId}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                </button>
              )}

              {/* Location */}
              <div className="flex items-start gap-1.5 text-slate-500">
                <svg className="w-4 h-4 mt-0.5 shrink-0 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={ICONS.pin} /><path d={ICONS.pinDot} />
                </svg>
                <p className="text-sm leading-snug">
                  {property.address}, {property.city}, {property.state}
                  {property.pincode ? ` — ${property.pincode}` : ''}
                  {property.landmark ? <span className="text-slate-400"> (Near {property.landmark})</span> : ''}
                </p>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {bhkLabel && (
                  <span className="px-2.5 py-1 bg-brand-50 text-brand-700 text-xs font-semibold rounded-full">🛏️ {bhkLabel}</span>
                )}
                {property.furnished && (() => {
                  const FEMO = { FULLY: '🛋️', SEMI: '🪑', UNFURNISHED: '📦' }
                  return <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">{FEMO[property.furnished]} {formatFurnished(property.furnished)}</span>
                })()}
                {property.type && (() => {
                  const TEMO = { APARTMENT: '🏢', HOUSE: '🏠', VILLA: '🏡', PG: '🏘️', INDEPENDENT_HOUSE: '🏠', COMMERCIAL: '🏪' }
                  return <span className="px-2.5 py-1 bg-violet-50 text-violet-700 text-xs font-medium rounded-full">{TEMO[property.type] ?? '🏠'} {formatType(property.type)}</span>
                })()}
                {property.trustScore?.badge && <TrustBadge badge={property.trustScore.badge} size="sm" />}
              </div>
            </div>

            {/* Price block */}
            <div className="shrink-0 sm:text-right sm:pl-6">
              <p className="text-3xl font-bold text-brand-600">{formatRent(Number(property.rent))}</p>
              {property.deposit > 0 && (
                <p className="text-sm text-slate-400 mt-0.5">Deposit: {formatCurrency(Number(property.deposit))}</p>
              )}
            </div>
          </div>
        </div>

        {/* ── Two-column layout ────────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row gap-6">

          {/* ── Main content column ─────────────────────────────────── */}
          <div className="flex-1 min-w-0 space-y-5">

            {/* About */}
            {property.description && (
              <SectionCard id="overview" title="About this property">
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{property.description}</p>
              </SectionCard>
            )}

            {/* Property Details */}
            {(property.area || floorLabel || property.facingDirection || property.availableFrom || property.leaseDuration || property.occupancyLimit) && (
              <SectionCard title="Property details">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                  <DetailRow icon={ICONS.area}     label="Built-up Area"     value={property.area ? `${Number(property.area).toLocaleString('en-IN')} sq.ft` : null} />
                  <DetailRow icon={ICONS.floor}    label="Floor"             value={floorLabel} />
                  <DetailRow icon={ICONS.compass}  label="Facing Direction"  value={property.facingDirection ? property.facingDirection.charAt(0) + property.facingDirection.slice(1).toLowerCase() : null} />
                  <DetailRow icon={ICONS.calendar} label="Available From"    value={property.availableFrom ? new Date(property.availableFrom).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null} />
                  <DetailRow icon={ICONS.calendar} label="Minimum Lease"     value={property.leaseDuration ? `${property.leaseDuration} months` : null} />
                  <DetailRow icon={ICONS.users}    label="Max Occupancy"     value={property.occupancyLimit ? `${property.occupancyLimit} persons` : null} />
                </div>
              </SectionCard>
            )}

            {/* Pricing + Amenities side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Pricing */}
              <SectionCard id="pricing" title="Pricing breakdown">
                <PriceRow label="Monthly Rent"       value={formatCurrency(Number(property.rent))}     accent />
                <PriceRow label="Security Deposit"   value={formatCurrency(Number(property.deposit))} />
                <PriceRow label="Brokerage"          value={property.brokerage ? formatCurrency(Number(property.brokerage)) : 'None'} />
                <PriceRow label="Maintenance"        value={property.maintenance ? formatCurrency(Number(property.maintenance)) + '/mo' : 'Not included'} />
                <PriceRow label="Electricity (est.)" value={property.electricityCharges ? formatCurrency(Number(property.electricityCharges)) + '/mo' : null} />
                <PriceRow label="Water (est.)"       value={property.waterCharges ? formatCurrency(Number(property.waterCharges)) + '/mo' : null} />
              </SectionCard>

              {/* Amenities */}
              {property.amenities?.length > 0 && (
                <SectionCard id="amenities" title="Amenities">
                  <div className="grid grid-cols-2 gap-2.5">
                    {property.amenities.map(a => {
                      const name = a.amenity?.name ?? a.amenityId
                      return (
                        <div
                          key={a.amenityId ?? name}
                          className="flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 rounded-xl border border-slate-100"
                        >
                          <span className="text-slate-400 shrink-0"><AmenityIcon name={name} size={16} /></span>
                          <span className="text-sm font-medium text-slate-700 truncate min-w-0">{name}</span>
                        </div>
                      )
                    })}
                  </div>
                </SectionCard>
              )}
            </div>

            {/* Zero Brokerage banner */}
            {!property.brokerage && (
              <div className="px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-2.5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/>
                </svg>
                <div>
                  <p className="text-sm font-semibold text-emerald-700">Zero Brokerage</p>
                  <p className="text-xs text-emerald-600/70">Connect directly with the owner — no middlemen fees</p>
                </div>
              </div>
            )}

            {/* House Rules */}
            {property.rules && (
              <SectionCard id="rules" title="House rules">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {[
                    { icon: 'M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3', label: 'Non-veg Cooking', allowed: property.rules.nonVegAllowed   },
                    { icon: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z',               label: 'Bachelors',       allowed: property.rules.bachelorAllowed },
                    { icon: 'M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9zM13 2v7h7',                       label: 'Visitors',        allowed: property.rules.visitorsAllowed },
                    { icon: 'M10 5.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm7 0a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM4 9.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zm15 0a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM12 10c-4 0-7 3-7 6.5 0 2 1.5 3.5 7 3.5s7-1.5 7-3.5C19 13 16 10 12 10z', label: 'Pets', allowed: property.rules.petsAllowed },
                    { icon: 'M18 8h1a4 4 0 010 8h-1M2 8h16v4M6 1v3M10 1v3M14 1v3M6 20v-8',                         label: 'Smoking',         allowed: property.rules.smokingAllowed  },
                    { icon: 'M17 8h1a4 4 0 010 8h-1M3 8h14v9a4 4 0 01-4 4H7a4 4 0 01-4-4V8zM9 2v3M12 2v3M15 2v3',  label: 'Alcohol',         allowed: property.rules.alcoholAllowed  },
                  ].map(r => (
                    <div
                      key={r.label}
                      className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border ${r.allowed ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={r.allowed ? '#059669' : '#94a3b8'} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                        <path d={r.icon} />
                      </svg>
                      <span className={`text-sm font-medium flex-1 ${r.allowed ? 'text-slate-800' : 'text-slate-400'}`}>{r.label}</span>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${r.allowed ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          {r.allowed ? <path d="M20 6L9 17l-5-5" /> : <path d="M18 6L6 18M6 6l12 12" />}
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Gender preference + Curfew */}
                {(property.rules.genderPreference !== 'ANY' || property.rules.curfewTime) && (
                  <div className="mt-3 space-y-2">
                    {property.rules.genderPreference && property.rules.genderPreference !== 'ANY' && (
                      <div className="flex items-center gap-2.5 px-4 py-3 bg-brand-50 rounded-xl border border-brand-100">
                        <span className="w-5 h-5 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs font-bold shrink-0">!</span>
                        <span className="text-sm font-medium text-brand-700">
                          {property.rules.genderPreference === 'MALE' ? 'Male tenants only' : 'Female tenants only'}
                        </span>
                      </div>
                    )}
                    {property.rules.curfewTime && (
                      <div className="flex items-center gap-2.5 px-4 py-3 bg-amber-50 rounded-xl border border-amber-100">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                          <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                        </svg>
                        <span className="text-sm font-medium text-amber-800">Curfew at {property.rules.curfewTime}</span>
                      </div>
                    )}
                  </div>
                )}
              </SectionCard>
            )}

            {/* Trust Score — mobile only; desktop shows it in sidebar */}
            <div className="lg:hidden">
              <SectionCard title="Trust &amp; safety">
                <TrustScoreWidget trustScore={property.trustScore} riskScore={property.riskScore} />
              </SectionCard>
            </div>

            {/* Posted by */}
            {property.owner && (
              <SectionCard title="Posted by">
                <div className="flex items-start gap-4">
                  {property.owner.avatarUrl ? (
                    <img
                      src={property.owner.avatarUrl}
                      alt=""
                      className="w-14 h-14 rounded-2xl object-cover shrink-0 border border-slate-100"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-slate-800 text-white text-xl font-bold flex items-center justify-center shrink-0">
                      {(property.owner.name || 'O')[0].toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-bold text-slate-900 truncate">
                      {property.owner.name ?? 'Owner'}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Member since {new Date(property.owner.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[11px] font-semibold rounded-full border border-emerald-100">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6L9 17l-5-5" />
                        </svg>
                        Direct owner — no brokerage
                      </span>
                      {property.owner.ownerTrustScore && property.owner.ownerTrustScore.level !== 'UNRATED' && (
                        <OwnerTrustPill ownerTrust={property.owner.ownerTrustScore} />
                      )}
                    </div>
                    {property.owner.ownerTrustScore && property.owner.ownerTrustScore.level !== 'UNRATED' && (
                      <OwnerTrustBar ownerTrust={property.owner.ownerTrustScore} />
                    )}
                  </div>
                </div>
              </SectionCard>
            )}

            {/* Location map */}
            {property.lat && property.lng && (
              <PropertyLocationMap lat={property.lat} lng={property.lng} />
            )}

            {/* Reviews */}
            <SectionCard id="reviews" title="Community reviews">
              <ReviewsSection propertyId={id} isOwner={isOwner} ownerInfo={property?.owner} />
            </SectionCard>

            {/* Report */}
            <div className="flex items-center justify-between py-3">
              <p className="text-xs text-slate-400">Something wrong with this listing?</p>
              <ReportButton propertyId={id} />
            </div>
          </div>

          {/* ── Right sidebar (sticky) ──────────────────────────────── */}
          <aside className="hidden lg:block w-[340px] shrink-0">
            <div className="sticky top-4 space-y-4">

              {/* 1 — Trust & safety */}
              <div className="bg-white rounded-2xl border border-slate-100 p-5">
                <h3 className="text-sm font-bold text-slate-800 mb-4">Trust &amp; safety</h3>
                <TrustScoreWidget trustScore={property.trustScore} riskScore={property.riskScore} />
              </div>

              {/* 2 — Location */}
              <div className="bg-white rounded-2xl border border-slate-100 p-5">
                <h3 className="text-sm font-bold text-slate-800 mb-3">Location</h3>
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 mt-0.5 shrink-0 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d={ICONS.pin} /><path d={ICONS.pinDot} />
                  </svg>
                  <div>
                    <p className="text-sm text-slate-700 leading-snug">{property.address}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {property.city}, {property.state}
                      {property.pincode ? ` — ${property.pincode}` : ''}
                    </p>
                    {property.landmark && (
                      <p className="text-xs text-slate-400 mt-0.5 italic">Near {property.landmark}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* 3 — Area insight */}
              <PropertyAreaInsight city={property.city} landmark={property.landmark} />

              {/* 4 — Owner: Interested people / Tenant: price + appointment form */}
              {isOwner ? (
                <div className="bg-white rounded-2xl border border-slate-100 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-slate-800">Interested people</h3>
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${avail.bg}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${avail.dot}`} />
                      <span className={`text-xs font-semibold ${avail.text}`}>{avail.label}</span>
                    </div>
                  </div>
                  <InterestedPeoplePanel propertyId={id} />
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-100 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-2xl font-bold text-brand-600">{formatRent(Number(property.rent))}</p>
                      {property.deposit > 0 && (
                        <p className="text-xs text-slate-400 mt-0.5">Deposit: {formatCurrency(Number(property.deposit))}</p>
                      )}
                    </div>
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${avail.bg}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${avail.dot}`} />
                      <span className={`text-xs font-semibold ${avail.text}`}>{avail.label}</span>
                    </div>
                  </div>

                  {user ? (
                    <>
                      <div id="appointment-form" className="border-t border-slate-100 pt-4">
                        <AppointmentSection propertyId={id} windowStart={property.appointmentWindowStart} windowEnd={property.appointmentWindowEnd} />
                      </div>
                      <div className="border-t border-slate-100 pt-4">
                        <button
                          onClick={async () => {
                            try {
                              await chatService.startConversation(id)
                              navigate('/user?tab=messages')
                            } catch {
                              toast.error('Error', 'Could not start conversation')
                            }
                          }}
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-100 text-slate-700 font-semibold text-sm hover:bg-slate-200 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          Chat with owner
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="border-t border-slate-100 pt-4">
                      <LoginGate onLogin={() => setLoginOpen(true)} />
                    </div>
                  )}
                </div>
              )}

            </div>
          </aside>
        </div>
      </div>

      {/* ── Mobile fixed bottom bar ─────────────────────────────── */}
      {!isOwner && (
        <div className="fixed bottom-0 left-0 right-0 lg:hidden bg-white border-t border-slate-200 px-4 py-3 flex items-center justify-between gap-3 z-40 shadow-lg">
          <div>
            <p className="text-lg font-bold text-brand-600">{formatRent(Number(property.rent))}</p>
            {property.deposit > 0 && (
              <p className="text-xs text-slate-400">Deposit: {formatCurrency(Number(property.deposit))}</p>
            )}
          </div>
          {user ? (
            <button
              onClick={() => document.getElementById('appointment-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
              className="px-6 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors"
            >
              Request Visit
            </button>
          ) : (
            <button
              onClick={() => setLoginOpen(true)}
              className="px-6 py-2.5 rounded-xl bg-[#111111] text-white text-sm font-semibold hover:bg-[#2a2a2a] transition-colors"
            >
              Sign in to contact
            </button>
          )}
        </div>
      )}

        </main>
    </Shell>
  )
}
