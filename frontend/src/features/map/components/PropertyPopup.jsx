import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { propertyService } from '@services/property.service'
import { appointmentService } from '@services/appointment.service'
import { useMapStore } from '@store/mapStore'
import { useAuth } from '@features/auth/hooks/useAuth'
import { formatRent, formatCurrency } from '@utils/format'
import { AmenityIcon } from '@components/common/AmenityIcon'

function Stars({ score }) {
  const clamped = Math.max(0, Math.min(5, score ?? 0))
  return (
    <div className="flex gap-0.5 items-center">
      {Array.from({ length: 5 }).map((_, i) => {
        const filled = clamped >= i + 1
        const half   = !filled && clamped >= i + 0.5
        const id     = `hs-${i}`
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

function Pill({ children, color = 'slate' }) {
  const styles = {
    slate:  'bg-slate-100 text-slate-600',
    brand:  'bg-brand-50 text-brand-700',
    violet: 'bg-violet-50 text-violet-700',
  }
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${styles[color] ?? styles.slate}`}>
      {children}
    </span>
  )
}

function PriceRow({ label, value, accent = false }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-sm font-bold ${accent ? 'text-slate-900' : 'text-slate-700'}`}>{value}</span>
    </div>
  )
}

function LockedRow({ icon, label }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 border border-dashed border-slate-200">
      <span className="text-slate-300">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-400 font-medium">{label}</p>
        <p className="text-[10px] text-slate-300 mt-0.5">Request a visit to unlock</p>
      </div>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
      </svg>
    </div>
  )
}

export default function PropertyPopup() {
  const selectedPinId  = useMapStore((s) => s.selectedPinId)
  const clearSelection = useMapStore((s) => s.clearSelection)
  const { user } = useAuth()

  const { data: property, isLoading } = useQuery({
    queryKey: ['property-popup', selectedPinId],
    queryFn:  () => propertyService.getById(selectedPinId).then((r) => r.data),
    enabled:  !!selectedPinId,
    staleTime: 60_000,
  })

  const { data: myAppointments } = useQuery({
    queryKey: ['appointments-mine'],
    queryFn:  () => appointmentService.mine().then((r) => r.data),
    enabled:  !!user && !!selectedPinId,
    staleTime: 30_000,
  })

  if (!selectedPinId) return null

  const hasAccepted = myAppointments?.some(
    (a) => a.propertyId === selectedPinId && a.status === 'ACCEPTED'
  ) ?? false

  const directionsUrl = property?.lat && property?.lng
    ? `https://www.google.com/maps/dir/?api=1&destination=${property.lat},${property.lng}`
    : property?.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([property.address, property.city].filter(Boolean).join(', '))}`
    : null

  const bhkLabel = property?.type === 'PG'
    ? `🏘️ ${property.sharing}-Sharing PG`
    : property?.bhk === 0 ? '🛏️ Studio'
    : property?.bhk ? `🛏️ ${property.bhk} BHK` : null

  const FURNISHED_EMOJI = { FULLY: '🛋️', SEMI: '🪑', UNFURNISHED: '📦' }
  const furnished = property?.furnished
    ? `${FURNISHED_EMOJI[property.furnished] ?? ''} ${property.furnished.charAt(0) + property.furnished.slice(1).toLowerCase().replace('_', ' ')}`.trim()
    : null

  const TYPE_EMOJI = { APARTMENT: '🏢', HOUSE: '🏠', VILLA: '🏡', PG: '🏘️', INDEPENDENT_HOUSE: '🏠', COMMERCIAL: '🏪' }
  const typeLabel = property?.type
    ? `${TYPE_EMOJI[property.type] ?? '🏠'} ${property.type.replace(/_/g, ' ').charAt(0) + property.type.replace(/_/g, ' ').slice(1).toLowerCase()}`
    : null

  const score       = Number(property?.trustScore?.overallScore ?? 0)
  const reviewCount = property?.trustScore?.totalReviews ?? 0
  const amenities   = property?.amenities ?? []

  return (
    <div
      className="w-full bg-white rounded-2xl overflow-hidden border border-slate-100"
      style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)' }}
    >
      {/* ── Header ── */}
      <div className="flex items-start gap-2 px-4 pt-4 pb-3">
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="h-5 w-40 bg-slate-100 rounded animate-pulse mb-1" />
          ) : (
            <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">
              {property?.title}
            </h3>
          )}
          {property?.address && (
            <p className="text-[11px] text-slate-400 mt-0.5 leading-tight line-clamp-1">
              {property.address}{property.city ? `, ${property.city}` : ''}
            </p>
          )}
        </div>
        <button
          onClick={clearSelection}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* ── Scrollable body ── */}
      <div className="overflow-y-auto px-4 pb-4 flex flex-col gap-4" style={{ maxHeight: '72vh', scrollbarWidth: 'none' }}>

        {/* Pills */}
        {!isLoading && (bhkLabel || furnished || typeLabel) && (
          <div className="flex flex-wrap gap-1.5">
            {bhkLabel  && <Pill color="brand">{bhkLabel}</Pill>}
            {furnished && <Pill>{furnished}</Pill>}
            {typeLabel && <Pill color="violet">{typeLabel}</Pill>}
          </div>
        )}

        {/* Description */}
        {property?.description && (
          <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">
            {property.description}
          </p>
        )}

        {/* Pricing */}
        {!isLoading && property && (
          <div className="rounded-xl bg-slate-50 border border-slate-100 px-3 overflow-hidden">
            <PriceRow
              label="Monthly rent"
              value={formatRent(Number(property.rent))}
              accent
            />
            {Number(property.deposit) > 0 && (
              <PriceRow
                label="Security deposit"
                value={formatCurrency(Number(property.deposit))}
              />
            )}
            <PriceRow
              label="Maintenance"
              value={Number(property.maintenance) > 0 ? `${formatCurrency(Number(property.maintenance))}/mo` : 'Not included'}
            />
          </div>
        )}
        {isLoading && <div className="h-20 bg-slate-100 rounded-xl animate-pulse" />}

        {/* Directions & Phone */}
        <div className="flex flex-col gap-2">
          {directionsUrl && (
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-brand-50 border border-brand-100 hover:bg-brand-100 transition-colors no-underline"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="3 11 22 2 13 21 11 13 3 11"/>
              </svg>
              <span className="flex-1 text-xs font-semibold text-brand-700">Get directions</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </a>
          )}

          {hasAccepted && property?.owner?.phone ? (
            <a
              href={`tel:${property.owner.phone}`}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 transition-colors no-underline"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
              </svg>
              <span className="flex-1 text-xs font-semibold text-emerald-700">{property.owner.phone}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </a>
          ) : (
            <LockedRow
              icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>}
              label="Owner contact"
            />
          )}
        </div>

        {/* Amenities */}
        {amenities.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Amenities</p>
            <div className="flex flex-wrap gap-1.5">
              {amenities.slice(0, 10).map((a) => (
                <span
                  key={a.amenityId ?? a.amenity?.name}
                  className="flex items-center gap-1.5 px-2 py-1 bg-slate-50 border border-slate-100 rounded-lg text-[11px] text-slate-600 font-medium"
                >
                  <span className="text-slate-400 shrink-0">
                    <AmenityIcon name={a.amenity?.name} size={13} />
                  </span>
                  {a.amenity?.name}
                </span>
              ))}
              {amenities.length > 10 && (
                <span className="px-2 py-1 text-[11px] text-slate-400 bg-slate-50 border border-slate-100 rounded-lg">
                  +{amenities.length - 10}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Stay Score */}
        {!isLoading && (
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-100">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest mb-1">Stay Score</p>
              <div className="flex items-center gap-2">
                <Stars score={score} />
                <span className="text-sm font-bold text-slate-800">
                  {score > 0 ? score.toFixed(1) : '—'}
                  <span className="text-xs font-normal text-slate-400">/5</span>
                </span>
                {reviewCount > 0 && (
                  <span className="text-[11px] text-slate-400">({reviewCount})</span>
                )}
              </div>
            </div>
            {score === 0 && (
              <span className="text-xs text-amber-600 font-medium">No reviews yet</span>
            )}
          </div>
        )}

        {/* CTA */}
        {!isLoading && property?.id && (
          <Link
            to={`/property/${property.id}`}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-sm font-bold text-white no-underline transition-colors duration-150 active:scale-[0.98]"
          >
            More details
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </Link>
        )}
      </div>
    </div>
  )
}
