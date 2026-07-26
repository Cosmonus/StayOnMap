import { useQuery } from '@tanstack/react-query'
import { Info } from 'lucide-react'
import { spatialService } from '@services/spatial.service'

// What renters will see computed from this pin, shown while the pin can still
// be moved. It is the one place in the wizard where the owner learns something
// instead of being asked something.
//
// Read straight from our own PoiIndex (free, unmetered, no Google call) and
// stated as DISTANCE, never as a walk time — a straight line across a rail
// line is not a six-minute walk. Same rule the property page follows.
const CATEGORIES = [
  { key: 'metro_station', label: 'a metro station' },
  { key: 'supermarket',   label: 'groceries' },
  { key: 'school',        label: 'a school' },
  { key: 'hospital',      label: 'a hospital' },
]

const RADIUS_M = 2000

function phrase(m) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`
}

export default function AreaPeek({ lat, lng }) {
  const { data } = useQuery({
    queryKey: ['wizard-area-peek', lat?.toFixed(4), lng?.toFixed(4)],
    queryFn: () =>
      spatialService
        .getPoisNear(lat, lng, CATEGORIES.map((c) => c.key).join(','), RADIUS_M)
        .then((r) => r.data),
    enabled: lat != null && lng != null,
    staleTime: 60 * 60 * 1000,
  })

  // No pin, or a city whose map data isn't loaded — say nothing. "We cannot
  // check" must never wear the clothes of a finding.
  if (!data?.available) return null

  const nearest = CATEGORIES
    .map((c) => ({ ...c, poi: data.pois.find((p) => p.category === c.key) }))
    .filter((c) => c.poi)
    .slice(0, 2)

  if (nearest.length === 0) return null

  return (
    <div className="flex items-start gap-3 p-4 rounded-2xl bg-brand-50 text-brand-900">
      <Info size={16} strokeWidth={2} className="mt-0.5 shrink-0 text-brand-700" aria-hidden="true" />
      <p className="text-sm leading-relaxed">
        We found{' '}
        {nearest.map((c, i) => (
          <span key={c.key}>
            {i > 0 && ' and '}
            <strong className="font-semibold">
              {c.poi.name || c.label} {phrase(c.poi.distanceM)}
            </strong>
          </span>
        ))}{' '}
        from this pin. Renters will see these on your listing.
      </p>
    </div>
  )
}
