import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Home, User, Users, Calendar, Check, MessageCircle, Heart, Phone,
  ChevronRight, ChevronLeft, ArrowLeft, Map as MapIcon, ImageOff,
  Ruler, Layers, Compass, Clipboard, CircleCheck, ChefHat, DoorOpen,
  PawPrint, Cigarette, Wine, X, Clock,
} from 'lucide-react'
import { propertyService } from '@services/property.service'
import { appointmentService } from '@services/appointment.service'
import { formatRent, formatCurrency } from '@utils/format'
import { confirm } from '@components/common/ConfirmDialog'
import { toast } from '@components/common/Toaster'
import Modal from '@components/common/Modal'
import PropertyStatusPill from '@components/common/PropertyStatusPill'
import { googleMapsReady, createHtmlMarker } from '@lib/googleMaps'
import EditListingForm from './EditListingForm'
import VerificationWizard from './VerificationWizard'
import { AmenityIcon } from '@components/common/AmenityIcon'
import TrustScoreWidget from '@features/trust/components/TrustScoreWidget'
import ReviewsSection   from '@features/reviews/components/ReviewsSection'
import RiskAlert        from '@components/common/RiskAlert'

const APPT_STATUS = {
  PENDING:     { bg: 'bg-amber-50',  text: 'text-amber-700',  label: 'Pending' },
  ACCEPTED:    { bg: 'bg-green-50',  text: 'text-green-700',  label: 'Accepted' },
  REJECTED:    { bg: 'bg-red-50',    text: 'text-red-600',    label: 'Rejected' },
  RESCHEDULED: { bg: 'bg-blue-50',   text: 'text-blue-700',   label: 'Rescheduled' },
  CANCELLED:   { bg: 'bg-slate-100', text: 'text-slate-500',  label: 'Cancelled' },
}

const FURNISHED_LABEL = { FULLY: '🛋️ Fully Furnished', SEMI: '🪑 Semi Furnished', UNFURNISHED: '📦 Unfurnished' }
const TYPE_EMOJI = { APARTMENT: '🏢', HOUSE: '🏠', VILLA: '🏡', PG: '🏘️', INDEPENDENT_HOUSE: '🏠', COMMERCIAL: '🏪' }
const GENDER_LABEL    = { ANY: 'Any Gender', MALE: 'Male Only', FEMALE: 'Female Only', FAMILY: 'Families Only' }

function SectionLabel({ children }) {
  return <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{children}</p>
}

function OwnerCard({ title, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5">
      {title && <h3 className="text-base font-bold text-slate-900 mb-4">{title}</h3>}
      {children}
    </div>
  )
}

function PriceRow({ label, value, accent }) {
  if (!value) return null
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-slate-50 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-sm font-semibold ${accent ? 'text-brand-600' : 'text-slate-800'}`}>{value}</span>
    </div>
  )
}

const BTN_VARIANT = {
  default: 'text-slate-600 bg-slate-100 hover:bg-slate-200',
  primary: 'text-white bg-brand-600 hover:bg-brand-700',
  dark:    'text-white bg-[#111111] hover:bg-[#2a2a2a]',
  indigo:  'text-indigo-600 bg-indigo-50 hover:bg-indigo-100',
  danger:  'text-red-600 bg-red-50 hover:bg-red-100',
}

function Btn({ children, onClick, variant = 'default', disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 ${BTN_VARIANT[variant]}`}>
      {children}
    </button>
  )
}

function Avatar({ name, email, avatarUrl, size = 'md' }) {
  const initial = (name || email || '?')[0].toUpperCase()
  const sz = size === 'lg' ? 'w-12 h-12 text-lg' : size === 'sm' ? 'w-7 h-7 text-[11px]' : 'w-9 h-9 text-sm'
  if (avatarUrl) return <img src={avatarUrl} alt="" className={`${sz} rounded-full object-cover shrink-0 border border-slate-200`} />
  return (
    <div className={`${sz} rounded-full bg-slate-800 text-white font-bold flex items-center justify-center shrink-0`}>
      {initial}
    </div>
  )
}

