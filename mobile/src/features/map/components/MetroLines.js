import { Polyline, Marker } from 'react-native-maps'
import { View, StyleSheet } from 'react-native'
import { colors } from '@theme/colors'
import { useMarkerRedraw } from '../hooks/useMarkerRedraw'

const STATION_SHOW_ZOOM = 13 // stations only render zoomed-in — up to ~280 of them (Delhi), too dense/expensive otherwise

// A handful of lines have a genuine gap in the source OSM data (no
// fetchable track geometry for that stretch) — rendering the full path as one
// Polyline draws a straight "fake bridge" across the gap, implying a direct
// route that doesn't exist. The metro data engine now precomputes the split
// server-side as an additive per-line `segments` field (only present when a
// line genuinely splits — see backend/src/metro-engine/export/segments.js);
// the local splitter below is the fallback for payloads without it, kept
// because mobile can't import backend code.
const PATH_GAP_METERS = 2000
const EARTH_RADIUS_M = 6371000

function toRad(deg) {
  return (deg * Math.PI) / 180
}

function haversineMeters([lat1, lng1], [lat2, lng2]) {
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a))
}

function splitPathAtGaps(path, gapMeters) {
  if (path.length === 0) return []
  const components = [[path[0]]]
  for (let i = 1; i < path.length; i++) {
    if (haversineMeters(path[i - 1], path[i]) > gapMeters) components.push([])
    components[components.length - 1].push(path[i])
  }
  return components.filter((c) => c.length >= 2)
}

// Unlike property pins (already viewport-bounds-filtered server-side, see
// GET /properties/pins), the metro network is fetched whole-city
// (GET /api/v1/metro?city=) — a dense city like Delhi has ~280 stations,
// and rendering every one of them as a custom-view Marker regardless of
// what's actually on screen is real, avoidable jank (each custom-view
// marker costs a JS-to-native bridge snapshot). Filter to the current
// viewport (+ a padding margin so panning slightly doesn't pop markers in
// abruptly) before rendering any of them.
const VIEWPORT_PADDING_RATIO = 0.2

function isStationInBounds(station, bounds) {
  if (!bounds) return true
  const latPad = (bounds.neLat - bounds.swLat) * VIEWPORT_PADDING_RATIO
  const lngPad = (bounds.neLng - bounds.swLng) * VIEWPORT_PADDING_RATIO
  return (
    station.lat >= bounds.swLat - latPad &&
    station.lat <= bounds.neLat + latPad &&
    station.lng >= bounds.swLng - lngPad &&
    station.lng <= bounds.neLng + lngPad
  )
}

// Real metro/light-rail lines + stations (react-native-maps Polyline/Marker),
// sourced from OpenStreetMap via the backend's /api/v1/metro proxy — see
// docs/features/map.md. Lines always render when a network exists for the
// city (cheap, at most ~13 for Delhi); station dots are zoom-gated.
//
// Each station carries a precomputed `lines` array (indices into
// network.lines, derived from OSM route-relation membership by the metro
// data engine): 2+ entries means a genuine interchange, 1 entry colors the
// dot to match its line, 0 means it doesn't reconcile with any line in this
// file (falls back to the default color).
// Split out so useMarkerRedraw (a hook) can be called once per station,
// not inside the .map() loop below.
function StationMarker({ station, dotColor, isInterchange }) {
  // Was hardcoded tracksViewChanges={false} — never gave react-native-maps a
  // chance to snapshot the custom dot, so it rendered as the default red
  // pin. Content is static per station, so a constant key is enough.
  const { tracksViewChanges, onLayout } = useMarkerRedraw(station.name)

  return (
    <Marker
      coordinate={{ latitude: station.lat, longitude: station.lng }}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracksViewChanges}
    >
      <View
        style={[styles.stationDot, { borderColor: dotColor }, isInterchange && styles.stationDotInterchange]}
        onLayout={onLayout}
      />
    </Marker>
  )
}

export default function MetroLines({ network, zoom, bounds }) {
  if (!network) return null

  const showStations = zoom >= STATION_SHOW_ZOOM
  const visibleStations = showStations ? network.stations.filter((s) => isStationInBounds(s, bounds)) : []

  return (
    <>
      {network.lines.map((line) =>
        (line.segments ?? splitPathAtGaps(line.path, PATH_GAP_METERS)).map((component, i) => (
          <Polyline
            key={`${line.name}-${i}`}
            coordinates={component.map(([lat, lng]) => ({ latitude: lat, longitude: lng }))}
            strokeColor={line.color || colors.brand600}
            strokeWidth={3}
          />
        ))
      )}

      {visibleStations.map((station) => {
        const matchedLines = (station.lines ?? []).map((i) => network.lines[i]).filter(Boolean)
        const isInterchange = matchedLines.length > 1
        const dotColor = matchedLines[0]?.color || colors.slate600

        return (
          <StationMarker
            key={station.name}
            station={station}
            dotColor={dotColor}
            isInterchange={isInterchange}
          />
        )
      })}
    </>
  )
}

const styles = StyleSheet.create({
  stationDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.white, borderWidth: 2,
  },
  stationDotInterchange: {
    width: 11, height: 11, borderRadius: 5.5, borderWidth: 2.5,
  },
})
