import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { graphService } from '@services/graph.service'
import Price from '@components/listing/Price'
import SaveHeartButton from '@components/common/SaveHeartButton'
import { imgUrl } from '@utils/format'

// "Homes for you" — where preferences, the SIMILAR_TO graph and ranking meet.
//
// It lives on the SAVED list on purpose. This is the one screen built out of a
// renter's own choices, so recommendations derived from those choices belong
// beside them rather than on a page with no relationship to the signal. It is
// also the honest place for it: somebody looking at their shortlist is deciding,
// which is when a good next suggestion is worth something.
//
// WHY EACH CARD SAYS WHY IT IS THERE. The backend returns `why.source` —
// `similar_to_saved` (a graph hop from something they kept) or
// `matches_your_search` (their areas and types, no graph involved). Those are
// different claims and presenting them as one is how a recommendation becomes an
// ad. The numeric score is deliberately NOT shown: it orders the list and means
// nothing in isolation.
//
// Renders nothing — heading included — when there is nothing to say. With thin
// inventory that is the common case, and a permanent empty block on the saved
// list would train people to scroll past the whole area.
const WHY_LABEL = {
  similar_to_saved: 'Like one you saved',
  matches_your_search: 'In an area you browse',
}

export default function HomesForYou() {
  const { data } = useQuery({
    queryKey: ['recommendations'],
    queryFn: () => graphService.recommendations().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const items = data?.items ?? []
  if (!items.length) return null

  return (
    <section className="pt-2">
      <h2 className="text-base font-bold text-slate-800 mb-1">Homes for you</h2>
      <p className="text-sm text-slate-500 mb-4">
        Based on what you have saved and visited. Only you can see this.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((property) => (
          <div
            key={property.id}
            className="group relative rounded-2xl border border-slate-200 bg-white overflow-hidden hover:shadow-md transition-shadow duration-normal"
          >
            {/* Stretched link rather than a wrapper, so the heart above it is a
                real button — an <a> may not contain one. */}
            <Link
              to={`/property/${property.id}`}
              aria-label={property.title}
              className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
            />
            <div className="relative aspect-[16/9] bg-slate-100 overflow-hidden">
              {property.images?.[0]?.url ? (
                <img
                  src={imgUrl(property.images[0].url, 'card')}
                  alt={property.title}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-slow"
                />
              ) : null}
              <SaveHeartButton propertyId={property.id} className="absolute top-3 right-3 z-20" />
            </div>
            <div className="p-4">
              <Price property={property} size="card" />
              <p className="mt-1 text-sm font-medium text-slate-800 truncate">{property.title}</p>
              <p className="text-xs text-slate-500 truncate">
                {[property.landmark, property.city].filter(Boolean).join(', ')}
              </p>
              {WHY_LABEL[property.why?.source] && (
                <p className="mt-2 inline-block px-2 py-1 rounded-lg bg-brand-50 text-brand-700 text-badge font-semibold">
                  {WHY_LABEL[property.why.source]}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
