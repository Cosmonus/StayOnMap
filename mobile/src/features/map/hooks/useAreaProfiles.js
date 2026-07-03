import { useQuery } from '@tanstack/react-query'
import { areasService } from '@services/areas.service'

// Fetches the full area-intelligence list (not city-scoped — the dataset is
// small, ~1 dozen profiles per city, and this doubles as both the map-label
// data source and the filter-toggle matching data source regardless of
// which city filter is active). Cached forever — this is static reference
// data, not something that changes during a session.
export function useAreaProfiles() {
  return useQuery({
    queryKey: ['area-profiles'],
    queryFn: () => areasService.list().then((r) => r.data),
    staleTime: Infinity,
  })
}
