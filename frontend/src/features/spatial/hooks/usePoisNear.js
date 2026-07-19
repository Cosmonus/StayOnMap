import { useQuery } from '@tanstack/react-query'
import { spatialService } from '@services/spatial.service'

// The named places behind one category's count, near a coordinate.
//
// Load-once, filter-locally: the list is fetched a single time per category
// (POIs don't change mid-session) and every keystroke of the search box
// filters the cached array — no request per keystroke, no request on reopen.
export default function usePoisNear({ lat, lng, category, radius, enabled }) {
  return useQuery({
    queryKey: ['spatial-pois', lat, lng, category, radius],
    queryFn: () =>
      spatialService.getPoisNear(lat, lng, category, radius).then((r) => r.data),
    enabled: Boolean(enabled && lat != null && lng != null && category),
    staleTime: 10 * 60 * 1000,
  })
}
