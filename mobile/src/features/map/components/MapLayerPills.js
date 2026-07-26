import { View, StyleSheet } from 'react-native'
import { useMapStore } from '@store/mapStore'
import MapPill from './MapPill'
import { spacing } from '@theme/spacing'

// Mirrors web's MapControls.jsx — small toggle pills above the map, each tap
// toggles that layer directly (no sheet/modal in between).
//
// `trailing` joins the SAME wrapping row (web keeps Near me in this row too).
// Rendering it as a sibling row instead would let three pills sit on one line
// and Near me alone on the next; inside the row it wraps with them. Every pill
// in the row — these three and Near me — is the shared MapPill, so the row
// cannot drift into two looks the way it had.
const LAYERS = [
  ['metro', 'Metro', 'mapPin', '#7C3AED'],
  ['itCorridors', 'IT Zones', 'building', '#2563EB'],
  ['traffic', 'Traffic', 'clock', '#F59E0B'],
]

export default function MapLayerPills({ trailing }) {
  const activeLayers = useMapStore((s) => s.activeLayers)
  const toggleLayer = useMapStore((s) => s.toggleLayer)

  return (
    <View style={styles.container}>
      {LAYERS.map(([key, label, icon, activeColor]) => (
        <MapPill
          key={key}
          icon={icon}
          label={label}
          active={!!activeLayers[key]}
          activeColor={activeColor}
          onPress={() => toggleLayer(key)}
          accessibilityLabel={`${label} layer`}
          accessibilityState={{ selected: !!activeLayers[key] }}
        />
      ))}
      {trailing}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row', flexWrap: 'wrap', alignSelf: 'flex-start',
    gap: spacing.xs, paddingHorizontal: spacing.md, marginTop: spacing.md,
  },
})
