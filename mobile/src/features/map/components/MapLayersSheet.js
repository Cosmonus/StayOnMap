import { View, Text, Modal, Pressable, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useMapStore } from '@store/mapStore'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// Visual map overlays — distinct from MapFiltersSheet, which filters which
// listings show. Mirrors web's MapRightPanel "Map layers" section.
const LAYERS = [
  ['metro', 'Metro lines', 'Stations & routes', 'mapPin'],
  ['itCorridors', 'IT corridors', 'Tech parks & hubs', 'building'],
  ['traffic', 'Live traffic', 'Real-time congestion', 'clock'],
]

export default function MapLayersSheet({ visible, onClose }) {
  const activeLayers = useMapStore((s) => s.activeLayers)
  const toggleLayer = useMapStore((s) => s.toggleLayer)

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.heading}>Map layers</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Icon name="close" size={20} color={colors.slate500} />
            </Pressable>
          </View>

          <View style={styles.toggleGroup}>
            {LAYERS.map(([key, label, sub, icon]) => (
              <Pressable key={key} style={styles.toggleRow} onPress={() => toggleLayer(key)}>
                <View style={styles.toggleLabelRow}>
                  <Icon name={icon} size={15} color={colors.slate500} />
                  <View>
                    <Text style={styles.toggleLabel}>{label}</Text>
                    <Text style={styles.toggleSub}>{sub}</Text>
                  </View>
                </View>
                <View style={[styles.switchTrack, activeLayers[key] && styles.switchTrackActive]}>
                  <View style={[styles.switchThumb, activeLayers[key] && styles.switchThumbActive]} />
                </View>
              </Pressable>
            ))}
          </View>

          <SafeAreaView edges={['bottom']} />
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  heading: { fontFamily: fonts.displayBold, fontSize: fontSizes.xl, color: colors.slate800 },
  toggleGroup: { gap: spacing.xs },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm },
  toggleLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  toggleLabel: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.slate700 },
  toggleSub: { fontFamily: fonts.body, fontSize: 11, color: colors.slate400, marginTop: 1 },
  switchTrack: { width: 40, height: 24, borderRadius: 12, backgroundColor: colors.slate200, padding: 2 },
  switchTrackActive: { backgroundColor: colors.brand600 },
  switchThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.white },
  switchThumbActive: { transform: [{ translateX: 16 }] },
})
