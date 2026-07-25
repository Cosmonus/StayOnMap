import { useQuery } from '@tanstack/react-query'
import { ImageOff, MapPin, ChevronRight } from 'lucide-react'
import { propertyService } from '@services/property.service'
import { formatPrice } from '@utils/format'
import PropertyStatusPill from '@components/common/PropertyStatusPill'

function ListingCard({ property, onViewDetails, onOfferLease }) {
  const images = property.images ?? []

  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col">
      <div className="relative aspect-video bg-slate-100">
        {images[0] ? (
          <img src={images[0].url} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-300">
            <ImageOff className="w-8 h-8" strokeWidth={1.5} />
          </div>
        )}
        <span className="absolute top-2 left-2">
          <PropertyStatusPill status={property.status} size="sm" />
        </span>
      </div>

      <div className="px-4 py-3 flex flex-col gap-1 flex-1">
        <p className="text-sm font-semibold text-slate-800 line-clamp-1">{property.title}</p>
        <p className="text-base font-bold text-brand-600">{formatPrice(property)}</p>
        {property.city && (
          <p className="text-xs text-slate-500 flex items-center gap-1">
            <MapPin className="w-3 h-3 shrink-0" strokeWidth={1.8} />
            {property.city}{property.state ? `, ${property.state}` : ''}
          </p>
        )}
      </div>

      <div className="border-t border-slate-100 px-4 py-2.5 flex gap-2">
        <button
          onClick={() => onViewDetails(property.id)}
          className="flex-1 py-1.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors flex items-center justify-center gap-1.5"
        >
          View details
          <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.8} />
        </button>
        {property.status === 'ACTIVE' && (
          <button
            onClick={() => onOfferLease(property)}
            className="flex-1 py-1.5 text-xs font-bold text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-xl transition-colors"
          >
            Offer lease
          </button>
        )}
      </div>
    </div>
  )
}

export default function ListingManager({ onAdd, onViewDetails, onOfferLease }) {
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
        <p className="text-xs text-slate-500 mt-1">Click to add your first listing</p>
      </button>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
      {listings.map(p => (
        <ListingCard key={p.id} property={p} onViewDetails={onViewDetails} onOfferLease={onOfferLease} />
      ))}
    </div>
  )
}
