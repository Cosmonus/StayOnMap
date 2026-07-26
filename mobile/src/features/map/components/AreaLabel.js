import { Marker } from 'react-native-maps'
import { View, Text, StyleSheet } from 'react-native'
import { colors } from '@theme/colors'
import { shadows } from '@theme/shadows'
import { fonts, fontSizes } from '@theme/typography'
import { radius } from '@theme/spacing'
import { useMarkerRedraw } from '../hooks/useMarkerRedraw'

// Mirrors frontend/src/features/map/hooks/useAreaLabels.js's dominant-trait
// dot coloring — same thresholds, same priority order.
function dominantColor(area) {
  if (area.floodRisk >= 7) return colors.danger
  if (area.itScore >= 8) return colors.brand600
  if (area.metroScore >= 8) return '#7c3aed'
  if (area.safetyScore >= 9) return colors.success
  return colors.slate400
}

export default function AreaLabel({ area, onPress }) {
  // Was hardcoded tracksViewChanges={false} — never gave react-native-maps a
  // chance to snapshot the custom pill, so it rendered as the default red
  // pin. Content is static per area, so a constant key is enough — this
  // just needs to track long enough to paint once on mount.
  const { tracksViewChanges, onLayout } = useMarkerRedraw(area.slug)

  return (
    <Marker
      coordinate={{ latitude: area.lat, longitude: area.lng }}
      onPress={onPress}
      tracksViewChanges={tracksViewChanges}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <View style={styles.pill} onLayout={onLayout}>
        <View style={[styles.dot, { backgroundColor: dominantColor(area) }]} />
        <Text style={styles.text} numberOfLines={1}>{area.name}</Text>
      </View>
    </Marker>
  )
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.slate200,
    borderRadius: radius.full, paddingVertical: 3, paddingRight: 10, paddingLeft: 7,
    ...shadows.md,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  text: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.slate800 },
})
