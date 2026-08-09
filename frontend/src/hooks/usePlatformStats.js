// Real, live platform numbers — never hardcode marketing stats, fetch this instead
import { useQuery } from '@tanstack/react-query'
import { propertyService } from '@services/property.service'

export function usePlatformStats() {
  const { data, isLoading, isError } = useQuery({
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
    // Five surfaces print these as plain facts — the login modal's stat row,
    // the homepage, About, Contact, the map preview. The `?? 0` fallbacks are
    // right for "not loaded yet" and a LIE on failure: "0 Listings · 0 Cities"
    // is a claim about the business, rendered with the same confidence as a
    // real number, on the screen a stranger sees first. Callers must be able to
    // withhold rather than publish a zero they were never told.
    isError,
  }
}
