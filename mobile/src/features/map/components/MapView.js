import { useEffect, useMemo, useRef, useState } from 'react'
import { View, StyleSheet } from 'react-native'
import NativeMapView, { PROVIDER_GOOGLE, Circle } from 'react-native-maps'
import { useMapStore } from '@store/mapStore'
import { useFilterStore } from '@store/filterStore'
import { useMapPins } from '../hooks/useMapPins'
import { useMetroNetwork } from '../hooks/useMetroNetwork'
import { useItCorridors } from '../hooks/useItCorridors'
import { computeClusters, getExpansionZoom } from '../utils/clustering'
import { zoomToDelta, regionToZoom } from '../utils/regionZoom'
import { nearestCity } from '../utils/nearestCity'
import { CITIES } from '@config/cities'
import PropertyPin from './PropertyPin'
import ClusterMarker from './ClusterMarker'
import MetroLines from './MetroLines'

const IT_CORRIDOR_COLORS = { major: '#2563eb', moderate: '#60a5fa' }

const CITY_ZOOM = 12
const AREA_ZOOM = 15

// Keep place/locality and road names so users can orient themselves, but
// hide business POI clutter (shops, restaurants) and transit icons — our
// PropertyPin/ClusterMarker markers carry the listing info. Only applies
// under PROVIDER_GOOGLE (has no effect on Apple Maps).
const MAP_STYLE = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
]

