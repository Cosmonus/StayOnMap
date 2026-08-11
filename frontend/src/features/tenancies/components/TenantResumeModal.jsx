import { useQuery } from '@tanstack/react-query'
import { Star, KeyRound } from 'lucide-react'
import { tenancyService } from '@services/tenancy.service'
import Modal from '@components/common/Modal'

// A renter's rental résumé, opened by an OWNER from a visit request. The
// backend only answers when a conversation or visit request connects these
// two people — a 404 here means "no history to show", never an error worth
// a red state.
//
// City and property TYPE only, by design: the résumé says how this person
// rents, not where to find their previous home.

const TYPE_WORD = {
  APARTMENT: 'Apartment', HOUSE: 'House', VILLA: 'Villa',
  INDEPENDENT_HOUSE: 'Independent house', PG: 'PG', COMMERCIAL: 'Commercial',
  LAND: 'Land', SHORT_STAY: 'Short stay',
}

function span(e) {
  const from = new Date(e.startedAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
  const to = e.endedAt
    ? new Date(e.endedAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
    : 'now'
  return `${from} – ${to}`
}

export default function TenantResumeModal({ userId, name, onClose }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['tenant-resume', userId],
    queryFn: () => tenancyService.resume(userId).then((r) => r.data),
    retry: false, // a 404 is an answer, not a flake
  })

  return (
    <Modal isOpen onClose={onClose} title={`${name?.split(' ')[0] ?? 'Renter'}’s rental history`}>
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />)}
        </div>
      ) : isError || !data?.count ? (
        <p className="text-sm text-slate-600 py-4">
          No confirmed rental history on StayOnMap yet. That&rsquo;s the normal state for most
          renters — history builds one tenancy at a time.
        </p>
      ) : (
        <div className="space-y-3">
          <p className="flex items-center gap-2 text-sm text-slate-600">
            <KeyRound size={14} className="text-brand-600" aria-hidden="true" />
            {data.count} confirmed tenanc{data.count === 1 ? 'y' : 'ies'}
            {data.averageRating != null && (
              <span className="inline-flex items-center gap-1 font-semibold text-slate-800">
                · {data.averageRating}
                <Star size={13} className="text-amber-500 fill-amber-500" aria-hidden="true" />
              </span>
            )}
          </p>
          {data.tenancies.map((e, i) => (
            <div key={i} className="rounded-xl border border-slate-200 p-3">
              <p className="text-sm font-semibold text-slate-800">
                {TYPE_WORD[e.propertyType] ?? e.propertyType} in {e.city}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">{span(e)}</p>
              {e.review && (
                <div className="mt-2 rounded-lg bg-slate-50 p-2.5">
                  <span className="inline-flex items-center gap-0.5" role="img" aria-label={`Rated ${e.review.rating} out of 5`}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      // eslint-disable-next-line no-restricted-syntax -- aria-hidden glyph in a role=img group; the label carries the rating, the grey star is decorative
                      <Star key={n} size={12} aria-hidden="true" className={n <= e.review.rating ? 'text-amber-500 fill-amber-500' : 'text-slate-300'} />
                    ))}
                  </span>
                  <p className="text-sm text-slate-700 leading-relaxed mt-1">{e.review.content}</p>
                </div>
              )}
            </div>
          ))}
          <p className="text-xs text-slate-500">
            Reviews are written by previous owners and shown only after the double-blind window.
          </p>
        </div>
      )}
    </Modal>
  )
}
