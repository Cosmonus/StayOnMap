import { Polyline, Marker } from 'react-native-maps'
import { View, StyleSheet } from 'react-native'
import { colors } from '@theme/colors'

const STATION_SHOW_ZOOM = 13 // stations only render zoomed-in — up to ~280 of them (Delhi), too dense/expensive otherwise

// Real metro/light-rail lines + stations (react-native-maps Polyline/Marker),
// sourced from OpenStreetMap via the backend's /api/v1/metro proxy — see
// docs/features/map.md. Lines always render when a network exists for the
// city (cheap, at most ~13 for Delhi); station dots are zoom-gated.
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

      {showStations && network.stations.map((station) => (
        <Marker
          key={station.name}
          coordinate={{ latitude: station.lat, longitude: station.lng }}
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={false}
        >
          <View style={styles.stationDot} />
        </Marker>
      ))}
    </>
  )
}

const styles = StyleSheet.create({
  stationDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.white, borderWidth: 2, borderColor: colors.slate600,
  },
})