// ── Aggregate all users who interacted with this property ─────────────────────
function aggregatePropertyUsers(contacts) {
  const userMap = new Map()
  for (const a of contacts.appointments ?? []) {
    const t = a.tenant
    if (!t) continue
    if (!userMap.has(t.id)) userMap.set(t.id, { ...t })
  }
  for (const c of contacts.conversations ?? []) {
    const t = c.tenant
    if (!t) continue
    if (!userMap.has(t.id)) userMap.set(t.id, { ...t })
  }
  return [...userMap.values()]
}

function buildUserStats(contacts) {
  const allUsers = aggregatePropertyUsers(contacts)
  return allUsers.map(u => {
    const appts = (contacts.appointments ?? []).filter(a => (a.tenant?.id || a.tenantId) === u.id)
    const visited = appts.filter(a => a.status === 'ACCEPTED').length
    const hasConvo = (contacts.conversations ?? []).some(c => c.tenant?.id === u.id || c.tenantId === u.id)
    const savedEntry = (contacts.savedBy ?? []).find(s => s.userId === u.id)
    return { ...u, appointmentCount: appts.length, visitedCount: visited, hasConversation: hasConvo, savedAt: savedEntry?.createdAt ?? null }
  })
}

// ── Col 2: People who contacted ───────────────────────────────────────────────
function TenantList({ contacts, selectedTenantId, onSelect }) {
  const userStats = buildUserStats(contacts)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* List */}
      <div className="flex-1 overflow-y-auto thin-scrollbar min-h-0">
        {userStats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16 text-center px-4">
            <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
              <Users className="w-5 h-5 text-slate-400" strokeWidth={1.8} />
            </div>
            <p className="text-sm font-semibold text-slate-400">No contacts yet</p>
            <p className="text-xs text-slate-300 mt-1">People who reach out will appear here</p>
          </div>
        ) : (
          <div className="p-3 space-y-2">
            {userStats.map(u => {
              const selected = selectedTenantId === u.id
              const displayName = u.name || u.email?.split('@')[0] || 'Unknown'
              return (
                <button key={u.id} onClick={() => onSelect(selected ? null : u.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                    selected
                      ? 'border-brand-300 bg-brand-50 shadow-sm ring-1 ring-brand-200'
                      : 'bg-white border-slate-100 hover:bg-slate-50 hover:border-slate-200'
                  }`}>
                  <div className="flex items-center gap-3">
                    <Avatar name={u.name} email={u.email} avatarUrl={u.avatarUrl} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{displayName}</p>
                      <p className="text-xs text-slate-500 truncate mt-0.5">{u.email}</p>
                    </div>
                    <ChevronRight
                      size={14}
                      color={selected ? '#6366f1' : '#94a3b8'}
                      strokeWidth={2}
                      className={`shrink-0 transition-transform ${selected ? 'rotate-90' : ''}`}
                    />
                  </div>
                  <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 border border-blue-100 text-[11px] font-semibold text-blue-700">
                      <Calendar className="w-3 h-3" strokeWidth={1.8} />
                      {u.appointmentCount} appt{u.appointmentCount !== 1 ? 's' : ''}
                    </span>
                    {u.visitedCount > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-50 border border-green-100 text-[11px] font-semibold text-green-700">
                        <Check className="w-3 h-3" strokeWidth={1.8} /> visited
                      </span>
                    )}
                    {u.hasConversation && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 border border-purple-100 text-[11px] font-semibold text-purple-700">
                        <MessageCircle className="w-3 h-3" strokeWidth={1.8} /> chatted
                      </span>
                    )}
                    {u.savedAt && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 border border-rose-100 text-[11px] font-semibold text-rose-600">
                        <Heart className="w-3 h-3" strokeWidth={1.8} /> saved
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Col 3: Selected user's activity ──────────────────────────────────────────
function TenantDetail({ tenant, contacts, ownerId, onAction, acting }) {
  if (!tenant) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-16 text-center px-4">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <User className="w-6 h-6 text-slate-300" strokeWidth={1.8} />
        </div>
        <p className="text-sm font-semibold text-slate-700">Select a user</p>
        <p className="text-sm text-slate-500 mt-1 max-w-[220px]">Click on someone from the list to view their activity</p>
      </div>
    )
  }

  const tenantId = tenant.id
  const userAppointments = (contacts.appointments ?? []).filter(a => (a.tenant?.id || a.tenantId) === tenantId)
  const sortedAppts = [...userAppointments].sort((a, b) => new Date(b.requestedDate) - new Date(a.requestedDate))
  const userConversation = (contacts.conversations ?? []).find(c => c.tenant?.id === tenantId || c.tenantId === tenantId)
  const userMessages = userConversation ? [...(userConversation.messages ?? [])].reverse() : []
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* User header */}
      <div className="shrink-0 px-4 py-4 border-b border-slate-100 bg-slate-50/60">
        <div className="flex items-center gap-3">
          <Avatar name={tenant.name} email={tenant.email} avatarUrl={tenant.avatarUrl} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-900 truncate">{tenant.name || 'Unknown'}</p>
            {tenant.email && <p className="text-xs text-slate-400 truncate mt-0.5">{tenant.email}</p>}
            {tenant.phone && <p className="text-xs text-slate-400 mt-0.5">+91 {tenant.phone}</p>}
          </div>
        </div>
      </div>

      {/* Activity sections */}
      <div className="flex-1 overflow-y-auto thin-scrollbar p-4 space-y-6 min-h-0">

        {/* Appointments */}
        <div>
          <SectionLabel>Appointments ({sortedAppts.length})</SectionLabel>
          {sortedAppts.length > 0 ? (
            <div className="space-y-2.5">
              {sortedAppts.map(appt => {
                const st = APPT_STATUS[appt.status] ?? APPT_STATUS.PENDING
                const isPending = appt.status === 'PENDING'
                return (
                  <div key={appt.id} className="p-3.5 rounded-xl border border-slate-100 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.8} />
                        <span className="text-sm font-medium text-slate-700">
                          {fmtDate(appt.requestedDate)}
                          {appt.requestedTime && <span className="text-slate-400 font-normal"> at {appt.requestedTime}</span>}
                        </span>
                      </div>
                      <span className={`shrink-0 px-2 py-0.5 rounded-md text-[11px] font-semibold ${st.bg} ${st.text}`}>{st.label}</span>
                    </div>
                    {appt.contactNumber && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <Phone className="w-3 h-3 text-slate-400 shrink-0" strokeWidth={1.8} />
                        {appt.contactNumber}
                      </div>
                    )}
                    {appt.message && (
                      <div className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                        <p className="text-xs text-slate-500 font-medium mb-0.5">Message</p>
                        <p className="text-sm text-slate-700">{appt.message}</p>
                      </div>
                    )}
                    {appt.ownerNote && (
                      <div className="bg-brand-50 rounded-lg px-3 py-2 border border-brand-100">
                        <p className="text-xs text-brand-500 font-medium mb-0.5">Your note</p>
                        <p className="text-sm text-brand-700">{appt.ownerNote}</p>
                      </div>
                    )}
                    {isPending && (
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => onAction(appt.id, 'ACCEPTED')} disabled={acting}
                          className="flex-1 py-1.5 rounded-lg bg-[#111111] text-white text-xs font-bold hover:bg-[#2a2a2a] disabled:opacity-50 transition-colors">
                          Accept
                        </button>
                        <button onClick={() => onAction(appt.id, 'REJECTED')} disabled={acting}
                          className="flex-1 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 disabled:opacity-50 transition-colors">
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500 py-3">No appointments from this user</p>
          )}
        </div>

        {/* Conversation */}
        <div>
          <SectionLabel>Conversation ({userMessages.length} messages)</SectionLabel>
          {userMessages.length > 0 ? (
            <div className="rounded-xl border border-slate-100 overflow-hidden bg-slate-50">
              <div className="px-4 py-4 space-y-3 max-h-96 overflow-y-auto thin-scrollbar">
                {userMessages.map(m => {
                  const isOwner = m.senderId === ownerId
                  const senderLabel = m.sender?.name || (isOwner ? 'You' : (tenant.name || tenant.email?.split('@')[0] || 'Tenant'))
                  return (
                    <div key={m.id} className={`flex ${isOwner ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 shadow-sm ${isOwner ? 'bg-brand-600 text-white' : 'bg-white border border-slate-200 text-slate-800'}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-semibold ${isOwner ? 'text-white/80' : 'text-slate-500'}`}>{senderLabel}</span>
                          <span className={`text-[10px] ${isOwner ? 'text-white/50' : 'text-slate-400'}`}>
                            {new Date(m.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className={`text-sm leading-relaxed ${isOwner ? 'text-white' : 'text-slate-700'}`}>{m.body}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500 py-3">No chat history</p>
          )}
        </div>

      </div>
    </div>
  )
}

// ── Location map card ─────────────────────────────────────────────────────────
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
    <div className="bg-white rounded-2xl border border-slate-100 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-bold text-slate-900">Map</h3>
        <a
          href={directionsUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg transition-colors"
        >
          <MapIcon className="w-3.5 h-3.5" strokeWidth={2.5} />
          Directions
        </a>
      </div>
      <div ref={containerRef} className="w-full h-52 rounded-xl overflow-hidden bg-slate-100" />
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function ListingDetailContent({ propertyId, onBack }) {
  const qc = useQueryClient()
  const [imgIdx,       setImgIdx]     = useState(0)
  const [editOpen,     setEditOpen]   = useState(false)
  const [verifyOpen,   setVerifyOpen] = useState(false)
  const [selectedTid,  setSelectedTid] = useState(null)

  const { data: property, isLoading } = useQuery({
    queryKey: ['listing-detail', propertyId],
    queryFn: () => propertyService.getById(propertyId).then(r => r.data),
  })

  const { data: contacts = { appointments: [], conversations: [], savedBy: [], _count: {} }, isError: contactsError, refetch: refetchContacts } = useQuery({
    queryKey: ['property-contacts', propertyId],
    queryFn: () => propertyService.getContacts(propertyId).then(r => r.data),
    refetchInterval: 30000,
    enabled: !!propertyId,
    retry: 1,
  })

  const { mutate: publish, isPending: publishing } = useMutation({
    mutationFn: () => propertyService.publish(propertyId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['listing-detail', propertyId] })
      qc.invalidateQueries({ queryKey: ['my-listings'] })
      toast.success('Submitted', 'Listing sent for review')
    },
    onError: () => toast.error('Error', 'Failed to publish'),
  })

  const { mutate: toggle, isPending: toggling } = useMutation({
    mutationFn: () => propertyService.toggleStatus(propertyId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['listing-detail', propertyId] })
      qc.invalidateQueries({ queryKey: ['my-listings'] })
      toast.success('Updated', 'Status changed')
    },
    onError: () => toast.error('Error', 'Failed to update'),
  })

  const { mutate: remove, isPending: removing } = useMutation({
    mutationFn: () => propertyService.remove(propertyId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-listings'] })
      toast.success('Deleted', 'Listing removed')
      onBack()
    },
    onError: () => toast.error('Error', 'Failed to delete'),
  })

  const { mutate: updateAppt, isPending: acting } = useMutation({
    mutationFn: ({ id, status }) => appointmentService.updateStatus(id, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['property-contacts', propertyId] })
      qc.invalidateQueries({ queryKey: ['owner-appointments'] })
      toast.success('Updated', 'Appointment status changed')
    },
    onError: () => toast.error('Error', 'Failed to update'),
  })

  const { mutate: markTenant, isPending: marking } = useMutation({
    mutationFn: (tenantId) => propertyService.markTenant(propertyId, tenantId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['listing-detail', propertyId] })
      qc.invalidateQueries({ queryKey: ['my-listings'] })
      toast.success('Marked', 'Property is now occupied')
      setSelectedTid(null)
    },
    onError: (e) => toast.error('Error', e?.message ?? 'Failed to mark tenant'),
  })

  const { mutate: vacate, isPending: vacating } = useMutation({
    mutationFn: () => propertyService.vacate(propertyId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['listing-detail', propertyId] })
      qc.invalidateQueries({ queryKey: ['my-listings'] })
      toast.success('Vacated', 'Property is now available again')
    },
    onError: () => toast.error('Error', 'Failed to vacate'),
  })

  async function handleMarkTenant() {
    if (!selectedTid) return
    const yes = await confirm({ title: 'Mark as tenant?', message: `This will mark this person as your tenant and set the listing to Occupied. It will no longer appear on the public map.`, confirmLabel: 'Mark as Tenant' })
    if (!yes) return
    markTenant(selectedTid)
  }

  async function handleVacate() {
    const yes = await confirm({ title: 'Mark as vacant?', message: 'This will remove the current tenant and set the listing back to Active on the map.', confirmLabel: 'Mark as Vacant' })
    if (!yes) return
    vacate()
  }

  async function handleDelete() {
    const yes = await confirm({ title: 'Delete listing?', message: 'Permanently removes this listing and all its data.', confirmLabel: 'Delete', variant: 'danger' })
    if (!yes) return
    remove()
  }

  // Derive selected user from contacts data
  const allUsers = aggregatePropertyUsers(contacts)
  const selectedTenant = selectedTid ? allUsers.find(u => u.id === selectedTid) ?? null : null

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
      </div>
    )
  }

  if (!property) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-sm text-slate-500">Listing not found.</p>
        <button onClick={onBack} className="text-xs text-brand-600 hover:underline">← Back</button>
      </div>
    )
  }

  const images    = property.images ?? []
  const amenities = property.amenities ?? []
  const rules     = property.rules
  const { status } = property
  const busy = publishing || toggling || removing || marking || vacating

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Top bar ──────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-3 px-5 py-3 bg-white border-b border-slate-100">
        <button onClick={onBack}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-700 transition-colors shrink-0">
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2} />
          Listings
        </button>
        <span className="text-slate-300 text-xs">/</span>
        <p className="text-sm font-semibold text-slate-800 truncate flex-1 min-w-0">{property.title}</p>
        <span className="shrink-0"><PropertyStatusPill status={status} size="sm" /></span>
        <div className="flex items-center gap-1.5 shrink-0">
          <Btn onClick={() => setEditOpen(true)} disabled={busy}>Edit</Btn>
          {(status === 'DRAFT' || status === 'REJECTED') && (
            <Btn onClick={() => publish()} disabled={busy} variant="primary">
              {status === 'REJECTED' ? 'Re-publish' : 'Submit'}
            </Btn>
          )}
          {status === 'ACTIVE'   && <Btn onClick={() => toggle()} disabled={busy}>Deactivate</Btn>}
          {status === 'INACTIVE' && <Btn onClick={() => toggle()} disabled={busy} variant="dark">Activate</Btn>}
          {status === 'OCCUPIED' && <Btn onClick={handleVacate} disabled={busy} variant="indigo">Mark as Vacant</Btn>}
          {(status === 'ACTIVE' || status === 'DRAFT' || status === 'INACTIVE') && (
            <Btn onClick={() => setVerifyOpen(true)} disabled={busy} variant="indigo">Verify</Btn>
          )}
          <Btn onClick={handleDelete} disabled={busy} variant="danger">Delete</Btn>
        </div>
      </div>

      {/* ── 3-column body ────────────────────────────────────────── */}
      <div className="flex-1 grid divide-x divide-slate-200 min-h-0 bg-white overflow-hidden" style={{ gridTemplateColumns: '5fr 3fr 4fr' }}>

        {/* Col 1: Property details */}
        <div className="p-5 space-y-4 overflow-y-auto thin-scrollbar bg-slate-50 min-h-0">
          {/* Image carousel */}
          <div className="relative rounded-2xl overflow-hidden bg-slate-200 aspect-[16/10]">
            {images.length > 0 ? (
              <>
                <img src={images[imgIdx].url} alt="" className="w-full h-full object-cover" />
                {images.length > 1 && (
                  <>
                    <button onClick={() => setImgIdx(i => (i - 1 + images.length) % images.length)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white shadow flex items-center justify-center">
                      <ChevronLeft size={14} color="#334155" strokeWidth={2.5} />
                    </button>
                    <button onClick={() => setImgIdx(i => (i + 1) % images.length)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/90 hover:bg-white shadow flex items-center justify-center">
                      <ChevronRight size={14} color="#334155" strokeWidth={2.5} />
                    </button>
                    <div className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-black/60 text-white text-[11px] font-semibold">
                      {imgIdx + 1} / {images.length}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-300">
                <ImageOff className="w-12 h-12" strokeWidth={1.5} />
              </div>
            )}
          </div>

          {/* Title + Price + Tags */}
          <div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-lg font-bold text-slate-900 leading-snug">{property.title}</p>
                {property.displayId && <p className="text-[10px] font-mono text-slate-400 tracking-widest mt-0.5">{property.displayId}</p>}
                {(property.address || property.city) && (
                  <p className="text-sm text-slate-500 mt-1">
                    {[property.address, property.city].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xl font-bold text-brand-600">{formatRent(Number(property.rent))}<span className="text-xs font-medium text-slate-400">/mo</span></p>
                {property.deposit > 0 && <p className="text-xs text-slate-500 mt-0.5">Deposit: {formatCurrency(Number(property.deposit))}</p>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-3">
              {property.bhk === 0
                ? <span className="px-2.5 py-1 bg-brand-50 text-brand-700 text-xs font-semibold rounded-full">🛏️ Studio</span>
                : property.bhk ? <span className="px-2.5 py-1 bg-brand-50 text-brand-700 text-xs font-semibold rounded-full">🛏️ {property.bhk} BHK</span> : null}
              {property.sharing && <span className="px-2.5 py-1 bg-brand-50 text-brand-700 text-xs font-semibold rounded-full">🏘️ {property.sharing}-Sharing</span>}
              {property.furnished && <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">{FURNISHED_LABEL[property.furnished]}</span>}
              {property.type && <span className="px-2.5 py-1 bg-violet-50 text-violet-700 text-xs font-medium rounded-full">{TYPE_EMOJI[property.type] ?? '🏠'} {property.type?.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}</span>}
            </div>
          </div>

          {/* Current tenant banner */}
          {status === 'OCCUPIED' && property.currentTenant && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                <Home size={18} color="#4f46e5" strokeWidth={1.9} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-indigo-700 uppercase tracking-wide mb-0.5">Current Tenant</p>
                <p className="text-sm font-semibold text-slate-900 truncate">{property.currentTenant.name}</p>
                {property.occupiedSince && (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Since {new Date(property.occupiedSince).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* About */}
          {property.description && (
            <OwnerCard title="About this property">
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{property.description}</p>
            </OwnerCard>
          )}

          {/* Property Details */}
          {(property.area || property.floor != null || property.facingDirection || property.leaseDuration || property.availableFrom || property.occupancyLimit) && (
            <OwnerCard title="Property details">
              {[
                { Icon: Ruler,    label: 'Built-up Area',    value: property.area ? `${Number(property.area).toLocaleString('en-IN')} sq.ft` : null },
                { Icon: Layers,   label: 'Floor',            value: property.floor != null ? `${property.floor}${property.totalFloors ? ` of ${property.totalFloors}` : ''}` : null },
                { Icon: Compass,  label: 'Facing Direction', value: property.facingDirection ? property.facingDirection.charAt(0) + property.facingDirection.slice(1).toLowerCase() : null },
                { Icon: Calendar, label: 'Available From',   value: property.availableFrom ? new Date(property.availableFrom).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null },
                { Icon: Clipboard, label: 'Minimum Lease',   value: property.leaseDuration ? `${property.leaseDuration} months` : null },
                { Icon: Users,    label: 'Max Occupancy',    value: property.occupancyLimit ? `${property.occupancyLimit} persons` : null },
              ].filter(r => r.value).map(({ Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
                  <Icon size={15} color="#94a3b8" strokeWidth={1.8} className="shrink-0" />
                  <span className="text-sm text-slate-500 flex-1">{label}</span>
                  <span className="text-sm font-semibold text-slate-800">{value}</span>
                </div>
              ))}
            </OwnerCard>
          )}

          {/* Pricing + Amenities side by side */}
          <div className="grid grid-cols-2 gap-4">
            {/* Pricing */}
            <OwnerCard title="Pricing">
              <PriceRow label="Monthly Rent"        value={formatCurrency(Number(property.rent))} accent />
              <PriceRow label="Security Deposit"    value={formatCurrency(Number(property.deposit))} />
              <PriceRow label="Maintenance"         value={property.maintenance ? formatCurrency(Number(property.maintenance)) + '/mo' : 'Not included'} />
              <PriceRow label="Brokerage"           value={property.brokerage ? formatCurrency(Number(property.brokerage)) : 'None'} />
              <PriceRow label="Electricity (est.)"  value={property.electricityCharges ? formatCurrency(Number(property.electricityCharges)) + '/mo' : null} />
              <PriceRow label="Water (est.)"        value={property.waterCharges ? formatCurrency(Number(property.waterCharges)) + '/mo' : null} />
            </OwnerCard>

            {/* Amenities */}
            {amenities.length > 0 && (
              <OwnerCard title="Amenities">
                <div className="grid grid-cols-1 gap-2">
                  {amenities.map(a => {
                    const name = a.amenity?.name ?? a.amenityId
                    return (
                      <div key={name} className="flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-slate-400 shrink-0"><AmenityIcon name={name} size={16} /></span>
                        <span className="text-sm font-medium text-slate-700 truncate min-w-0">{name}</span>
                      </div>
                    )
                  })}
                </div>
              </OwnerCard>
            )}
          </div>

          {/* Zero Brokerage banner */}
          {!property.brokerage && (
            <div className="px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-2.5">
              <CircleCheck size={18} color="#059669" strokeWidth={1.9} className="shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-700">Zero Brokerage</p>
                <p className="text-xs text-emerald-600/70">Connect directly with tenants — no middlemen</p>
              </div>
            </div>
          )}

          {/* House Rules */}
          {rules && (
            <OwnerCard title="House rules">
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { Icon: ChefHat,  label: 'Non-veg Cooking', allowed: rules.nonVegAllowed },
                  { Icon: User,     label: 'Bachelors',       allowed: rules.bachelorAllowed },
                  { Icon: DoorOpen, label: 'Visitors',        allowed: rules.visitorsAllowed },
                  { Icon: PawPrint, label: 'Pets',            allowed: rules.petsAllowed },
                  { Icon: Cigarette, label: 'Smoking',        allowed: rules.smokingAllowed },
                  { Icon: Wine,     label: 'Alcohol',         allowed: rules.alcoholAllowed },
                ].map(r => (
                  <div key={r.label} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border ${r.allowed ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                    <r.Icon size={15} color={r.allowed ? '#059669' : '#94a3b8'} strokeWidth={1.9} className="shrink-0" />
                    <span className={`text-sm font-medium flex-1 ${r.allowed ? 'text-slate-800' : 'text-slate-400'}`}>{r.label}</span>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${r.allowed ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                      {r.allowed ? <Check size={10} color="white" strokeWidth={3} /> : <X size={10} color="white" strokeWidth={3} />}
                    </div>
                  </div>
                ))}
              </div>
              {(rules.genderPreference !== 'ANY' || rules.curfewTime) && (
                <div className="mt-3 space-y-2">
                  {rules.genderPreference && rules.genderPreference !== 'ANY' && (
                    <div className="flex items-center gap-2.5 px-3 py-2.5 bg-brand-50 rounded-xl border border-brand-100">
                      <span className="w-5 h-5 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs font-bold shrink-0">!</span>
                      <span className="text-sm font-medium text-brand-700">{GENDER_LABEL[rules.genderPreference] ?? rules.genderPreference}</span>
                    </div>
                  )}
                  {rules.curfewTime && (
                    <div className="flex items-center gap-2.5 px-3 py-2.5 bg-amber-50 rounded-xl border border-amber-100">
                      <Clock size={15} color="#d97706" strokeWidth={1.9} className="shrink-0" />
                      <span className="text-sm font-medium text-amber-800">Curfew at {rules.curfewTime}</span>
                    </div>
                  )}
                </div>
              )}
            </OwnerCard>
          )}

          {/* Location map */}
          {property.lat && property.lng && (
            <PropertyLocationMap lat={property.lat} lng={property.lng} />
          )}

          {/* Risk alert */}
          <RiskAlert riskScore={property.riskScore} />

          {/* Trust & Safety */}
          {property.trustScore && (
            <OwnerCard title="Trust &amp; safety">
              <TrustScoreWidget trustScore={property.trustScore} riskScore={property.riskScore} />
            </OwnerCard>
          )}

          {/* Community reviews */}
          <OwnerCard title="Community reviews">
            <ReviewsSection propertyId={property.id} isOwner />
          </OwnerCard>
        </div>

        {/* Col 2: People who contacted */}
        <div className="flex flex-col overflow-hidden min-h-0">
          <div className="shrink-0 px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
              People who contacted ({allUsers.length})
            </h3>
            <button onClick={() => refetchContacts()} className="text-[10px] text-brand-600 hover:text-brand-800 font-semibold shrink-0">Refresh</button>
          </div>
          {contactsError && (
            <div className="px-4 py-2 text-[11px] text-red-500 bg-red-50 border-b border-red-100">
              Could not load contacts — check browser console
            </div>
          )}
          <div className="flex-1 overflow-hidden min-h-0 thin-scrollbar">
            <TenantList
              contacts={contacts}
              selectedTenantId={selectedTid}
              onSelect={tid => setSelectedTid(tid)}
            />
          </div>
        </div>

        {/* Col 3: Selected user's activity */}
        <div className="flex flex-col overflow-hidden min-h-0">
          <div className="shrink-0 px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">User Activity</h3>
            {selectedTid && status === 'ACTIVE' && (
              <button
                onClick={handleMarkTenant}
                disabled={busy}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-lg transition-colors disabled:opacity-50 shrink-0"
              >
                <Home size={11} strokeWidth={2.2} />
                Mark as Tenant
              </button>
            )}
          </div>
          <div className="flex-1 overflow-hidden min-h-0 thin-scrollbar">
            <TenantDetail
              tenant={selectedTenant}
              contacts={contacts}
              ownerId={property.ownerId}
              onAction={(id, status) => updateAppt({ id, status })}
              acting={acting}
            />
          </div>
        </div>
      </div>

      {/* ── Modals ───────────────────────────────────────────────── */}
      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title="Edit Listing" size="xl">
        {editOpen && (
          <EditListingForm
            property={property}
            onSuccess={() => { setEditOpen(false); qc.invalidateQueries({ queryKey: ['listing-detail', propertyId] }) }}
          />
        )}
      </Modal>

      <Modal isOpen={verifyOpen} onClose={() => setVerifyOpen(false)} title="Verify Ownership" size="lg">
        {verifyOpen && <VerificationWizard property={property} onClose={() => setVerifyOpen(false)} />}
      </Modal>
    </div>
  )
}
