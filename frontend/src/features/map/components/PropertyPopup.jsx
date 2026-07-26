import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Lock, X, Navigation, Phone, ArrowRight, ImageOff } from 'lucide-react'
import { propertyService } from '@services/property.service'
import { useMapStore } from '@store/mapStore'
import { useAuth } from '@features/auth/hooks/useAuth'
import { formatPrice, formatCurrency, imgUrl } from '@utils/format'
import { previewHighlights } from '@features/spatial/previewHighlights'
import { factIcon } from '@features/spatial/factIcons'
import TrustBadge from '@components/common/TrustBadge'
import RiskAlert from '@components/common/RiskAlert'

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

function LockedRow({ icon, label, sub }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-50 border border-dashed border-slate-200">
      <span className="text-slate-300">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-400 font-medium">{label}</p>
        <p className="text-[10px] text-slate-300 mt-0.5">{sub}</p>
      </div>
      <Lock size={13} color="#cbd5e1" strokeWidth={2} />
    </div>
  )
}

// `bare` — rendered inside the mobile bottom sheet, which owns the card
// chrome and the scrolling; the popup drops its border/shadow and inner
// scroll cap so there's one scroll surface, not two nested ones.
export default function PropertyPopup({ bare = false }) {
  const selectedPinId  = useMapStore((s) => s.selectedPinId)
  const clearSelection = useMapStore((s) => s.clearSelection)
  const { user } = useAuth()

  const { data: property, isLoading } = useQuery({
    queryKey: ['property-popup', selectedPinId],
    queryFn:  () => propertyService.getById(selectedPinId).then((r) => r.data),
    enabled:  !!selectedPinId,
    staleTime: 60_000,
  })

  if (!selectedPinId) return null

  const directionsUrl = property?.lat && property?.lng
    ? `https://www.google.com/maps/dir/?api=1&destination=${property.lat},${property.lng}`
    : property?.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([property.address, property.city].filter(Boolean).join(', '))}`
    : null

  // Spec chip is per-type: BHK means nothing on a plot, sharing is the number
  // that matters for a PG, guests for a short stay, carpet area for a shop.
  const bhkLabel = !property ? null
    : property.type === 'PG' ? `🏘️ ${property.sharing}-Sharing PG`
    : property.type === 'LAND' ? (property.extent ? `📐 ${property.extent} ${(property.extentUnit ?? '').toLowerCase()}`.trim() : null)
    : property.type === 'SHORT_STAY' ? (property.maxGuests ? `👥 Up to ${property.maxGuests} guests` : null)
    : property.type === 'COMMERCIAL' ? (property.carpetArea ? `📐 ${property.carpetArea} sq.ft carpet` : null)
    : property.bhk === 0 ? '🛏️ Studio'
    : property.bhk ? `🛏️ ${property.bhk} BHK` : null

  const FURNISHED_EMOJI = { FULLY: '🛋️', SEMI: '🪑', UNFURNISHED: '📦' }
  const furnished = property?.furnished
    ? `${FURNISHED_EMOJI[property.furnished] ?? ''} ${property.furnished.charAt(0) + property.furnished.slice(1).toLowerCase().replace('_', ' ')}`.trim()
    : null

  const TYPE_EMOJI = { APARTMENT: '🏢', HOUSE: '🏠', VILLA: '🏡', PG: '🏘️', INDEPENDENT_HOUSE: '🏠', COMMERCIAL: '🏪', LAND: '🏞️', SHORT_STAY: '🏨' }
  const typeLabel = property?.type
    ? `${TYPE_EMOJI[property.type] ?? '🏠'} ${property.type.replace(/_/g, ' ').charAt(0) + property.type.replace(/_/g, ' ').slice(1).toLowerCase()}`
    : null

  // Nightly for a short stay; formatPrice covers rent vs lease for the rest.
  const priceLabel = property?.type === 'SHORT_STAY' ? 'Nightly rate'
    : property?.pricingModel === 'LEASE' ? 'Lease amount' : 'Monthly rent'
  const priceValue = property?.type === 'SHORT_STAY'
    ? `${formatCurrency(Number(property.nightlyRate ?? property.rent))}/night`
    : property ? formatPrice(property) : ''

  const highlights = previewHighlights(property?.spatialContext)
  const images = property?.images ?? []

  return (
    <div
      className={bare ? 'w-full bg-white' : 'w-full bg-white rounded-2xl overflow-hidden border border-slate-100'}
      style={bare ? undefined : { boxShadow: '0 4px 24px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)' }}
    >
      {/* ── Photo ── */}
      {isLoading ? (
        <div className="aspect-[16/9] bg-slate-100 animate-pulse" />
      ) : (
        <div className="relative aspect-[16/9] bg-slate-100">
          {images[0]?.url ? (
            <img src={imgUrl(images[0].url, 'card')} alt={property?.title ?? ''} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-300">
              <ImageOff size={28} strokeWidth={1.5} />
            </div>
          )}
          {images.length > 1 && (
            <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-lg bg-black/60 text-white text-[11px] font-semibold">
              1 / {images.length}
            </span>
          )}
        </div>
      )}

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
          <X size={14} strokeWidth={2.2} />
        </button>
      </div>

      {/* ── Scrollable body (the sheet scrolls instead when bare) ── */}
      <div
        className={`px-4 pb-4 flex flex-col gap-4 ${bare ? '' : 'overflow-y-auto'}`}
        style={bare ? undefined : { maxHeight: '60vh', scrollbarWidth: 'none' }}
      >
        {/* Risk warning — renders nothing unless MEDIUM or worse */}
        {!isLoading && property?.riskScore && <RiskAlert riskScore={property.riskScore} />}

        {/* Pills */}
        {!isLoading && (bhkLabel || furnished || typeLabel || property?.trustScore?.badge) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {property?.trustScore?.badge && <TrustBadge badge={property.trustScore.badge} size="sm" />}
            {bhkLabel  && <Pill color="brand">{bhkLabel}</Pill>}
            {furnished && <Pill>{furnished}</Pill>}
            {typeLabel && <Pill color="violet">{typeLabel}</Pill>}
          </div>
        )}

        {/* Nearby highlights — property-anchored distances from the spatial layer */}
        {highlights.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {highlights.map((h) => {
              const Icon = factIcon(h.key)
              return (
                <span key={h.key} className="flex items-center gap-1.5 rounded-full bg-slate-50 border border-slate-100 px-2.5 py-1 text-[11px] text-slate-600">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" strokeWidth={2} aria-hidden="true" />
                  {h.label} <span className="font-bold text-slate-800">{h.distance}</span>
                </span>
              )
            })}
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
            <PriceRow label={priceLabel} value={priceValue} accent />
            {Number(property.deposit) > 0 && (
              <PriceRow
                label="Security deposit"
                value={formatCurrency(Number(property.deposit))}
              />
            )}
            {/* Maintenance is a monthly-tenancy concept — meaningless for a
                plot or a nightly stay; a short stay shows its cleaning fee. */}
            {property.type !== 'LAND' && property.type !== 'SHORT_STAY' && (
              <PriceRow
                label="Maintenance"
                value={Number(property.maintenance) > 0 ? `${formatCurrency(Number(property.maintenance))}/mo` : 'Not included'}
              />
            )}
            {property.type === 'SHORT_STAY' && Number(property.cleaningFee) > 0 && (
              <PriceRow label="Cleaning fee" value={formatCurrency(Number(property.cleaningFee))} />
            )}
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
              <Navigation size={16} color="#0284c7" strokeWidth={2} />
              <span className="flex-1 text-xs font-semibold text-brand-700">Get directions</span>
              <ArrowRight size={12} color="#0284c7" strokeWidth={2.5} />
            </a>
          )}

          {/* The backend only ships owner.phone when the owner's
              contactVisibility allows THIS viewer — presence here IS the
              permission check, never assume or re-derive it client-side. */}
          {property?.owner?.phone ? (
            <a
              href={`tel:${property.owner.phone}`}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 transition-colors no-underline"
            >
              <Phone size={15} color="#16a34a" strokeWidth={2} />
              <span className="flex-1 text-xs font-semibold text-emerald-700">{property.owner.phone}</span>
              <ArrowRight size={12} color="#16a34a" strokeWidth={2.5} />
            </a>
          ) : (
            <LockedRow
              icon={<Phone size={15} strokeWidth={2} />}
              label="Owner contact"
              sub={user ? 'Not shared by the owner — message them instead' : 'Sign in to view, if the owner shares it'}
            />
          )}
        </div>

        {/* CTA */}
        {!isLoading && property?.id && (
          <Link
            to={`/property/${property.id}`}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-sm font-bold text-white no-underline transition-colors duration-150 active:scale-[0.98]"
          >
            More details
            <ArrowRight size={13} strokeWidth={2.5} />
          </Link>
        )}
      </div>
    </div>
  )
}
