import { useState, useCallback, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Share2, Heart, MapPin, ChevronLeft, ChevronRight, X, LayoutGrid,
  Calendar, Users, Check, ImageOff, SearchX, Loader2, MessageSquare, Phone,
  Mail, Lock, Navigation, Copy, CircleCheckBig, Clock, MessageCircleMore,
  Plus, Minus, LocateFixed,
} from 'lucide-react'
import { useAuth } from '@features/auth/hooks/useAuth'
import { propertyService } from '@services/property.service'
import { formatRent, formatCurrency, imgUrl } from '@utils/format'
import Avatar             from '@components/common/Avatar'
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
import Header             from '@components/layout/Header'
import Footer             from '@components/layout/Footer'
import { useUiStore }     from '@store/uiStore'
import { AmenityIcon }   from '@components/common/AmenityIcon'
import { savedService }  from '@services/saved.service'
import SEOMeta             from '@components/common/SEOMeta'
import { BRAND, canonical } from '@lib/seo'
import CommuteCalculator from '@features/areas/components/CommuteCalculator'
import SpatialContextPanel from '@features/spatial/components/SpatialContextPanel'

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
  return { label: 'Available now', dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' }
}

// The enum arrives SCREAMING_CASE. Lowercasing first matters — without it
// 'HOUSE' survives untouched (its first letter is already capital) and the page
// shouts "HOUSE" at the reader.
function formatType(type) {
  if (!type) return ''
  return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

function formatFurnished(f) {
  if (!f) return ''
  const map = { FULLY: 'Fully Furnished', SEMI: 'Semi Furnished', UNFURNISHED: 'Unfurnished' }
  return map[f] ?? f
}

// Uses only our own listings data — no external API. Requires at least 3
// comparable listings (same city + BHK/sharing) so a lone other listing
// can't masquerade as "the area average" (see properties.service.js).
function rentBenchmarkLabel(rent, benchmark) {
  if (!benchmark) return null
  const diff = Math.round(((rent - benchmark.avgRent) / benchmark.avgRent) * 100)
  if (diff === 0) return { text: 'Right at the average for similar homes nearby', className: 'text-slate-400' }
  const below = diff < 0
  return {
    text: `${Math.abs(diff)}% ${below ? 'below' : 'above'} the average for similar homes nearby`,
    className: below ? 'text-emerald-600' : 'text-amber-600',
  }
}

function directionsUrlFor(lat, lng) {
  if (!lat || !lng) return null
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
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
        <X className="w-5 h-5 text-white" strokeWidth={2} />
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
            <ChevronLeft className="w-5 h-5 text-white" strokeWidth={2.5} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setIdx(i => (i + 1) % len) }}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-white" strokeWidth={2.5} />
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
// The availability pill and the photo count sit on the gallery itself rather
// than in the title block: they're the two things a renter checks before
// deciding whether to keep reading, and the image is where the eye already is.
function ImageGallery({ images, avail, onOpenLightbox }) {
  const [mobileIdx, setMobileIdx] = useState(0)
  const list = images ?? []

  if (!list.length) {
    return (
      <div className="aspect-video bg-slate-100 rounded-2xl flex items-center justify-center">
        <div className="text-center text-slate-300">
          <ImageOff className="w-16 h-16 mx-auto mb-2" strokeWidth={1.5} />
          <p className="text-sm">No photos available</p>
        </div>
      </div>
    )
  }

  // Each entry tiles its photo count exactly, leaving no blank cells. Anything
  // from 5 up uses the 5-slot hero layout and hides the rest behind "+N more".
  const GALLERY_LAYOUTS = {
    1: { grid: 'grid-cols-1 grid-rows-1', hero: '' },
    2: { grid: 'grid-cols-2 grid-rows-1', hero: '' },
    3: { grid: 'grid-cols-3 grid-rows-2', hero: 'col-span-2 row-span-2' },
    4: { grid: 'grid-cols-2 grid-rows-2', hero: '' },
  }
  const layout = GALLERY_LAYOUTS[list.length] ?? { grid: 'grid-cols-4 grid-rows-2', hero: 'col-span-2 row-span-2' }
  const visible = list.length >= 5 ? list.slice(0, 5) : list

  const availPill = (
    <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 shadow-sm ${avail.bg}`}>
      <span className={`w-2 h-2 rounded-full shrink-0 ${avail.dot}`} />
      <span className={`text-xs font-semibold ${avail.text}`}>{avail.label}</span>
    </div>
  )

  return (
    <>
      {/* Desktop: a grid sized to the photos that exist. The previous version
          always drew the 5-slot layout and padded the gap with blank grey
          cells, so a listing with one photo — which is most of them — rendered
          as one image beside four empty boxes and read as a failed load. */}
      <div className="hidden md:block relative">
        <div className={`grid gap-2 rounded-2xl overflow-hidden h-[420px] ${layout.grid}`}>
          {visible.map((img, i) => (
            <button
              key={img.id ?? i}
              onClick={() => onOpenLightbox(i)}
              className={`relative group overflow-hidden ${i === 0 ? layout.hero : ''}`}
            >
              <img
                src={img.url}
                alt={i === 0 ? 'Property' : ''}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
              {i === visible.length - 1 && list.length > visible.length && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="text-white font-semibold text-sm">+{list.length - visible.length} more</span>
                </div>
              )}
            </button>
          ))}
        </div>

        <div className="absolute top-4 left-4">{availPill}</div>

        <button
          onClick={() => onOpenLightbox(0)}
          className="absolute bottom-4 right-4 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-slate-800 shadow-float transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <LayoutGrid className="w-3.5 h-3.5" strokeWidth={2.5} />
          {list.length === 1 ? 'View photo' : `View all ${list.length} photos`}
        </button>
      </div>

      {/* Mobile: Carousel */}
      <div className="md:hidden relative rounded-2xl overflow-hidden">
        <button onClick={() => onOpenLightbox(mobileIdx)} className="w-full">
          <div className="aspect-[4/3] bg-slate-100">
            <img src={list[mobileIdx]?.url} alt="Property" className="w-full h-full object-cover" />
          </div>
        </button>
        <div className="absolute top-3 left-3">{availPill}</div>
        {list.length > 1 && (
          <>
            <button
              onClick={() => setMobileIdx(i => (i - 1 + list.length) % list.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center"
            >
              <ChevronLeft className="w-4 h-4 text-white" strokeWidth={2.5} />
            </button>
            <button
              onClick={() => setMobileIdx(i => (i + 1) % list.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center"
            >
              <ChevronRight className="w-4 h-4 text-white" strokeWidth={2.5} />
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

// ── The listing sheet ────────────────────────────────────────────────────────
// One card, hairline-divided, instead of a stack of separate cards. The old
// layout gave every section its own border and shadow, so nine equally-loud
// panels competed for attention and the page read as longer than it was.
function Sheet({ children }) {
  return <div className="rounded-2xl border border-slate-100 bg-white px-5 sm:px-7">{children}</div>
}

// `first:border-t-0` keys off the rendered DOM, so a section that conditions
// itself away never leaves a stray rule at the top of the sheet.
function SheetSection({ id, title, badge, subtitle, action, children }) {
  return (
    <section id={id} className="border-t border-slate-100 py-6 first:border-t-0">
      {(title || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {title && <h2 className="text-base font-bold text-slate-900">{title}</h2>}
              {badge != null && (
                <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand-700">{badge}</span>
              )}
            </div>
            {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

function FactCell({ label, value }) {
  if (!value) return null
  return (
    <div>
      <p className="text-[11px] font-medium text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-slate-900">{value}</p>
    </div>
  )
}

function PriceRow({ label, value, accent }) {
  if (!value) return null
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-xs font-bold ${accent ? 'text-brand-700' : 'text-slate-800'}`}>{value}</span>
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
          <Users className="w-5 h-5 text-slate-400" />
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
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <MessageSquare className="w-4 h-4" strokeWidth={1.8} />
                )}
              </button>
            </div>

            {/* Expanded detail */}
            {isOpen && (
              <div className="px-4 pb-4 pt-1 border-t border-slate-50 space-y-3">
                {/* Interest info */}
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Requested for {date} at {apt.requestedTime}</span>
                </div>

                {/* Mobile number */}
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center shrink-0">
                    <Phone className="w-3.5 h-3.5 text-emerald-600" strokeWidth={2} />
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
                    <Mail className="w-3.5 h-3.5" strokeWidth={1.8} />
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
        <Lock className="w-7 h-7 text-brand-600" strokeWidth={1.8} />
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

// ── Action card — owner: interested people / tenant: price + appointment ────
// Rendered twice (sticky aside ≥lg, in-flow <lg), so the appointment anchor
// id must differ per instance — the mobile bottom bar scrolls to the <lg one.
function ActionCard({ formId, isOwner, property, avail, propertyId, user, onStartChat, onOpenLogin, directionsUrl }) {
  const bench = rentBenchmarkLabel(Number(property.rent), property.rentBenchmark)

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-card">
      {/* Price leads the card in every state — an owner looking at their own
          listing needs to see what it's advertised at just as much as a renter
          does, so this sits above the owner/tenant split rather than inside it. */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-2xl font-bold text-slate-900">{formatRent(Number(property.rent))}</p>
          {property.deposit > 0 && (
            <p className="mt-1 text-xs text-slate-500">Deposit {formatCurrency(Number(property.deposit))}</p>
          )}
          {bench && <p className={`mt-1 text-[11px] font-medium ${bench.className}`}>{bench.text}</p>}
        </div>
        <div className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 ${avail.bg}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${avail.dot}`} />
          <span className={`text-xs font-semibold ${avail.text}`}>{avail.label}</span>
        </div>
      </div>

      {isOwner ? (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <h3 className="mb-3 text-sm font-bold text-slate-800">Interested people</h3>
          <InterestedPeoplePanel propertyId={propertyId} />
        </div>
      ) : user ? (
        <>
          <div id={formId} className="mt-4 border-t border-slate-100 pt-4">
            <AppointmentSection propertyId={propertyId} windowStart={property.appointmentWindowStart} windowEnd={property.appointmentWindowEnd} />
          </div>
          {/* A listing with no coordinates gets a full-width Chat button rather
              than a half-width one beside an empty cell. */}
          <div className={`mt-4 grid gap-2 border-t border-slate-100 pt-4 ${directionsUrl ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <button
              onClick={onStartChat}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-800 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <MessageCircleMore className="w-4 h-4" strokeWidth={2} />
              Chat
            </button>
            {directionsUrl && (
              <a
                href={directionsUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-800 no-underline transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <Navigation className="w-4 h-4 text-brand-600" strokeWidth={2} />
                Directions
              </a>
            )}
          </div>
        </>
      ) : (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <LoginGate onLogin={onOpenLogin} />
        </div>
      )}
    </div>
  )
}

// ── Pricing breakdown ────────────────────────────────────────────────────────
// Its own card rather than folded into ActionCard, which the design shows as
// one panel: ActionCard already carries the inline appointment form, and
// stacking ~six more rows on top of that reliably pushes a sticky card past the
// viewport, which is the exact failure the sidebar rules exist to avoid.
function PricingCard({ property }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5">
      <h3 className="mb-3 text-sm font-bold text-slate-800">Pricing breakdown</h3>
      <div className="rounded-xl border border-slate-100 px-3.5">
        <PriceRow label="Monthly rent"       value={formatCurrency(Number(property.rent))} accent />
        <PriceRow label="Security deposit"   value={property.deposit ? formatCurrency(Number(property.deposit)) : null} />
        <PriceRow label="Maintenance"        value={property.maintenance ? `${formatCurrency(Number(property.maintenance))}/mo` : 'Not included'} />
        <PriceRow label="Brokerage"          value={property.brokerage ? formatCurrency(Number(property.brokerage)) : 'None'} />
        <PriceRow label="Electricity (est.)" value={property.electricityCharges ? `${formatCurrency(Number(property.electricityCharges))}/mo` : null} />
        <PriceRow label="Water (est.)"       value={property.waterCharges ? `${formatCurrency(Number(property.waterCharges))}/mo` : null} />
      </div>
    </div>
  )
}

// ── Location map card ────────────────────────────────────────────────────────
// Interactive, property-page only: drag to pan, custom zoom buttons, and a
// locate button that snaps back to the house. `cooperative` rather than
// `greedy` because this map sits in the middle of a scrollable page — greedy
// would hijack the page scroll the moment the cursor crosses it (the fullscreen
// explore map wants greedy; an embedded card does not).
const LOCATION_MAP_ZOOM = 15

// House pin: teardrop in brand-600 with the lucide "house" line icon knocked
// out in white. Same construction as the searched-place pin in .claude/maps.md
// (inline SVG + drop-shadow, hex allowed by the map-overlay exception —
// #0d8a5f IS brand-600). createHtmlMarker translates (-50%,-100%), so the
// teardrop's tip sits exactly on the coordinate.
function housePinElement() {
  const el = document.createElement('div')
  el.style.filter = 'drop-shadow(0 3px 6px rgba(13,138,95,0.45))'
  el.innerHTML = `
    <svg width="40" height="52" viewBox="0 0 32 42" fill="none" aria-hidden="true">
      <path d="M16 0C7.163 0 0 7.163 0 16c0 10.5 16 26 16 26S32 26.5 32 16C32 7.163 24.837 0 16 0z" fill="#0d8a5f"/>
      <g transform="translate(9.5 9.5) scale(0.542)" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/>
        <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      </g>
    </svg>`
  return el
}

function MapControlButton({ label, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-600 shadow-md ring-1 ring-slate-200 transition-colors hover:bg-slate-50 hover:text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
    >
      {children}
    </button>
  )
}

function PropertyLocationMap({ lat, lng }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)

  useEffect(() => {
    if (!lat || !lng || !containerRef.current) return
    let marker = null
    let cancelled = false

    googleMapsReady.then(() => {
      if (cancelled || !containerRef.current) return
      const center = { lat: Number(lat), lng: Number(lng) }
      const map = new window.google.maps.Map(containerRef.current, {
        center,
        zoom: LOCATION_MAP_ZOOM,
        mapTypeId: 'roadmap',
        disableDefaultUI: true, // our own controls below — Google's don't match the theme
        gestureHandling: 'cooperative',
        clickableIcons: false,
      })
      mapRef.current = map
      marker = createHtmlMarker({ element: housePinElement(), lat: center.lat, lng: center.lng, map })
    })

    return () => { cancelled = true; marker?.remove(); mapRef.current = null }
  }, [lat, lng])

  // Guarded, not disabled-looking: before init these are no-ops for the
  // fraction of a second the maps script takes to arrive.
  const zoomBy = (delta) => {
    const map = mapRef.current
    if (map) map.setZoom(map.getZoom() + delta)
  }
  const recenter = () => {
    const map = mapRef.current
    if (!map) return
    map.panTo({ lat: Number(lat), lng: Number(lng) })
    map.setZoom(LOCATION_MAP_ZOOM)
  }

  return (
    <div className="relative">
      {/* Taller now that the map is interactive — 240px was fine for a static
          thumbnail, but panning and zooming need room to be worth doing. */}
      <div ref={containerRef} className="h-72 w-full overflow-hidden rounded-xl bg-slate-100 md:h-96" />
      <div className="absolute bottom-3 right-3 flex flex-col gap-1.5">
        <MapControlButton label="Zoom in" onClick={() => zoomBy(1)}>
          <Plus className="h-4 w-4" strokeWidth={2.5} />
        </MapControlButton>
        <MapControlButton label="Zoom out" onClick={() => zoomBy(-1)}>
          <Minus className="h-4 w-4" strokeWidth={2.5} />
        </MapControlButton>
        <MapControlButton label="Back to the property" onClick={recenter}>
          <LocateFixed className="h-4 w-4" strokeWidth={2.5} />
        </MapControlButton>
      </div>
    </div>
  )
}

