import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Lock, X, Navigation, Phone, ArrowRight, ImageOff, Sofa } from 'lucide-react'
import { propertyService } from '@services/property.service'
import { propertySpec } from '@utils/propertySpec'
import { typeIcon, typeLabel, furnishedLabel } from '@/config/propertyTypes'
import { useMapStore } from '@store/mapStore'
import { useAuth } from '@features/auth/hooks/useAuth'
import { formatPrice, formatCurrency, imgUrl } from '@utils/format'
import { previewHighlights } from '@features/spatial/previewHighlights'
import { factIcon } from '@features/spatial/factIcons'
import TrustBadge from '@components/common/TrustBadge'
import RiskAlert from '@components/common/RiskAlert'

// The words and glyphs live in @config/propertyTypes now — the mirror of
// mobile's file of the same name, and the reason a plot says "Plot" on every
// surface of both platforms.
//
// All three chips were built from EMOJI until 2026-08-07. An emoji renders in
// the OS font, so the pills were the one part of this card drawn by Apple or
// Google rather than by us, at a size and weight we do not control, and several
// read as near-identical little houses at 12px.

function Pill({ icon: Icon, children, color = 'slate' }) {
  const styles = {
    slate:  'bg-slate-100 text-slate-600',
    brand:  'bg-brand-50 text-brand-700',
    violet: 'bg-violet-50 text-violet-700',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${styles[color] ?? styles.slate}`}>
      {Icon && <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />}
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
      <span className="text-slate-500">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500 font-medium">{label}</p>
        <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>
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

  // Per-type, and shared with the grid card and the saved list — see
  // utils/propertySpec.js. This file's version was the complete one; the other
  // two were subsets of it, which is exactly how a plot ended up with no spec
  // at all in the browse grid.
  const spec = propertySpec(property)

  const furnished = property?.furnished
    ? { Icon: Sofa, text: furnishedLabel(property.furnished) ?? property.furnished }
    : null

  const TypeIcon = typeIcon(property?.type)
  const type = TypeIcon ? { Icon: TypeIcon, text: typeLabel(property.type) } : null

  // Nightly for a short stay; formatPrice covers rent vs lease vs sale for the
  // rest. SALE was missing here, so a ₹95L plot for sale read "Monthly rent
  // ₹9,500,000" with a "Security deposit" under it — the one number on the card
  // a buyer cannot afford to misread.
  const priceLabel = property?.type === 'SHORT_STAY' ? 'Nightly rate'
    : property?.pricingModel === 'SALE' ? 'Asking price'
    : property?.pricingModel === 'LEASE' ? 'Lease amount' : 'Monthly rent'
  // On a sale the second row is the booking advance, not a refundable deposit.
  const depositLabel = property?.pricingModel === 'SALE' ? 'Booking advance' : 'Security deposit'
  const priceValue = property?.type === 'SHORT_STAY'
    ? `${formatCurrency(Number(property.nightlyRate ?? property.rent))}/night`
    : property ? formatPrice(property) : ''

  const highlights = previewHighlights(property?.spatialContext)
  const images = property?.images ?? []

  // The photo is the first thing that says whether this place is worth a tap.
  // 16:9 across a 340px desktop panel is ~190px and reads fine; the same ratio
  // across a full-width phone sheet is a letterbox strip, so the mobile sheet
  // gets a taller crop of the same image.
  const photoRatio = bare ? 'aspect-[3/2]' : 'aspect-[16/9]'

  return (
    <div
      className={bare ? 'w-full bg-white' : 'w-full bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-md'}
    >
      {/* ── Photo ── */}
      {isLoading ? (
        <div className={`${photoRatio} bg-slate-100 animate-pulse`} />
      ) : (
        <div className={`relative ${photoRatio} bg-slate-100`}>
          {images[0]?.url ? (
            <img src={imgUrl(images[0].url, 'card')} alt={property?.title ?? ''} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-500">
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
            <p className="text-[11px] text-slate-500 mt-0.5 leading-tight line-clamp-1">
              {property.address}{property.city ? `, ${property.city}` : ''}
            </p>
          )}
        </div>
        <button
          onClick={clearSelection}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
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
        {!isLoading && (spec || furnished || type || property?.trustScore?.badge) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {property?.trustScore?.badge && <TrustBadge badge={property.trustScore.badge} size="sm" />}
            {spec      && <Pill color="brand" icon={spec.Icon}>{spec.text}</Pill>}
            {furnished && <Pill icon={furnished.Icon}>{furnished.text}</Pill>}
            {type      && <Pill color="violet" icon={type.Icon}>{type.text}</Pill>}
          </div>
        )}

        {/* Nearby highlights — property-anchored distances from the spatial layer */}
        {highlights.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {highlights.map((h) => {
              const Icon = factIcon(h.key)
              return (
                <span key={h.key} className="flex items-center gap-1.5 rounded-full bg-slate-50 border border-slate-100 px-2.5 py-1 text-[11px] text-slate-600">
                  <Icon className="h-3.5 w-3.5 shrink-0 text-slate-500" strokeWidth={2} aria-hidden="true" />
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
                label={depositLabel}
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
            className="min-h-[44px] flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-700 text-sm font-bold text-white no-underline transition-colors duration-150 active:scale-[0.98]"
          >
            More details
            <ArrowRight size={13} strokeWidth={2.5} />
          </Link>
        )}
      </div>
    </div>
  )
}
