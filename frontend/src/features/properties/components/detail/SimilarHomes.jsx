import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { propertyService } from '@services/property.service'
import Price from '@components/listing/Price'
import { imgUrl } from '@utils/format'
import { SheetSection } from './SheetPrimitives'

// "Homes like this one" — the SIMILAR_TO edge, made visible.
//
// The edges are materialised server-side (features/graph/similarity.js), so this
// is one indexed read, not a scoring pass on render.
//
// TWO THINGS IT DELIBERATELY DOES NOT DO:
//   • It never shows the similarity score. The number orders the row and is
//     meaningful only relative to other candidates for the SAME listing;
//     printing "87% similar" would imply a precision it does not have.
//   • It renders NOTHING when there are no neighbours — no empty state, no
//     "we couldn't find similar homes". With thin inventory that is the common
//     case, and an empty section on every page teaches people to scroll past
//     the whole area. A section that isn't there costs nothing.
//
// The price goes through the shared `Price` primitive rather than a hand-written
// suffix, because `rent` means four different things across the six property
// types and this row shows several of them.
export default function SimilarHomes({ propertyId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['similar-properties', propertyId],
    queryFn: () => propertyService.getSimilar(propertyId).then((r) => r.data),
    enabled: !!propertyId,
    staleTime: 5 * 60 * 1000,
  })

  // Nothing at all while loading, and nothing when there are no neighbours —
  // INCLUDING the heading, which is why this component owns its own section.
  // A skeleton here would promise content we may not have.
  if (isLoading || !data?.length) return null

  return (
    <SheetSection id="similar" title="Similar homes">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
      {data.map((property) => (
        <Link
          key={property.id}
          to={`/property/${property.id}`}
          className="group rounded-2xl border border-slate-200 bg-white overflow-hidden hover:shadow-md transition-shadow duration-normal no-underline"
        >
          <div className="aspect-[16/9] bg-slate-100 overflow-hidden">
            {property.images?.[0]?.url ? (
              <img
                src={imgUrl(property.images[0].url)}
                alt={property.title}
                loading="lazy"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-slow"
              />
            ) : null}
          </div>
          <div className="p-4">
            <Price property={property} size="card" />
            <p className="mt-1 text-sm font-medium text-slate-800 truncate">{property.title}</p>
            <p className="text-xs text-slate-500 truncate">
              {[property.landmark, property.city].filter(Boolean).join(', ')}
            </p>
          </div>
          </Link>
        ))}
      </div>
    </SheetSection>
  )
}
