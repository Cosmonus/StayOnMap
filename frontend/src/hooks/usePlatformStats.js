// Real, live platform numbers — never hardcode marketing stats, fetch this instead
import { useQuery } from '@tanstack/react-query'
import { propertyService } from '@services/property.service'

export function usePlatformStats() {
  const { data, isLoading } = useQuery({
    queryKey: ['platform-stats'],
    queryFn: () => propertyService.getStats().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  })

  return {
    totalActive: data?.totalActive ?? 0,
    activeOwners: data?.activeOwners ?? 0,
    cities: data?.cities ?? 0,
    byCity: data?.byCity ?? {},
    isLoading,
  }
}