// ── Loading state ────────────────────────────────────────────────────────────
function PageSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto bg-slate-50 animate-pulse">
      {/* Must track the real container above, or the page jumps sideways the
          moment the skeleton is replaced. */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
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
  const { user } = useAuth()
  const openLoginModal = useUiStore((s) => s.openLoginModal)
  const qc = useQueryClient()
  const [lightboxIdx, setLightboxIdx] = useState(null)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)

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

  // Layout wrapper (shared header + footer, logged-in or guest)
  const Shell = ({ children }) => (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header />
      <div className="flex-1 pt-16">{children}</div>
      <Footer />
    </div>
  )

  if (isLoading) {
    return <Shell><PageSkeleton /></Shell>
  }

  if (error || !property) {
    return (
      <Shell>
        <SEOMeta title="Property not found" noindex />
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-24">
          <SearchX className="w-16 h-16 mb-4 text-slate-200" strokeWidth={1.5} />
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
    if (property.floor && property.totalFloors) return `${ordinal(property.floor)} of ${property.totalFloors}`
    if (property.floor)       return `${ordinal(property.floor)} floor`
    if (property.totalFloors) return `${property.totalFloors}-floor building`
    return null
  })()

  const images = property.images ?? []
  const isOwner = user?.id === property.ownerId
  const directionsUrl = directionsUrlFor(property.lat, property.lng)

  // The at-a-glance grid. Built as a list so a listing type that has no floor
  // or no facing direction simply gets a shorter grid instead of empty cells —
  // all six property types share this one section.
  const quickFacts = [
    { label: 'Configuration',  value: bhkLabel },
    { label: 'Built-up area',  value: property.area ? `${Number(property.area).toLocaleString('en-IN')} sq.ft` : null },
    { label: 'Floor',          value: floorLabel },
    { label: 'Facing',         value: property.facingDirection ? property.facingDirection.charAt(0) + property.facingDirection.slice(1).toLowerCase() : null },
    { label: 'Furnishing',     value: property.furnished ? formatFurnished(property.furnished) : null },
    { label: 'Available from', value: property.availableFrom ? new Date(property.availableFrom).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null },
    { label: 'Minimum lease',  value: property.leaseDuration ? `${property.leaseDuration} months` : null },
    { label: 'Max occupancy',  value: property.occupancyLimit ? `${property.occupancyLimit} people` : null },
  ].filter(f => f.value)

  const rules = property.rules ? [
    { label: 'Non-veg cooking', allowed: property.rules.nonVegAllowed   },
    { label: 'Bachelors',       allowed: property.rules.bachelorAllowed },
    { label: 'Visitors',        allowed: property.rules.visitorsAllowed },
    { label: 'Pets',            allowed: property.rules.petsAllowed     },
    { label: 'Smoking',         allowed: property.rules.smokingAllowed  },
    { label: 'Alcohol',         allowed: property.rules.alcoholAllowed  },
  ] : []
  const rulesAllowed = rules.filter(r => r.allowed)
  const rulesDenied  = rules.filter(r => !r.allowed)

  async function startChat() {
    try {
      await chatService.startConversation(id)
      navigate('/user?tab=messages')
    } catch {
      toast.error('Error', 'Could not start conversation')
    }
  }

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

      {/* max-w-7xl + px-4/sm:px-6 is the container 13 other pages already use.
          This page was the outlier at max-w-6xl with lg:px-8, which made it the
          narrowest content column in the app — ~1088px of usable width against
          everyone else's ~1232px. */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-24 lg:pb-10">

        {/* ── Top bar: Back + Actions ─────────────────────────────── */}
        <div className="flex items-center justify-between py-4">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back to properties</span>
            <span className="sm:hidden">Back</span>
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 transition-all"
            >
              <Share2 className="w-4 h-4" strokeWidth={1.8} />
              {copied ? 'Copied!' : 'Share'}
            </button>
            <button
              onClick={() => user ? saveMutation.mutate(!saved) : openLoginModal()}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all border ${saved ? 'bg-red-50 text-red-600 border-red-200' : 'text-slate-600 hover:bg-white hover:shadow-sm border-transparent hover:border-slate-200'}`}
            >
              <Heart className="w-4 h-4" fill={saved ? 'currentColor' : 'none'} strokeWidth={1.8} />
              {saved ? 'Saved' : 'Save'}
            </button>
          </div>
        </div>

        {/* ── Risk Alert ──────────────────────────────────────────── */}
        <RiskAlert riskScore={property.riskScore} />

        {/* ── Image Gallery ───────────────────────────────────────── */}
        <ImageGallery images={images} avail={avail} onOpenLightbox={setLightboxIdx} />

        {/* ── Two-column layout ────────────────────────────────────── */}
        <div className="mt-6 flex flex-col gap-6 lg:flex-row">

          {/* ── Main content column ─────────────────────────────────── */}
          <div className="min-w-0 flex-1 space-y-5">

            {/* Title block — sits above the sheet, not inside it, so the page's
                one h1 isn't visually boxed in with the detail sections. */}
            <div>
              <div className="mb-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs font-bold">
                {bhkLabel && <span className="text-brand-600">{bhkLabel}</span>}
                {property.furnished && (
                  <span className="font-semibold text-slate-400">· {formatFurnished(property.furnished)}</span>
                )}
                {property.type && (
                  <span className="font-semibold text-slate-400">· {formatType(property.type)}</span>
                )}
                {property.trustScore?.badge && (
                  <span className="ml-1"><TrustBadge badge={property.trustScore.badge} size="sm" /></span>
                )}
              </div>

              <h1 className="text-2xl font-bold leading-tight text-slate-900 sm:text-3xl">{property.title}</h1>

              <div className="mt-2.5 flex items-start gap-1.5 text-slate-500">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" strokeWidth={2} />
                <p className="text-sm leading-snug">
                  {property.address}, {property.city}, {property.state}
                  {property.pincode ? ` — ${property.pincode}` : ''}
                  {property.landmark ? <span className="text-slate-400"> · near {property.landmark}</span> : ''}
                </p>
              </div>

              {property.displayId && (
                <button
                  onClick={() => { navigator.clipboard.writeText(property.displayId) }}
                  title="Click to copy ID"
                  className="mt-2.5 inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-500 transition-colors hover:bg-slate-200"
                >
                  {property.displayId}
                  <Copy size={10} strokeWidth={2.5} />
                </button>
              )}
            </div>

            <Sheet>
              {/* At a glance */}
              {quickFacts.length > 0 && (
                <SheetSection>
                  <div className="grid grid-cols-2 gap-x-5 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
                    {quickFacts.map(f => <FactCell key={f.label} label={f.label} value={f.value} />)}
                  </div>
                </SheetSection>
              )}

              {/* About */}
              {property.description && (
                <SheetSection id="overview" title="About this home">
                  {/* The only long-form prose on the page. Grids and cards want
                      the full column; a paragraph running the whole width is
                      just hard to read, so this one caps its measure. */}
                  <p className="max-w-[70ch] whitespace-pre-line text-sm leading-relaxed text-slate-600">
                    {property.description}
                  </p>
                </SheetSection>
              )}

              {/* Amenities */}
              {property.amenities?.length > 0 && (
                <SheetSection id="amenities" title="What this place offers" badge={property.amenities.length}>
                  <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                    {property.amenities.map(a => {
                      const name = a.amenity?.name ?? a.amenityId
                      return (
                        <div key={a.amenityId ?? name} className="flex items-center gap-3">
                          <span className="shrink-0 text-brand-600"><AmenityIcon name={name} size={19} /></span>
                          <span className="min-w-0 truncate text-sm font-semibold text-slate-700">{name}</span>
                        </div>
                      )
                    })}
                  </div>
                </SheetSection>
              )}

              {/* House rules */}
              {rules.length > 0 && (
                <SheetSection
                  id="rules"
                  title="House rules"
                  subtitle="Set by the owner — confirm anything important before you visit."
                >
                  <div className="grid grid-cols-1 gap-x-5 gap-y-3.5 sm:grid-cols-2 lg:grid-cols-3">
                    {rulesAllowed.map(r => (
                      <div key={r.label} className="flex items-center gap-2.5">
                        <Check className="h-[18px] w-[18px] shrink-0 text-brand-600" strokeWidth={2.5} />
                        <span className="text-sm font-semibold text-slate-700">{r.label}</span>
                      </div>
                    ))}
                    {rulesDenied.map(r => (
                      <div key={r.label} className="flex items-center gap-2.5">
                        <X className="h-[18px] w-[18px] shrink-0 text-error-500" strokeWidth={2.5} />
                        <span className="text-sm font-semibold text-slate-400">No {r.label.toLowerCase()}</span>
                      </div>
                    ))}
                  </div>

                  {/* Gender preference + Curfew */}
                  {(property.rules.genderPreference !== 'ANY' || property.rules.curfewTime) && (
                    <div className="mt-4 space-y-2">
                      {property.rules.genderPreference && property.rules.genderPreference !== 'ANY' && (
                        <div className="flex items-center gap-2.5 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">!</span>
                          <span className="text-sm font-medium text-brand-700">
                            {property.rules.genderPreference === 'MALE' ? 'Male tenants only' : 'Female tenants only'}
                          </span>
                        </div>
                      )}
                      {property.rules.curfewTime && (
                        <div className="flex items-center gap-2.5 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
                          <Clock width={15} height={15} color="#d97706" strokeWidth={1.9} className="shrink-0" />
                          <span className="text-sm font-medium text-amber-800">Curfew at {property.rules.curfewTime}</span>
                        </div>
                      )}
                    </div>
                  )}
                </SheetSection>
              )}

              {/* Spatial intelligence — one mount, always here. The panel owns
                  its own heading, so this section deliberately has none.
                  The hand-authored "Neighbourhood intelligence" card that used
                  to sit alongside the commute calculator is gone: computed
                  cells and a human's estimate of an area are two different
                  claims, and showing them as sibling cards made the weaker one
                  look like the stronger one. The spatial modules are the single
                  source for area facts now. */}
              <SheetSection>
                <SpatialContextPanel
                  context={property.spatialContext}
                  coords={{ lat: property.lat, lng: property.lng }}
                >
                  <CommuteCalculator lat={property.lat} lng={property.lng} />
                </SpatialContextPanel>
              </SheetSection>

              {/* Location */}
              {property.lat && property.lng && (
                <SheetSection
                  title="Location"
                  action={
                    <a
                      href={directionsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-xs font-bold text-white no-underline transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1"
                    >
                      <Navigation className="h-3.5 w-3.5" strokeWidth={2.5} />
                      Directions
                    </a>
                  }
                >
                  <PropertyLocationMap lat={property.lat} lng={property.lng} />
                </SheetSection>
              )}

              {/* Owner */}
              {property.owner && (
                <SheetSection title="Listed by the owner">
                  <div className="flex items-start gap-4">
                    <Avatar src={property.owner.avatarUrl} name={property.owner.name || 'Owner'} size="lg" className="shrink-0 border border-slate-100" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base font-bold text-slate-900">
                        {property.owner.name ?? 'Owner'}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        Member since {new Date(property.owner.createdAt).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                          <Check className="h-3 w-3" strokeWidth={2.5} />
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
                </SheetSection>
              )}

              {/* Reviews */}
              <SheetSection id="reviews" title="Community reviews">
                <ReviewsSection propertyId={id} isOwner={isOwner} ownerInfo={property?.owner} />
              </SheetSection>
            </Sheet>

            {/* <lg: the sidebar is hidden — its cards render here instead.
                ActionCard takes a distinct formId because the fixed mobile
                bottom bar scrolls to this anchor. */}
            <div className="space-y-4 lg:hidden">
              <ActionCard
                formId="appointment-form-mobile"
                isOwner={isOwner}
                property={property}
                avail={avail}
                propertyId={id}
                user={user}
                onStartChat={startChat}
                onOpenLogin={openLoginModal}
                directionsUrl={directionsUrl}
              />
              <PricingCard property={property} />
              <div className="rounded-2xl border border-slate-100 bg-white p-5">
                <h3 className="mb-4 text-sm font-bold text-slate-800">Trust &amp; safety</h3>
                <TrustScoreWidget trustScore={property.trustScore} riskScore={property.riskScore} />
              </div>
            </div>

            {/* Report */}
            <div className="flex items-center justify-between py-3">
              <p className="text-xs text-slate-400">Something wrong with this listing?</p>
              <ReportButton propertyId={id} />
            </div>
          </div>

          {/* ── Right sidebar ───────────────────────────────────────────
              The column itself scrolls with the page — no nested scrollbar, no
              height cap. Two earlier attempts were both worse: making the whole
              column `sticky` pins it the moment its top hits the offset, so
              everything past the fold is unreachable; capping its height and
              scrolling it internally fixed that but put a scrollbar inside a
              scrollbar. Only the booking card sticks now, which is the one
              thing that actually benefits from following the reader. */}
          <aside className="hidden w-[340px] shrink-0 lg:block">
            <div className="space-y-4">

              {/* 1 — Owner: interested people / tenant: price + appointment.
                  First so the primary action is visible without scrolling. */}
              <div className="sticky top-4 z-10">
                <ActionCard
                  formId="appointment-form"
                  isOwner={isOwner}
                  property={property}
                  avail={avail}
                  propertyId={id}
                  user={user}
                  onStartChat={startChat}
                  onOpenLogin={openLoginModal}
                  directionsUrl={directionsUrl}
                />
              </div>

              {/* 2 — Pricing breakdown */}
              <PricingCard property={property} />

              {/* 3 — Trust & safety */}
              <div className="rounded-2xl border border-slate-100 bg-white p-5">
                <h3 className="mb-4 text-sm font-bold text-slate-800">Trust &amp; safety</h3>
                <TrustScoreWidget trustScore={property.trustScore} riskScore={property.riskScore} />
              </div>

              {/* 4 — Zero brokerage */}
              {!property.brokerage && (
                <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3.5">
                  <CircleCheckBig width={18} height={18} color="#059669" strokeWidth={1.9} className="shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-700">Zero brokerage</p>
                    <p className="text-xs text-emerald-600/70">Pay the owner directly — no middlemen fees.</p>
                  </div>
                </div>
              )}

            </div>
          </aside>
        </div>
      </div>

      {/* ── Mobile fixed bottom bar ─────────────────────────────── */}
      {!isOwner && (
        <div className="fixed bottom-0 left-0 right-0 z-40 flex items-center gap-3 border-t border-slate-200 bg-white px-4 py-3 shadow-lg lg:hidden">
          <div className="min-w-0 flex-none">
            <p className="text-lg font-bold text-slate-900">{formatRent(Number(property.rent))}</p>
            {!property.brokerage && <p className="text-[11px] font-semibold text-brand-700">Zero brokerage</p>}
          </div>
          {directionsUrl && (
            <a
              href={directionsUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Directions to this property"
              className="flex h-11 w-11 flex-none items-center justify-center rounded-xl border border-slate-200 bg-white transition-colors hover:bg-slate-50"
            >
              <Navigation className="h-4 w-4 text-brand-600" strokeWidth={2} />
            </a>
          )}
          {user ? (
            <button
              onClick={() => document.getElementById('appointment-form-mobile')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
              className="flex-1 rounded-xl bg-brand-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-brand-700"
            >
              Request a visit
            </button>
          ) : (
            <button
              onClick={openLoginModal}
              className="flex-1 rounded-xl bg-[#111111] px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-[#2a2a2a]"
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
