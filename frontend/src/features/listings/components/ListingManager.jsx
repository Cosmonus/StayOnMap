import { useQuery } from '@tanstack/react-query'
import { propertyService } from '@services/property.service'
import { formatRent } from '@utils/format'
import PropertyStatusPill from '@components/common/PropertyStatusPill'

const MAX_LISTINGS = 3

function ListingCard({ property, onViewDetails }) {
  const images = property.images ?? []

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
      <div className="relative aspect-video bg-slate-100">
        {images[0] ? (
          <img src={images[0].url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
            </svg>
          </div>
        )}
        <span className="absolute top-2 left-2">
          <PropertyStatusPill status={property.status} size="sm" />
        </span>
      </div>

      <div className="px-4 py-3 flex flex-col gap-1 flex-1">
        <p className="text-sm font-semibold text-slate-800 line-clamp-1">{property.title}</p>
        <p className="text-base font-bold text-brand-600">{formatRent(Number(property.rent))}</p>
        {property.city && (
          <p className="text-xs text-slate-400 flex items-center gap-1">
            <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {property.city}{property.state ? `, ${property.state}` : ''}
          </p>
        )}
      </div>

      <div className="border-t border-slate-100 px-4 py-2.5">
        <button
          onClick={() => onViewDetails(property.id)}
          className="w-full py-1.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors flex items-center justify-center gap-1.5"
        >
          View details
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>
    </div>
  )
}

function EmptySlotPlaceholder({ onAdd }) {
  return (
    <button
      onClick={onAdd}
      className="rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center min-h-[200px] hover:border-slate-300 hover:bg-slate-50 transition-colors group"
    >
      <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-slate-200 flex items-center justify-center mb-2 transition-colors">
        <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 4v16m8-8H4" />
        </svg>
      </div>
      <p className="text-sm font-medium text-slate-400 group-hover:text-slate-500">Add listing</p>
    </button>
  )
}


export default function ListingManager({ onAdd, onViewDetails }) {
  const { data: listings = [], isLoading } = useQuery({
    queryKey: ['my-listings'],
    queryFn: () => propertyService.getMyListings().then(r => r.data),
  })

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {[1,2,3,4].map(i => <div key={i} className="rounded-2xl bg-slate-100 animate-pulse min-h-[200px]" />)}
      </div>
    )
  }

  if (listings.length === 0) {
    return (
      <button
        onClick={onAdd}
        className="w-full text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl hover:border-slate-300 hover:bg-slate-50 transition-colors"
      >
        <p className="text-sm font-medium text-slate-500">No listings yet</p>
        <p className="text-xs text-slate-400 mt-1">Click to add your first listing</p>
      </button>
    )
  }

  const emptySlots = Math.max(0, MAX_LISTINGS - listings.length)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
      {listings.map(p => (
        <ListingCard key={p.id} property={p} onViewDetails={onViewDetails} />
      ))}
      {Array.from({ length: emptySlots }).map((_, i) => (
        <EmptySlotPlaceholder key={`empty-${i}`} onAdd={onAdd} />
      ))}
    </div>
  )
}
