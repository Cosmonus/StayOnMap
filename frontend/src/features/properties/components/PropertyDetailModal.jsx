import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { propertyService } from '@services/property.service'
import { formatRent, formatCurrency } from '@utils/format'
import AppointmentForm from '@features/appointments/components/AppointmentForm'

// ── Amenity icons ────────────────────────────────────────────────────────────
const AMENITY_ICON = {
  'WiFi':            { icon: '📶', label: 'WiFi' },
  'Parking':         { icon: '🅿️', label: 'Parking' },
  'AC':              { icon: '❄️', label: 'AC' },
  'Lift':            { icon: '🛗', label: 'Lift' },
  'Gym':             { icon: '🏋️', label: 'Gym' },
  'CCTV':            { icon: '📷', label: 'CCTV' },
  'Power Backup':    { icon: '🔋', label: 'Power Backup' },
  'Kitchen':         { icon: '🍳', label: 'Kitchen' },
  'Washing Machine': { icon: '🫧', label: 'Washing Machine' },
  'Pet Friendly':    { icon: '🐾', label: 'Pet Friendly' },
  'Security Guard':  { icon: '💂', label: 'Security Guard' },
  'Swimming Pool':   { icon: '🏊', label: 'Swimming Pool' },
  'Gas Pipeline':    { icon: '🔥', label: 'Gas Pipeline' },
  'Gated Security':  { icon: '🔒', label: 'Gated Security' },
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function availabilityTag(property) {
  if (!property) return null
  const { status, availableFrom } = property
  if (status === 'INACTIVE')  return { label: 'Not Available',      dot: 'bg-slate-400' }
  if (status === 'SUSPENDED') return { label: 'Suspended',          dot: 'bg-slate-400' }
  if (status === 'PENDING')   return { label: 'Awaiting Approval',  dot: 'bg-brand-400' }
  if (status === 'DRAFT')     return { label: 'Draft',              dot: 'bg-slate-300' }
  // ACTIVE — check availableFrom
  if (availableFrom) {
    const d = new Date(availableFrom)
    if (d > new Date()) {
      return { label: `Available from ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`, dot: 'bg-brand-500' }
    }
  }
  return { label: 'Available Now', dot: 'bg-brand-600' }
}

// ── Skeleton ─────────────────────────────────────────────────────────────────
function Skeleton({ className }) {
  return <div className={`bg-slate-100 rounded-lg animate-pulse ${className}`} />
}

// ── Main modal ────────────────────────────────────────────────────────────────
export default function PropertyDetailModal({ propertyId, isOpen, onClose }) {
  const [imgIdx, setImgIdx] = useState(0)
  const [showAppointment, setShowAppointment] = useState(false)

  const { data: property, isLoading } = useQuery({
    queryKey: ['property', propertyId],
    queryFn: () => propertyService.getById(propertyId).then(r => r.data),
    enabled: !!propertyId && isOpen,
    staleTime: 60_000,
  })

  if (!isOpen) return null

  const images    = property?.images ?? []
  const amenities = property?.amenities ?? []

  const bhkLabel = property?.type === 'PG'
    ? `${property.sharing}-Sharing PG`
    : property?.bhk ? `${property.bhk} BHK` : null

  const avail = availabilityTag(isLoading ? null : property)

  const floorLabel = (() => {
    if (property?.floor && property?.totalFloors) return `${ordinal(property.floor)} floor of ${property.totalFloors}`
    if (property?.floor)       return `${ordinal(property.floor)} floor`
    if (property?.totalFloors) return `${property.totalFloors}-floor building`
    return null
  })()

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[88vh] flex flex-col bg-white sm:rounded-2xl shadow-2xl overflow-hidden">

        {/* Sticky header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <div className="min-w-0">
            {isLoading
              ? <Skeleton className="w-48 h-5" />
              : <p className="text-base font-bold text-slate-900 truncate">{property?.title}</p>
            }
            {!isLoading && property?.city && (
              <p className="text-xs text-slate-400 mt-0.5 truncate">{property.city}{property.state ? `, ${property.state}` : ''}</p>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-4">
            {!isLoading && property?.rent && (
              <p className="text-lg font-bold text-brand-600 whitespace-nowrap">{formatRent(Number(property.rent))}</p>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label="Close"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1">
          {/* Image gallery */}
          <div className="relative bg-slate-100" style={{ aspectRatio: '16/7' }}>
            {isLoading ? (
              <div className="w-full h-full bg-slate-100 animate-pulse" />
            ) : images.length > 0 ? (
              <>
                <img src={images[imgIdx]?.url} alt="Property" className="w-full h-full object-cover" />
                {images.length > 1 && (
                  <>
                    <button
                      onClick={() => setImgIdx(i => (i - 1 + images.length) % images.length)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center transition-colors"
                    >
                      <svg width="14" height="14" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>
                    </button>
                    <button
                      onClick={() => setImgIdx(i => (i + 1) % images.length)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center transition-colors"
                    >
                      <svg width="14" height="14" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
                    </button>
                    <div className="absolute bottom-3 right-4 bg-black/50 text-white text-xs font-medium px-2.5 py-1 rounded-full">
                      {imgIdx + 1} / {images.length}
                    </div>
                    {/* Thumbnail strip */}
                    <div className="absolute bottom-3 left-3 flex gap-1.5">
                      {images.slice(0, 6).map((img, i) => (
                        <button
                          key={img.id ?? i}
                          onClick={() => setImgIdx(i)}
                          className={`w-8 h-8 rounded overflow-hidden border-2 transition-colors ${i === imgIdx ? 'border-brand-500' : 'border-white/50 hover:border-white'}`}
                        >
                          <img src={img.url} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-300">
                <svg className="w-14 h-14" fill="currentColor" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="px-5 py-5 space-y-6">

            {/* Availability tag */}
            {avail && (
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl w-fit">
                <span className={`w-2 h-2 rounded-full shrink-0 ${avail.dot}`} />
                <span className="text-xs font-semibold text-slate-700">{avail.label}</span>
              </div>
            )}
            {isLoading && <Skeleton className="w-32 h-8" />}

            {/* Chips row */}
            {isLoading ? (
              <div className="flex gap-2">
                <Skeleton className="w-16 h-6" />
                <Skeleton className="w-20 h-6" />
                <Skeleton className="w-24 h-6" />
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {bhkLabel && (
                  <span className="px-3 py-1 bg-brand-50 text-brand-600 text-xs font-semibold rounded-full border border-brand-100">🏠 {bhkLabel}</span>
                )}
                {property?.type && (
                  <span className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded-full">
                    🏷️ {property.type.replace('_', ' ').charAt(0) + property.type.replace('_', ' ').slice(1).toLowerCase()}
                  </span>
                )}
                {property?.furnished && (
                  <span className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded-full">
                    🛋️ {property.furnished.charAt(0) + property.furnished.slice(1).toLowerCase()} furnished
                  </span>
                )}
                {property?.facingDirection && (
                  <span className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded-full">
                    🧭 {property.facingDirection.charAt(0) + property.facingDirection.slice(1).toLowerCase()} facing
                  </span>
                )}
              </div>
            )}

            {/* Address */}
            {property?.address && (
              <div className="flex items-start gap-2 text-sm text-slate-500">
                <svg className="w-4 h-4 text-brand-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
                <span className="leading-snug">{property.address}, {property.city}, {property.state} — {property.pincode}</span>
              </div>
            )}

            {/* Two-col: Pricing + Quick info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Pricing */}
              <div className="bg-slate-50 rounded-xl p-4 space-y-2.5">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pricing</p>
                {[
                  { label: 'Monthly rent',     value: property?.rent        ? formatCurrency(Number(property.rent))               : null, highlight: true },
                  { label: 'Security deposit', value: property?.deposit     ? formatCurrency(Number(property.deposit))            : null },
                  { label: 'Maintenance',      value: property?.maintenance ? formatCurrency(Number(property.maintenance)) + '/mo' : 'Not included' },
                  { label: 'Brokerage',        value: property?.brokerage   ? formatCurrency(Number(property.brokerage))          : 'None' },
                  { label: 'Electricity',      value: property?.electricityCharges ? formatCurrency(Number(property.electricityCharges)) + '/mo (est.)' : null },
                  { label: 'Water',            value: property?.waterCharges ? formatCurrency(Number(property.waterCharges)) + '/mo (est.)' : null },
                ].filter(r => r.value).map(r => (
                  <div key={r.label} className="flex justify-between items-baseline gap-2">
                    <span className="text-xs text-slate-500">{r.label}</span>
                    <span className={`text-sm font-semibold ${r.highlight ? 'text-brand-600' : 'text-slate-800'}`}>{r.value}</span>
                  </div>
                ))}
              </div>

              {/* Quick info */}
              <div className="bg-slate-50 rounded-xl p-4 space-y-2.5">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Details</p>
                {[
                  { icon: '📐', label: 'Area',         value: property?.area ? `${Number(property.area).toLocaleString('en-IN')} sq.ft` : null },
                  { icon: '🏢', label: 'Floor',         value: floorLabel },
                  { icon: '🧭', label: 'Facing',        value: property?.facingDirection ? property.facingDirection.charAt(0) + property.facingDirection.slice(1).toLowerCase() : null },
                  { icon: '📅', label: 'Available',     value: property?.availableFrom ? new Date(property.availableFrom).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : null },
                  { icon: '📋', label: 'Lease',         value: property?.leaseDuration ? `${property.leaseDuration} months min.` : null },
                  { icon: '👥', label: 'Max occupancy', value: property?.occupancyLimit ? `${property.occupancyLimit} persons` : null },
                ].filter(r => r.value).map(r => (
                  <div key={r.label} className="flex items-center gap-2">
                    <span className="text-sm">{r.icon}</span>
                    <span className="text-xs text-slate-500 w-24 shrink-0">{r.label}</span>
                    <span className="text-xs font-medium text-slate-800">{r.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Description */}
            {property?.description && (
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">About this property</p>
                <p className="text-sm text-slate-600 leading-relaxed">{property.description}</p>
              </div>
            )}

            {/* Amenities */}
            {amenities.length > 0 && (
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Amenities</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {amenities.map(a => {
                    const name = a.amenity?.name
                    const meta = AMENITY_ICON[name] ?? { icon: '✓', label: name }
                    return (
                      <div key={a.amenityId ?? name} className="flex flex-col items-center gap-1.5 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="text-2xl leading-none">{meta.icon}</span>
                        <span className="text-xs text-slate-600 text-center font-medium w-full truncate">{meta.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* House rules */}
            {property?.rules && (
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">House Rules</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { icon: '🍖', label: 'Non-veg Cooking', allowed: property.rules.nonVegAllowed   },
                    { icon: '👤', label: 'Bachelors',        allowed: property.rules.bachelorAllowed },
                    { icon: '🚪', label: 'Visitors',         allowed: property.rules.visitorsAllowed },
                    { icon: '🐾', label: 'Pets',             allowed: property.rules.petsAllowed     },
                    { icon: '🚬', label: 'Smoking',          allowed: property.rules.smokingAllowed  },
                    { icon: '🍺', label: 'Alcohol',          allowed: property.rules.alcoholAllowed  },
                  ].map(r => (
                    <div key={r.label} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border ${r.allowed ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                      <span className="text-sm shrink-0">{r.icon}</span>
                      <span className={`text-xs font-medium flex-1 ${r.allowed ? 'text-slate-800' : 'text-slate-400'}`}>{r.label}</span>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${r.allowed ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          {r.allowed ? <path d="M20 6L9 17l-5-5" /> : <path d="M18 6L6 18M6 6l12 12" />}
                        </svg>
                      </div>
                    </div>
                  ))}
                  {property.rules.genderPreference && property.rules.genderPreference !== 'ANY' && (
                    <div className="col-span-2 flex items-center gap-2.5 px-3 py-2 bg-brand-50 rounded-lg border border-brand-100">
                      <span className="w-5 h-5 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs font-bold shrink-0">●</span>
                      <span className="text-xs font-medium text-brand-700">{property.rules.genderPreference === 'MALE' ? 'Male tenants only' : 'Female tenants only'}</span>
                    </div>
                  )}
                  {property.rules.curfewTime && (
                    <div className="col-span-2 flex items-center gap-2.5 px-3 py-2 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="text-sm">⏰</span>
                      <span className="text-xs font-medium text-slate-700">Curfew at {property.rules.curfewTime}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Appointment section */}
            <div className="border-t border-slate-100 pt-5">
              {!showAppointment ? (
                <button
                  onClick={() => setShowAppointment(true)}
                  className="w-full py-3 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors"
                >
                  I&apos;m Interested — Request a Visit
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-800">Request a Visit</p>
                    <button onClick={() => setShowAppointment(false)} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
                  </div>
                  <AppointmentForm propertyId={propertyId} onSuccess={() => setShowAppointment(false)} />
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
