// Live "Show N places" count for the filter sheet — counts matches for a
// DRAFT filter object inside the current map viewport, debounced so rapid
// chip-tapping doesn't spam the API. Mirrors web's useFilterCount.
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useMapStore } from '@store/mapStore'
import { propertyService } from '@services/property.service'
import { toQueryParams } from '@config/filters'

const DEBOUNCE_MS = 300

export function useFilterCount(draft, enabled) {
  const bounds = useMapStore((s) => s.bounds)
  const paramsKey = JSON.stringify(toQueryParams(draft))

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
    placeholderData: (prev) => prev,
  })

  return { count: data?.count ?? null, isFetching }
}
