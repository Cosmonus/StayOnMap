import { useMemo, useRef, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet'
import MapView from '@features/map/components/MapView'
import DiscoverListView from '@features/discover/components/DiscoverListView'
import { useMapStore } from '@store/mapStore'
import { useFilterStore } from '@store/filterStore'
import { formatCompact } from '@utils/format'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// Both PDF map-home directions live on one screen, sharing a single map
// instance: 'sheet' = 1a (map-first + bottom sheet), 'list' = 1b (split
// map + list feed). Two separate routes would mean two live native map
// views mounted at once in the stack — wasteful on a phone.
export default function ExploreScreen({ navigation }) {
  const [viewMode, setViewMode] = useState('sheet')
  const sheetRef = useRef(null)
  const pins = useMapStore((s) => s.pins)
  const selectedPinId = useMapStore((s) => s.selectedPinId)
  const clearSelection = useMapStore((s) => s.clearSelection)
  const city = useFilterStore((s) => s.filters.city)
  const area = useFilterStore((s) => s.filters.area)

  const selectedPin = useMemo(() => pins.find((p) => p.id === selectedPinId) ?? null, [pins, selectedPinId])

  function handlePinPress() {
    if (viewMode === 'sheet') sheetRef.current?.snapToIndex(1)
  }

  function goToDetail(propertyId) {
    navigation.navigate('PropertyDetail', { propertyId })
  }

  const locationLabel = area || city || null
  const isListMode = viewMode === 'list'

  return (
    <View style={styles.container}>
      <View style={isListMode ? styles.mapHalf : styles.mapFull}>
        <MapView onPinPress={handlePinPress} />
      </View>

      {isListMode && (
        <View style={styles.listHalf}>
          <DiscoverListView onCardPress={goToDetail} />
        </View>
      )}

      <SafeAreaView edges={['top']} style={styles.topBar} pointerEvents="box-none">
        <View style={styles.pill}>
          <View style={styles.pulseDot} />
          <Text style={styles.pillText}>
            {pins.length} listing{pins.length !== 1 ? 's' : ''}
            {locationLabel ? ` in ${locationLabel}` : ''}
          </Text>
        </View>
        <Pressable style={styles.listToggle} onPress={() => setViewMode(isListMode ? 'sheet' : 'list')}>
          <Text style={styles.listToggleText}>{isListMode ? 'Map' : 'List'}</Text>
        </Pressable>
      </SafeAreaView>

      {!isListMode && (
        <BottomSheet
          ref={sheetRef}
          index={0}
          snapPoints={['12%', '45%']}
          onChange={(index) => { if (index === 0) clearSelection() }}
          backgroundStyle={styles.sheetBg}
          handleIndicatorStyle={styles.sheetHandle}
        >
          <BottomSheetView style={styles.sheetContent}>
            {selectedPin ? (
              <View>
                <Text style={styles.sheetPrice}>{formatCompact(selectedPin.rent)}<Text style={styles.sheetPriceUnit}>/mo</Text></Text>
                <Text style={styles.sheetType}>{(selectedPin.type ?? '').replace(/_/g, ' ')}</Text>
                <Pressable style={styles.detailsButton} onPress={() => goToDetail(selectedPinId)}>
                  <Text style={styles.detailsButtonText}>View details</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={styles.sheetHint}>{pins.length} homes in view — tap a pin to preview</Text>
            )}
          </BottomSheetView>
        </BottomSheet>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mapFull: { flex: 1 },
  mapHalf: { height: '42%' },
  listHalf: { flex: 1, backgroundColor: colors.slate50 },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingTop: spacing.sm,
  },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: radius.full,
    paddingHorizontal: spacing.md, paddingVertical: 8,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6, elevation: 2,
  },
  pulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brand500 },
  pillText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.slate800 },
  listToggle: {
    backgroundColor: colors.white, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 8,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6, elevation: 2,
  },
  listToggleText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.brand700 },
  sheetBg: { backgroundColor: colors.white, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  sheetHandle: { backgroundColor: colors.slate200 },
  sheetContent: { flex: 1, padding: spacing.lg },
  sheetHint: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate400, textAlign: 'center' },
  sheetPrice: { fontFamily: fonts.displayBold, fontSize: fontSizes.xxl, color: colors.slate800 },
  sheetPriceUnit: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate400 },
  sheetType: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate600, marginTop: spacing.xs, textTransform: 'capitalize' },
  detailsButton: { marginTop: spacing.md, backgroundColor: colors.brand600, borderRadius: radius.md, paddingVertical: spacing.sm + 4, alignItems: 'center' },
  detailsButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
})
