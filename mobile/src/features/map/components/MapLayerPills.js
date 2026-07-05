import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useMapStore } from '@store/mapStore'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// Mirrors web's MapControls.jsx — small toggle pills, top-left of the map,
// each tap toggles that layer directly (no sheet/modal in between).
const LAYERS = [
  ['metro', 'Metro', 'mapPin', '#7C3AED'],
  ['itCorridors', 'IT Zones', 'building', '#2563EB'],
  ['traffic', 'Traffic', 'clock', '#F59E0B'],
]

export default function MapLayerPills() {
  const activeLayers = useMapStore((s) => s.activeLayers)
  const toggleLayer = useMapStore((s) => s.toggleLayer)

  return (
    <View style={styles.container}>
      {LAYERS.map(([key, label, icon, activeColor]) => {
        const active = activeLayers[key]
        return (
          <Pressable
            key={key}
            style={[styles.pill, active && { backgroundColor: activeColor, borderColor: activeColor }]}
            onPress={() => toggleLayer(key)}
          >
            <Icon name={icon} size={14} color={active ? colors.white : colors.slate600} />
            <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', flexWrap: 'wrap', alignSelf: 'flex-start', gap: spacing.xs, paddingHorizontal: spacing.md, marginTop: spacing.md },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.slate200, backgroundColor: colors.white,
    borderRadius: radius.md, paddingHorizontal: spacing.sm + 2, paddingVertical: spacing.xs + 2,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },
  pillText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.slate600 },
  pillTextActive: { color: colors.white },
})
