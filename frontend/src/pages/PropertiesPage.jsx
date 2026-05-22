import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import MapView from '@features/map/components/MapView'
import MapRightPanel from '@features/map/components/MapRightPanel'
import MapLegend from '@features/map/components/MapLegend'
import AreaInsightCard from '@features/map/components/AreaInsightCard'
import SEOMeta from '@components/common/SEOMeta'
import { useFilterStore } from '@store/filterStore'
import { canonical } from '@lib/seo'

export default function PropertiesPage() {
  const [searchParams] = useSearchParams()
  const setFilters = useFilterStore((s) => s.setFilters)

  const city = searchParams.get('city') || ''
  const area = searchParams.get('area') || ''

  useEffect(() => {
    setFilters({ city, area })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const locationLabel = [area, city].filter(Boolean).join(', ')
  const pageTitle = locationLabel
    ? `Rental Properties in ${locationLabel}`
    : 'Browse Rental Properties on the Map'
  const pageDesc = locationLabel
    ? `Browse broker-free rental properties in ${locationLabel} — search live on the map with price, BHK, and furnishing filters.`
    : 'Browse broker-free rental properties across India on a live map. Filter by city, BHK, furnishing, and budget — no broker fees.'

  return (
    <>
      <SEOMeta
        title={pageTitle}
        description={pageDesc}
        canonical={canonical('/properties')}
      />
      <MapView />
      <MapLegend />
      <AreaInsightCard />
      <MapRightPanel />
    </>
  )
}
