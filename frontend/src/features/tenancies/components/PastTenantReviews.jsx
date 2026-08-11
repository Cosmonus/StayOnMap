import { useQuery } from '@tanstack/react-query'
import { Star } from 'lucide-react'
import { tenancyService } from '@services/tenancy.service'

// What people who actually LIVED under this owner say — distinct from
// CommunityReview (about the property, from anyone approved) in the one way
// that matters: every entry here is backed by a confirmed tenancy record, and
// it survived the double-blind window. Renders nothing when there are none:
// most owners have no tenancy reviews yet, and an empty "past tenants" box
// under every listing would read as a warning.
export default function PastTenantReviews({ propertyId }) {
  const { data: reviews = [] } = useQuery({
    queryKey: ['owner-reviews', propertyId],
    queryFn: () => tenancyService.ownerReviews(propertyId).then((r) => r.data),
  })

  if (!reviews.length) return null

  return (
    <section>
      <h2 className="text-lg font-bold text-slate-800 mb-1">From past tenants</h2>
      <p className="text-sm text-slate-500 mb-4">
        Written by people with a confirmed tenancy under this owner — not necessarily in this home.
      </p>
      <div className="space-y-3">
        {reviews.map((r, i) => (
          <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-800">
                {r.reviewerFirstName} · {r.city}
              </p>
              <span className="inline-flex items-center gap-0.5 shrink-0" role="img" aria-label={`Rated ${r.rating} out of 5`}>
                {[1, 2, 3, 4, 5].map((n) => (
                  // eslint-disable-next-line no-restricted-syntax -- aria-hidden glyph in a role=img group; the label carries the rating, the grey star is decorative
                  <Star key={n} size={13} aria-hidden="true" className={n <= r.rating ? 'text-amber-500 fill-amber-500' : 'text-slate-300'} />
                ))}
              </span>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed mt-2">{r.content}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
