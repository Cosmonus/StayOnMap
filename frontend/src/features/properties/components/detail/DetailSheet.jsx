import { Check, Clock, Navigation, X } from 'lucide-react'
import { AmenityIcon } from '@components/common/AmenityIcon'
import ReviewsSection from '@features/reviews/components/ReviewsSection'
import SimilarHomes from './SimilarHomes'
import SpatialContextPanel from '@features/spatial/components/SpatialContextPanel'
import CommuteCalculator from '@features/areas/components/CommuteCalculator'
import { Sheet, SheetSection, FactCell } from './SheetPrimitives'
import { ordinal, formatFurnished, bhkLabelFor } from './detailUtils'
import PropertyLocationMap from './PropertyLocationMap'
import { formatTime } from '@utils/time'

// The hairline-divided listing sheet — every informational section of the
// property detail, shared verbatim between the public page and the admin
// detail view. The only variant difference: CommuteCalculator (a tenant tool
// with mutation state) renders inside the spatial panel on the public page
// only.
export default function DetailSheet({ property, variant, isOwner, directionsUrl }) {
  const bhkLabel = bhkLabelFor(property)

  const floorLabel = (() => {
    if (property.floor && property.totalFloors) return `${ordinal(property.floor)} of ${property.totalFloors}`
    if (property.floor)       return `${ordinal(property.floor)} floor`
    if (property.totalFloors) return `${property.totalFloors}-floor building`
    return null
  })()

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

  return (
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
                <span className="text-sm font-semibold text-slate-500">No {r.label.toLowerCase()}</span>
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
                  <span className="text-sm font-medium text-amber-800">Curfew at {formatTime(property.rules.curfewTime)}</span>
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
          {/* CommuteCalculator is a tenant tool with mutation state — public
              variant only, and never mounted twice (see .claude/ui-ux.md). */}
          {variant === 'public' && <CommuteCalculator lat={property.lat} lng={property.lng} />}
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
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-xs font-bold text-white no-underline transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1"
            >
              <Navigation className="h-3.5 w-3.5" strokeWidth={2.5} />
              Directions
            </a>
          }
        >
          <PropertyLocationMap lat={property.lat} lng={property.lng} />
          {/* The owner chose to hide their exact address, so the pin is snapped
              to a ~150m cell. Say so: a precise-looking marker at a place we
              deliberately made imprecise is the same "confidently wrong" failure
              as the assumed walk times, and it also explains to a renter why
              Directions stops at the corner rather than the door. */}
          {property.approximateLocation && (
            <p className="mt-3 text-sm text-slate-500 leading-relaxed">
              Approximate location — this owner shares the area rather than the
              exact address. You&apos;ll get directions to the door once you
              arrange a visit.
            </p>
          )}
        </SheetSection>
      )}

      {/* "Posted by" owner card removed 2026-07-22 (operator decision) — the
          owner's identity isn't shown on the public page; contact goes through
          chat/appointments, and phone visibility is the owner's own setting. */}

      {/* Reviews */}
      <SheetSection id="reviews" title="Community reviews">
        <ReviewsSection propertyId={property.id} isOwner={isOwner} ownerInfo={property?.owner} />
      </SheetSection>

      {/* "Homes like this one" sits LAST on purpose: it is the next-step action
          for somebody who has finished reading this listing and decided against
          it, so it must not compete with the listing's own facts.
          It owns its own SheetSection so the HEADING disappears with the
          content — a titled section above nothing is the exact bug the spatial
          panel shipped with once (see .claude/ui-ux.md). */}
      <SimilarHomes propertyId={property.id} />
    </Sheet>
  )
}
