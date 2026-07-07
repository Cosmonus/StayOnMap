// Live "Show N homes" count for the filter modal — counts matches for a
// DRAFT filter object inside the current map viewport, debounced so rapid
// chip-toggling doesn't spam the API.
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useMapStore } from '@store/mapStore'
import { propertyService } from '@services/property.service'
import { toQueryParams } from '@/config/filters'

const DEBOUNCE_MS = 300

export function useFilterCount(draft, enabled) {
  const bounds = useMapStore((s) => s.bounds)
  const params = toQueryParams(draft)
  const paramsKey = JSON.stringify(params)

  const [debouncedKey, setDebouncedKey] = useState(paramsKey)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedKey(paramsKey), DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [paramsKey])

  const { data, isFetching } = useQuery({
    queryKey: ['filter-count', debouncedKey, bounds],
    queryFn: () => propertyService.getCount(bounds, JSON.parse(debouncedKey)).then((r) => r.data),
    enabled: enabled && !!bounds,
    staleTime: 15 * 1000,
    placeholderData: (prev) => prev, // keep last count on screen while refetching
  })

  return { count: data?.count ?? null, isFetching }
}
