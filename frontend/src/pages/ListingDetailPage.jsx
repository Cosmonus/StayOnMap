import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { propertyService } from '@services/property.service'
import { appointmentService } from '@services/appointment.service'
import { formatRent, formatCurrency } from '@utils/format'
import { confirm } from '@components/common/ConfirmDialog'
import { toast } from '@components/common/Toaster'
import Modal from '@components/common/Modal'
import EditListingForm from '@features/listings/components/EditListingForm'
import VerificationWizard from '@features/listings/components/VerificationWizard'

// ── Constants ─────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  ACTIVE:    { label: 'Active',    bg: 'bg-green-50',  text: 'text-green-700',  dot: 'bg-green-500' },
  DRAFT:     { label: 'Draft',     bg: 'bg-slate-100', text: 'text-slate-600',  dot: 'bg-slate-400' },
  PENDING:   { label: 'In Review', bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-400' },
  INACTIVE:  { label: 'Inactive',  bg: 'bg-slate-100', text: 'text-slate-500',  dot: 'bg-slate-400' },
  SUSPENDED: { label: 'Suspended', bg: 'bg-red-50',    text: 'text-red-600',    dot: 'bg-red-500' },
  REJECTED:  { label: 'Rejected',  bg: 'bg-red-50',    text: 'text-red-600',    dot: 'bg-red-500' },
}

const AMENITY_ICON = {
  'WiFi':'📶','Parking':'🅿️','AC':'❄️','Lift':'🛗','Gym':'🏋️','CCTV':'📷',
  'Power Backup':'🔋','Kitchen':'🍳','Washing Machine':'🫧','Pet Friendly':'🐾',
  'Security Guard':'💂','Swimming Pool':'🏊','Gas Pipeline':'🔥','Gated Security':'🔒',
  'Rainwater Harvesting':'💧',
}

const APPT_STATUS = {
  PENDING:     { bg: 'bg-amber-50',  text: 'text-amber-700',  label: 'Pending' },
  ACCEPTED:    { bg: 'bg-green-50',  text: 'text-green-700',  label: 'Accepted' },
  REJECTED:    { bg: 'bg-red-50',    text: 'text-red-600',    label: 'Rejected' },
  RESCHEDULED: { bg: 'bg-blue-50',   text: 'text-blue-700',   label: 'Rescheduled' },
  CANCELLED:   { bg: 'bg-slate-100', text: 'text-slate-500',  label: 'Cancelled' },
}

const FURNISHED_LABEL = { FULLY: 'Fully Furnished', SEMI: 'Semi Furnished', UNFURNISHED: 'Unfurnished' }
const GENDER_LABEL    = { ANY: 'Any Gender', MALE: 'Male Only', FEMALE: 'Female Only', FAMILY: 'Families Only' }
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const FULL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa']

