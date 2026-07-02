import { useEffect, useMemo, useRef } from 'react'
import { View, StyleSheet } from 'react-native'
import NativeMapView, { PROVIDER_GOOGLE, Marker } from 'react-native-maps'
import { useMapStore } from '@store/mapStore'
import { useFilterStore } from '@store/filterStore'
import { useMapPins } from '../hooks/useMapPins'
import { computeClusters, getExpansionZoom } from '../utils/clustering'
import { zoomToDelta, regionToZoom } from '../utils/regionZoom'
import { CITIES } from '@config/cities'
import { geocodeAddress } from '@lib/googleGeocoding'
import PropertyPin from './PropertyPin'
import ClusterMarker from './ClusterMarker'

const CITY_ZOOM = 12
const AREA_ZOOM = 15

export default function MapView({ onPinPress }) {
  const mapRef = useRef(null)
  const { onRegionChangeComplete } = useMapPins()

  const region = useMapStore((s) => s.region)
  const bounds = useMapStore((s) => s.bounds)
  const pins = useMapStore((s) => s.pins)
  const selectedPinId = useMapStore((s) => s.selectedPinId)
  const searchedPlace = useMapStore((s) => s.searchedPlace)
  const selectPin = useMapStore((s) => s.selectPin)
  const setFlyTo = useMapStore((s) => s.setFlyTo)

  const city = useFilterStore((s) => s.filters.city)
  const area = useFilterStore((s) => s.filters.area)

  // Register the imperative flyTo closure once the native map is mounted —
  // same registration pattern as web's MapView (.claude/maps.md).
  useEffect(() => {
    setFlyTo(({ latitude, longitude, zoom }) => {
      mapRef.current?.animateToRegion({ latitude, longitude, ...zoomToDelta(zoom ?? 12) }, 400)
    })
    return () => setFlyTo(null)
  }, [setFlyTo])

  function handleMapReady() {
    const coords = CITIES.map((c) => ({ latitude: c.lat, longitude: c.lng }))
    mapRef.current?.fitToCoordinates(coords, {
      edgePadding: { top: 80, right: 60, bottom: 80, left: 60 },
      animated: false,
    })
  }

  // Fly to city when the city filter changes (unless an area is also set —
  // the area effect below takes precedence, mirrors web's MapView).
  useEffect(() => {
    if (!city || area) return
    const cityData = CITIES.find((c) => c.name === city)
    if (!cityData) return
    mapRef.current?.animateToRegion({ latitude: cityData.lat, longitude: cityData.lng, ...zoomToDelta(CITY_ZOOM) }, 400)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, area])

  // Geocode area and fly there
  useEffect(() => {
    if (!area) return
    let cancelled = false
    const cityData = CITIES.find((c) => c.name === city)
    const address = cityData ? `${area}, ${cityData.name}, India` : `${area}, India`
    geocodeAddress(address).then((loc) => {
      if (cancelled || !loc) return
      mapRef.current?.animateToRegion({ latitude: loc.lat, longitude: loc.lng, ...zoomToDelta(AREA_ZOOM) }, 400)
    })
    return () => { cancelled = true }
  }, [area, city])

  const clusters = useMemo(() => {
    if (!bounds) return []
    return computeClusters(pins, bounds, regionToZoom(region))
  }, [pins, bounds, region])

  function handleClusterPress(feature) {
    const [lng, lat] = feature.geometry.coordinates
    const zoom = Math.min(getExpansionZoom(feature.properties.cluster_id), 20)
    mapRef.current?.animateToRegion({ latitude: lat, longitude: lng, ...zoomToDelta(zoom) }, 400)
  }

  function handlePinPress(feature) {
    selectPin(feature.properties.id)
    onPinPress?.(feature.properties.id)
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <NativeMapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        onMapReady={handleMapReady}
        onRegionChangeComplete={onRegionChangeComplete}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {clusters.map((feature) => {
          const [lng, lat] = feature.geometry.coordinates
          if (feature.properties.cluster) {
            return (
              <ClusterMarker
                key={`cluster-${feature.properties.cluster_id}`}
                coordinate={{ latitude: lat, longitude: lng }}
                count={feature.properties.point_count}
                onPress={() => handleClusterPress(feature)}
              />
            )
          }
          return (
            <PropertyPin
              key={feature.properties.id}
              pin={{ id: feature.properties.id, lat, lng, rent: feature.properties.rent }}
              selected={feature.properties.id === selectedPinId}
              onPress={() => handlePinPress(feature)}
            />
          )
        })}

        {searchedPlace && (
          <Marker
            coordinate={{ latitude: searchedPlace.lat, longitude: searchedPlace.lng }}
            pinColor="#f4511e"
          />
        )}
      </NativeMapView>
    </View>
  )
}
