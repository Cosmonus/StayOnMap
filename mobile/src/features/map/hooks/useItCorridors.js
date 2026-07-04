import { useQuery } from '@tanstack/react-query'
import { itCorridorsService } from '@services/itCorridors.service'

// GeoJSON FeatureCollection of IT corridor polygons for the current city
// filter — empty for cities with no hand-authored data yet (see
// backend/src/features/itCorridors/itCorridors.service.js).
export function useItCorridors(city) {
  return useQuery({
    queryKey: ['it-corridors', city],
    queryFn: () => itCorridorsService.get(city).then((r) => r.data),
    enabled: !!city,
    staleTime: Infinity,
  })
}
