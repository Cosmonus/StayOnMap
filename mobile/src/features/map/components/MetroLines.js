import { Polyline, Marker } from 'react-native-maps'
import { View, StyleSheet } from 'react-native'
import { colors } from '@theme/colors'
import { useMarkerRedraw } from '../hooks/useMarkerRedraw'

const STATION_SHOW_ZOOM = 13 // stations only render zoomed-in — up to ~280 of them (Delhi), too dense/expensive otherwise

// Real metro/light-rail lines + stations (react-native-maps Polyline/Marker),
// sourced from OpenStreetMap via the backend's /api/v1/metro proxy — see
// docs/features/map.md. Lines always render when a network exists for the
// city (cheap, at most ~13 for Delhi); station dots are zoom-gated.
//
// Each station carries a precomputed `lines` array (indices into
// network.lines, proximity-matched — see .claude/roadmap.md Addendum 6):
// 2+ entries means a genuine interchange (tight <400m match on both lines),
// 1 entry colors the dot to match its line, 0 means it doesn't yet
// reconcile with any line in this file (falls back to the default color).
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

export default function MetroLines({ network, zoom }) {
  if (!network) return null

  const showStations = zoom >= STATION_SHOW_ZOOM

  return (
    <>
      {network.lines.map((line) => (
        <Polyline
          key={line.name}
          coordinates={line.path.map(([lat, lng]) => ({ latitude: lat, longitude: lng }))}
          strokeColor={line.color || colors.brand600}
          strokeWidth={3}
        />
      ))}

      {showStations && network.stations.map((station) => {
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