export default function MapView({ onPinPress, onDeselect }) {
  const mapRef = useRef(null)
  const pendingFlyRef = useRef(null)
  const [mapReady, setMapReady] = useState(false)
  const { onRegionChangeComplete, fetchPinsNow } = useMapPins()

  const region = useMapStore((s) => s.region)
  const bounds = useMapStore((s) => s.bounds)
  const pins = useMapStore((s) => s.pins)
  const selectedPinId = useMapStore((s) => s.selectedPinId)
  const selectedAreaSlug = useMapStore((s) => s.selectedAreaSlug)
  const searchedPlace = useMapStore((s) => s.searchedPlace)
  const selectPin = useMapStore((s) => s.selectPin)
  const clearSelection = useMapStore((s) => s.clearSelection)
  const setFlyTo = useMapStore((s) => s.setFlyTo)
  const setRegion = useMapStore((s) => s.setRegion)

  const city = useFilterStore((s) => s.filters.city)
  const area = useFilterStore((s) => s.filters.area)
  const activeLayers = useMapStore((s) => s.activeLayers)

  // Metro/IT-corridor data is fetched per-city from the backend (unlike web,
  // which bundles all cities client-side and filters locally) — without a
  // fallback, the layer pills would do nothing until the user explicitly
  // picks a city filter. Fall back to whichever supported city is nearest
  // the current viewport so the toggle always has something to show.
  const effectiveCity = city || nearestCity(region.latitude, region.longitude)

  const { data: metroNetwork } = useMetroNetwork(effectiveCity)
  const { data: itCorridors } = useItCorridors(effectiveCity)

  // Every programmatic camera move funnels through here instead of calling
  // animateToRegion directly. react-native-maps' onRegionChangeComplete is
  // NOT reliably fired after animateToRegion on Android (the same class of
  // issue already worked around for fitToCoordinates in useMapPins.js) — if
  // we only waited for that event, a search/city/cluster fly could move the
  // camera while pins and clustering zoom silently stay stuck on the
  // pre-fly viewport. Since the destination region is already known here,
  // update the store and refetch pins immediately instead of hoping the
  // native event shows up.
  function flyTo(latitude, longitude, zoom) {
    const nextRegion = { latitude, longitude, ...zoomToDelta(zoom ?? 12) }
    mapRef.current?.animateToRegion(nextRegion, 400)
    setRegion(nextRegion)
    fetchPinsNow(nextRegion)
  }

  // Register the imperative flyTo closure once the native map is mounted —
  // same registration pattern as web's MapView (.claude/maps.md). Any page
  // can call useMapStore.getState().flyTo(...); if the native map isn't
  // ready yet (mapRef.current is null right after mounting/switching tabs),
  // queue the request instead of silently dropping it, and flush it once
  // onMapReady fires below.
  useEffect(() => {
    setFlyTo((opts) => {
      if (!mapReady) { pendingFlyRef.current = opts; return }
      flyTo(opts.latitude, opts.longitude, opts.zoom)
    })
    return () => setFlyTo(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setFlyTo, mapReady])

  useEffect(() => {
    if (!mapReady || !pendingFlyRef.current) return
    const { latitude, longitude, zoom } = pendingFlyRef.current
    pendingFlyRef.current = null
    flyTo(latitude, longitude, zoom)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady])

  function handleMapReady() {
    setMapReady(true)
    const coords = CITIES.map((c) => ({ latitude: c.lat, longitude: c.lng }))
    mapRef.current?.fitToCoordinates(coords, {
      edgePadding: { top: 80, right: 60, bottom: 80, left: 60 },
      animated: false,
    })
  }

  // Fly to city when the city filter changes (unless an area is also set —
  // the area effect below takes precedence, mirrors web's MapView). Gated on
  // mapReady — the native map isn't ready to accept animateToRegion the
  // instant this component mounts (e.g. right after switching tabs), and
  // since mapRef.current?.animateToRegion() silently no-ops on a null ref,
  // a fly triggered before onMapReady fired was otherwise lost for good.
  useEffect(() => {
    if (!mapReady || !city || area) return
    const cityData = CITIES.find((c) => c.name === city)
    if (!cityData) return
    flyTo(cityData.lat, cityData.lng, CITY_ZOOM)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, area, mapReady])

  // Fly to the searched area. MapSearchBar always resolves a place (via
  // Google Places autocomplete or, failing that, a direct geocode) before
  // ever setting `area`, so `searchedPlace` is guaranteed to be set here too
  // — no need for this effect to geocode independently.
  useEffect(() => {
    if (!mapReady || !area || !searchedPlace) return
    flyTo(searchedPlace.lat, searchedPlace.lng, AREA_ZOOM)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [area, searchedPlace, mapReady])

  const clusters = useMemo(() => {
    if (!bounds) return []
    return computeClusters(pins, bounds, regionToZoom(region))
  }, [pins, bounds, region])

  const zoom = regionToZoom(region)

  function handleClusterPress(feature) {
    const [lng, lat] = feature.geometry.coordinates
    const expandZoom = Math.min(getExpansionZoom(feature.properties.cluster_id), 20)
    flyTo(lat, lng, expandZoom)
  }

  function handlePinPress(feature) {
    const id = feature.properties.id
    if (id === selectedPinId) {
      clearSelection()
      onDeselect?.()
      return
    }
    selectPin(id)
    onPinPress?.(id)
  }

  // Tapping empty map area (not a marker) deselects whichever card is open —
  // Marker's onPress stops propagation, so this only fires on true empty taps.
  function handleMapPress() {
    if (!selectedPinId && !selectedAreaSlug) return
    clearSelection()
    onDeselect?.()
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
        onPress={handleMapPress}
        showsUserLocation
        showsMyLocationButton={false}
        showsTraffic={activeLayers.traffic}
        customMapStyle={MAP_STYLE}
      >
        {activeLayers.metro && <MetroLines network={metroNetwork} zoom={zoom} bounds={bounds} />}

        {activeLayers.itCorridors && itCorridors?.features.map((feature) => {
          const [lng, lat] = feature.geometry.coordinates
          const color = IT_CORRIDOR_COLORS[feature.properties.level] ?? IT_CORRIDOR_COLORS.moderate
          return (
            <Circle
              key={feature.properties.name}
              center={{ latitude: lat, longitude: lng }}
              radius={feature.properties.radiusMeters}
              strokeColor={color}
              fillColor={`${color}22`}
              strokeWidth={1.5}
            />
          )
        })}

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
              pin={{ id: feature.properties.id, lat, lng, rent: feature.properties.rent, type: feature.properties.type, bhk: feature.properties.bhk, sharing: feature.properties.sharing }}
              selected={feature.properties.id === selectedPinId}
              onPress={() => handlePinPress(feature)}
            />
          )
        })}
      </NativeMapView>
    </View>
  )
}
