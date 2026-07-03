import { useQuery } from '@tanstack/react-query'
import { metroService } from '@services/metro.service'

// Real metro/light-rail lines + stations for the current city filter — null
// (not an empty network) for cities with no data file yet (see
// backend/src/features/metro/metro.service.js).
export function useMetroNetwork(city) {
  return useQuery({
    queryKey: ['metro-network', city],
    queryFn: () => metroService.get(city).then((r) => r.data),
    enabled: !!city,
    staleTime: Infinity,
  })
}