// ── Helpers ───────────────────────────────────────────────────────────────────
function Svg({ d, className = 'w-4 h-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}

function Label({ children }) {
  return <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{children}</p>
}

function Chip({ children, color }) {
  const cls = color === 'green'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
    : 'bg-slate-100 text-slate-600 border-slate-200'
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold border ${cls}`}>
      {children}
    </span>
  )
}

function TermCard({ label, value }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-xs font-bold text-slate-800">{value}</p>
    </div>
  )
}

// ── Mini calendar ─────────────────────────────────────────────────────────────
function MiniCalendar({ appointments, selectedDate, onSelect }) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1)
  })
  const yr = cursor.getFullYear()
  const mo = cursor.getMonth()
  const apptDates = new Set(appointments.map(a => {
    const d = new Date(a.requestedDate)
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
  }))
  const firstDay    = new Date(yr, mo, 1).getDay()
  const daysInMonth = new Date(yr, mo + 1, 0).getDate()
  const today       = new Date()
  const cells = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => new Date(yr, mo, i + 1))]
  function key(d) { return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}` }

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => setCursor(new Date(yr, mo - 1, 1))}
          className="w-6 h-6 rounded hover:bg-slate-100 flex items-center justify-center text-slate-400">
          <Svg d="M15 18l-6-6 6-6" className="w-3 h-3" />
        </button>
        <span className="text-xs font-bold text-slate-700">{FULL_MONTHS[mo]} {yr}</span>
        <button onClick={() => setCursor(new Date(yr, mo + 1, 1))}
          className="w-6 h-6 rounded hover:bg-slate-100 flex items-center justify-center text-slate-400">
          <Svg d="M9 18l6-6-6-6" className="w-3 h-3" />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => <div key={d} className="text-center text-[9px] font-semibold text-slate-400">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-px">
        {cells.map((date, i) => {
          if (!date) return <div key={`e-${i}`} />
          const hasAppt  = apptDates.has(key(date))
          const isSelDay = selectedDate && key(selectedDate) === key(date)
          const isToday  = key(today) === key(date)
          return (
            <button key={key(date)} onClick={() => onSelect(isSelDay ? null : date)}
              className={`relative aspect-square flex items-center justify-center rounded text-[11px] font-medium transition-all
                ${isSelDay ? 'bg-[#111111] text-white'
                : isToday  ? 'bg-brand-50 text-brand-700 font-bold'
                : hasAppt  ? 'text-slate-800 hover:bg-slate-100'
                :             'text-slate-400 hover:bg-slate-50'}`}>
              {date.getDate()}
              {hasAppt && !isSelDay && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-0.5 h-0.5 rounded-full bg-brand-500" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Tenant profile ────────────────────────────────────────────────────────────
function TenantProfile({ appt, onBack, onAction, acting }) {
  const t         = appt.tenant ?? {}
  const initial   = (t.name ?? t.email ?? '?')[0].toUpperCase()
  const isPending = appt.status === 'PENDING'
  const st        = APPT_STATUS[appt.status] ?? APPT_STATUS.PENDING

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-700 mb-4">
        <Svg d="M19 12H5M12 5l-7 7 7 7" className="w-3.5 h-3.5" /> Back
      </button>

      <div className="flex items-center gap-3 mb-4 p-3 bg-slate-50 rounded-xl">
        {t.avatarUrl ? (
          <img src={t.avatarUrl} alt="" className="w-12 h-12 rounded-full object-cover shrink-0 border border-slate-200" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-[#111111] text-white text-lg font-bold flex items-center justify-center shrink-0">
            {initial}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900 truncate">{t.name || 'Unknown'}</p>
          {t.email && <p className="text-xs text-slate-400 truncate">{t.email}</p>}
          <span className={`mt-1 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${st.bg} ${st.text}`}>
            {st.label}
          </span>
        </div>
      </div>

      <div className="divide-y divide-slate-50 mb-3">
        {[
          { label: 'Phone', value: appt.contactNumber ? `+91 ${appt.contactNumber}` : '—' },
          { label: 'Date',  value: new Date(appt.requestedDate).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) },
          { label: 'Time',  value: appt.requestedTime },
        ].map(({ label, value }) => (
          <div key={label} className="flex justify-between items-center py-2">
            <span className="text-xs text-slate-400">{label}</span>
            <span className="text-xs font-semibold text-slate-800">{value}</span>
          </div>
        ))}
      </div>

      {t.bio && (
        <div className="bg-slate-50 rounded-lg px-3 py-2 mb-2">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">About</p>
          <p className="text-xs text-slate-600 leading-relaxed">{t.bio}</p>
        </div>
      )}

      {appt.message && (
        <div className="bg-brand-50 rounded-lg px-3 py-2 mb-2">
          <p className="text-[9px] font-bold text-brand-400 uppercase tracking-wide mb-0.5">Message</p>
          <p className="text-xs text-slate-700 leading-relaxed">{appt.message}</p>
        </div>
      )}

      {isPending && (
        <div className="flex gap-2 mt-4">
          <button onClick={() => onAction(appt.id, 'ACCEPTED')} disabled={acting}
            className="flex-1 py-2 rounded-xl bg-[#111111] text-white text-xs font-bold hover:bg-[#2a2a2a] disabled:opacity-50 transition-colors">
            Accept
          </button>
          <button onClick={() => onAction(appt.id, 'REJECTED')} disabled={acting}
            className="flex-1 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 disabled:opacity-50 transition-colors">
            Reject
          </button>
        </div>
      )}
    </div>
  )
}

// ── Appointment sidebar ───────────────────────────────────────────────────────
function AppointmentSidebar({ propertyId }) {
  const qc = useQueryClient()
  const [selectedDate, setSelectedDate] = useState(null)
  const [viewTenant, setViewTenant]     = useState(null)
  const [acting, setActing]             = useState(false)

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ['property-appointments', propertyId],
    queryFn: () => appointmentService.forProperty(propertyId).then(r => r.data),
  })

  const { mutate: updateAppt } = useMutation({
    mutationFn: ({ id, status }) => appointmentService.updateStatus(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['property-appointments', propertyId] })
      qc.invalidateQueries({ queryKey: ['owner-appointments'] })
      toast.success('Updated', 'Appointment status changed')
      setActing(false)
      setViewTenant(null)
    },
    onError: () => { toast.error('Error', 'Failed to update'); setActing(false) },
  })

  function handleAction(id, status) { setActing(true); updateAppt({ id, status }) }

  const pendingCount  = appointments.filter(a => a.status === 'PENDING').length
  const acceptedCount = appointments.filter(a => a.status === 'ACCEPTED').length
  const dateKey       = d => { const dt = new Date(d); return `${dt.getFullYear()}-${dt.getMonth()}-${dt.getDate()}` }
  const dayAppts = selectedDate
    ? appointments.filter(a => dateKey(a.requestedDate) === dateKey(selectedDate))
    : [...appointments].sort((a, b) => new Date(a.requestedDate) - new Date(b.requestedDate))

  return (
    <div className="w-80 shrink-0 flex flex-col bg-white border-l border-slate-100 h-[calc(100vh-57px)] sticky top-[57px]">

      {/* Stats */}
      <div className="px-4 py-4 border-b border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-800">Appointments</h3>
          {appointments.length > 0 && <span className="text-xs text-slate-400">{appointments.length} total</span>}
        </div>
        {isLoading ? (
          <div className="h-12 bg-slate-100 rounded-xl animate-pulse" />
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {[
              { count: pendingCount,        label: 'Pending',  bg: 'bg-amber-50',  num: 'text-amber-700',  sub: 'text-amber-400' },
              { count: acceptedCount,       label: 'Accepted', bg: 'bg-green-50',  num: 'text-green-700',  sub: 'text-green-400' },
              { count: appointments.length, label: 'Total',    bg: 'bg-slate-100', num: 'text-slate-700',  sub: 'text-slate-400' },
            ].map(({ count, label, bg, num, sub }) => (
              <div key={label} className={`${bg} rounded-xl p-2.5 text-center`}>
                <p className={`text-xl font-bold ${num}`}>{count}</p>
                <p className={`text-[9px] font-semibold ${sub} mt-0.5`}>{label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Calendar */}
      {!viewTenant && (
        <div className="px-4 py-4 border-b border-slate-100">
          <MiniCalendar appointments={appointments} selectedDate={selectedDate} onSelect={setSelectedDate} />
        </div>
      )}

      {/* List / tenant profile */}
      <div className="flex-1 overflow-y-auto p-4">
        {viewTenant ? (
          <TenantProfile appt={viewTenant} onBack={() => setViewTenant(null)} onAction={handleAction} acting={acting} />
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              {selectedDate ? (
                <>
                  <p className="text-xs font-bold text-slate-600">
                    {selectedDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                  </p>
                  <button onClick={() => setSelectedDate(null)} className="text-[10px] text-brand-600 font-semibold hover:underline">
                    Show all
                  </button>
                </>
              ) : (
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">All Visits</p>
              )}
            </div>

            {isLoading ? (
              <div className="space-y-2">
                {[1,2].map(i => <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />)}
              </div>
            ) : dayAppts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-300 mb-2">
                  <Svg d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" className="w-5 h-5" />
                </div>
                <p className="text-xs text-slate-400">
                  {selectedDate ? 'No visits on this date.' : 'No appointments yet.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {dayAppts.map(a => {
                  const t  = a.tenant ?? {}
                  const st = APPT_STATUS[a.status] ?? APPT_STATUS.PENDING
                  const initial = (t.name ?? t.email ?? '?')[0].toUpperCase()
                  return (
                    <button key={a.id} onClick={() => setViewTenant(a)}
                      className="w-full flex items-center gap-2.5 p-3 bg-slate-50 border border-slate-100 rounded-xl hover:border-slate-200 hover:bg-white hover:shadow-sm transition-all text-left">
                      {t.avatarUrl ? (
                        <img src={t.avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-slate-800 text-white text-xs font-bold flex items-center justify-center shrink-0">
                          {initial}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800 truncate">{t.name || t.email || 'Unknown'}</p>
                        <p className="text-[10px] text-slate-400">
                          {MONTHS[new Date(a.requestedDate).getMonth()]} {new Date(a.requestedDate).getDate()} · {a.requestedTime}
                        </p>
                      </div>
                      <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-bold ${st.bg} ${st.text}`}>
                        {st.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ListingDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [imgIdx, setImgIdx]             = useState(0)
  const [editOpen, setEditOpen]         = useState(false)
  const [verifyOpen, setVerifyOpen]     = useState(false)

  const { data: property, isLoading } = useQuery({
    queryKey: ['listing-detail', id],
    queryFn: () => propertyService.getById(id).then(r => r.data),
  })

  const { mutate: publish, isPending: publishing } = useMutation({
    mutationFn: () => propertyService.publish(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['listing-detail', id] }); qc.invalidateQueries({ queryKey: ['my-listings'] }); toast.success('Submitted', 'Listing sent for review') },
    onError: () => toast.error('Error', 'Failed to publish'),
  })

  const { mutate: toggle, isPending: toggling } = useMutation({
    mutationFn: () => propertyService.toggleStatus(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['listing-detail', id] }); qc.invalidateQueries({ queryKey: ['my-listings'] }); toast.success('Updated', 'Status changed') },
    onError: () => toast.error('Error', 'Failed to update'),
  })

  const { mutate: remove, isPending: removing } = useMutation({
    mutationFn: () => propertyService.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['my-listings'] }); toast.success('Deleted', 'Listing removed'); navigate('/user?tab=my-listings') },
    onError: () => toast.error('Error', 'Failed to delete'),
  })

  async function handleDelete() {
    const yes = await confirm({ title: 'Delete listing?', message: 'Permanently removes this listing and all its data.', confirmLabel: 'Delete', variant: 'danger' })
    if (!yes) return
    remove()
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
      </div>
    )
  }

  if (!property) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3">
        <p className="text-slate-500 text-sm">Listing not found.</p>
        <button onClick={() => navigate('/user?tab=my-listings')} className="text-xs text-brand-600 hover:underline">
          ← Back to My Listings
        </button>
      </div>
    )
  }

  const images    = property.images ?? []
  const amenities = property.amenities ?? []
  const rules     = property.rules
  const { status } = property
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.DRAFT
  const busy = publishing || toggling || removing

  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* ── Sticky header ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 md:px-6 h-[57px] flex items-center gap-3">
        <button onClick={() => navigate('/user?tab=my-listings')}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors shrink-0">
          <Svg d="M19 12H5M12 5l-7 7 7 7" className="w-3.5 h-3.5" />
          My Listings
        </button>

        <span className="text-slate-300">/</span>

        <p className="text-sm font-semibold text-slate-800 truncate flex-1 min-w-0">{property.title}</p>

        <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.bg} ${cfg.text}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />{cfg.label}
        </span>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <HeaderBtn onClick={() => setEditOpen(true)} disabled={busy}>Edit</HeaderBtn>

          {(status === 'DRAFT' || status === 'REJECTED') && (
            <HeaderBtn onClick={() => publish()} disabled={busy} variant="primary">
              {status === 'REJECTED' ? 'Re-publish' : 'Submit'}
            </HeaderBtn>
          )}

          {status === 'ACTIVE' && (
            <HeaderBtn onClick={() => toggle()} disabled={busy}>Deactivate</HeaderBtn>
          )}

          {status === 'INACTIVE' && (
            <HeaderBtn onClick={() => toggle()} disabled={busy} variant="dark">Activate</HeaderBtn>
          )}

          {(status === 'ACTIVE' || status === 'DRAFT' || status === 'INACTIVE') && (
            <HeaderBtn onClick={() => setVerifyOpen(true)} disabled={busy} variant="indigo">Verify</HeaderBtn>
          )}

          <HeaderBtn onClick={handleDelete} disabled={busy} variant="danger">Delete</HeaderBtn>
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: property content */}
        <div className="flex-1 overflow-y-auto min-w-0">

          {/* Hero image */}
          <div className="relative h-72 bg-slate-100">
            {images.length > 0 ? (
              <img src={images[imgIdx].url} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-200">
                <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
              </div>
            )}
            {images.length > 1 && (
              <>
                <button onClick={() => setImgIdx(i => (i - 1 + images.length) % images.length)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center transition-colors">
                  <Svg d="M15 18l-6-6 6-6" className="w-4 h-4 text-white" />
                </button>
                <button onClick={() => setImgIdx(i => (i + 1) % images.length)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center transition-colors">
                  <Svg d="M9 18l6-6-6-6" className="w-4 h-4 text-white" />
                </button>
                <span className="absolute bottom-3 right-3 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
                  {imgIdx + 1}/{images.length}
                </span>
              </>
            )}
          </div>

          {/* Thumbnail strip */}
          {images.length > 1 && (
            <div className="flex gap-2 px-6 py-3 border-b border-slate-100 overflow-x-auto bg-slate-50">
              {images.map((img, i) => (
                <button key={i} onClick={() => setImgIdx(i)}
                  className={`w-14 h-10 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${i === imgIdx ? 'border-[#111111]' : 'border-transparent opacity-50 hover:opacity-80'}`}>
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {/* Content */}
          <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">

            {/* Title + price */}
            <div>
              <h1 className="text-2xl font-bold text-slate-900 mb-1">{property.title}</h1>
              {property.displayId && <p className="text-[10px] font-mono text-slate-400 tracking-widest mb-3">{property.displayId}</p>}
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-3xl font-bold text-brand-600">{formatRent(Number(property.rent))}</span>
                {property.deposit > 0 && (
                  <span className="text-sm text-slate-400">{formatCurrency(Number(property.deposit))} deposit</span>
                )}
              </div>
            </div>

            {/* Location */}
            {(property.address || property.city) && (
              <div className="flex items-start gap-2 text-sm text-slate-600">
                <Svg d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z" className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
                <span>
                  {[property.address, property.city, property.state, property.pincode].filter(Boolean).join(', ')}
                  {property.landmark && <span className="text-slate-400"> · Near {property.landmark}</span>}
                </span>
              </div>
            )}

            {/* Stat chips */}
            <div className="flex flex-wrap gap-2">
              {property.bhk       && <Chip>🏠 {property.bhk} BHK</Chip>}
              {property.type      && <Chip>🏷️ {property.type.replace(/_/g, ' ')}</Chip>}
              {property.furnished && <Chip>🛋️ {FURNISHED_LABEL[property.furnished]}</Chip>}
              {property.area      && <Chip>📐 {property.area} sq ft</Chip>}
              {property.availableFrom && (
                <Chip color="green">
                  📅 From {new Date(property.availableFrom).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Chip>
              )}
            </div>

            {/* Description */}
            {property.description && (
              <div>
                <Label>Description</Label>
                <p className="text-sm text-slate-600 leading-relaxed">{property.description}</p>
              </div>
            )}

            {/* Pricing */}
            <div>
              <Label>Pricing Breakdown</Label>
              <div className="rounded-xl border border-slate-100 overflow-hidden divide-y divide-slate-50">
                {[
                  ['Monthly Rent',    formatCurrency(Number(property.rent))],
                  ['Security Deposit', property.deposit > 0 ? formatCurrency(Number(property.deposit)) : 'None'],
                  ['Maintenance',     property.maintenance ? formatCurrency(Number(property.maintenance)) + '/mo' : 'Not included'],
                  ['Electricity',     property.electricityCharges ? formatCurrency(Number(property.electricityCharges)) + '/mo' : 'As per usage'],
                  ['Water',           property.waterCharges ? formatCurrency(Number(property.waterCharges)) + '/mo' : 'Included'],
                  ['Brokerage',       property.brokerage === 0 ? 'None' : property.brokerage ? formatCurrency(Number(property.brokerage)) : 'Not specified'],
                ].map(([l, v]) => (
                  <div key={l} className="flex justify-between items-center px-4 py-3">
                    <span className="text-sm text-slate-500">{l}</span>
                    <span className="text-sm font-semibold text-slate-800">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Lease terms */}
            {(property.leaseDuration || property.occupancyLimit || rules?.genderPreference || rules?.curfewTime) && (
              <div>
                <Label>Lease Terms</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {property.leaseDuration  && <TermCard label="Duration"   value={`${property.leaseDuration} months`} />}
                  {property.occupancyLimit && <TermCard label="Occupancy"  value={`${property.occupancyLimit} person${property.occupancyLimit > 1 ? 's' : ''}`} />}
                  {rules?.genderPreference && <TermCard label="Gender"     value={GENDER_LABEL[rules.genderPreference] ?? rules.genderPreference} />}
                  {rules?.curfewTime       && <TermCard label="Curfew"     value={rules.curfewTime} />}
                </div>
              </div>
            )}

            {/* Amenities */}
            {amenities.length > 0 && (
              <div>
                <Label>Amenities</Label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {amenities.map(a => {
                    const name = a.amenity?.name ?? a.amenityId
                    return (
                      <div key={name} className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-700 font-medium">
                        <span className="text-base leading-none">{AMENITY_ICON[name] ?? '✓'}</span>
                        <span className="truncate">{name}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Rules */}
            {rules && (
              <div>
                <Label>House Rules</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { icon: '🍖', label: 'Non-veg Cooking', v: rules.nonVegAllowed },
                    { icon: '👤', label: 'Bachelors', v: rules.bachelorAllowed },
                    { icon: '🚪', label: 'Visitors',  v: rules.visitorsAllowed },
                    { icon: '🐾', label: 'Pets',      v: rules.petsAllowed },
                    { icon: '🚬', label: 'Smoking',   v: rules.smokingAllowed },
                    { icon: '🍺', label: 'Alcohol',   v: rules.alcoholAllowed },
                  ].map(({ icon, label, v }) => (
                    <div key={label} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border ${v ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                      <span className="text-sm shrink-0">{icon}</span>
                      <span className={`text-xs font-medium flex-1 ${v ? 'text-slate-800' : 'text-slate-400'}`}>{label}</span>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${v ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          {v ? <path d="M20 6L9 17l-5-5" /> : <path d="M18 6L6 18M6 6l12 12" />}
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: appointments sidebar */}
        <AppointmentSidebar propertyId={id} />
      </div>

      {/* ── Edit modal ─────────────────────────────────────────────── */}
      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title="Edit Listing" size="xl">
        {editOpen && (
          <EditListingForm
            property={property}
            onSuccess={() => {
              setEditOpen(false)
              qc.invalidateQueries({ queryKey: ['listing-detail', id] })
            }}
          />
        )}
      </Modal>

      {/* ── Verify modal ───────────────────────────────────────────── */}
      <Modal isOpen={verifyOpen} onClose={() => setVerifyOpen(false)} title="Verify Ownership" size="lg">
        {verifyOpen && (
          <VerificationWizard property={property} onClose={() => setVerifyOpen(false)} />
        )}
      </Modal>
    </div>
  )
}

// ── Header button helper ──────────────────────────────────────────────────────
const HEADER_BTN = {
  default: 'text-slate-600 bg-slate-100 hover:bg-slate-200',
  primary: 'text-white bg-brand-600 hover:bg-brand-700',
  dark:    'text-white bg-[#111111] hover:bg-[#2a2a2a]',
  indigo:  'text-indigo-600 bg-indigo-50 hover:bg-indigo-100',
  danger:  'text-red-600 bg-red-50 hover:bg-red-100',
}

function HeaderBtn({ children, onClick, variant = 'default', disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 ${HEADER_BTN[variant]}`}
    >
      {children}
    </button>
  )
}
