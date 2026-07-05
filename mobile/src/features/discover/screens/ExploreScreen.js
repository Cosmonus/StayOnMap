import { useEffect, useRef, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import MapView from '@features/map/components/MapView'
import MapSearchBar from '@features/map/components/MapSearchBar'
import MapFiltersSheet from '@features/map/components/MapFiltersSheet'
import MapLayerPills from '@features/map/components/MapLayerPills'
import AreaInsightCard from '@features/map/components/AreaInsightCard'
import PinPreviewCard from '../components/PinPreviewCard'
import Logo from '@components/common/Logo'
import Icon from '@components/common/Icon'
import { useMapStore } from '@store/mapStore'
import { useFilterStore } from '@store/filterStore'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// Map-first (PDF direction 1a). Tapping a pin floats a preview card over
// the map; tapping empty map area or the same pin again dismisses it.
export default function ExploreScreen({ navigation }) {
  const selectedPinId = useMapStore((s) => s.selectedPinId)
  const selectedAreaSlug = useMapStore((s) => s.selectedAreaSlug)
  const clearSelection = useMapStore((s) => s.clearSelection)
  const filters = useFilterStore((s) => s.filters)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const searchBarRef = useRef(null)

  const activeFilterCount =
    (filters.city ? 1 : 0) + (filters.bhk.length ? 1 : 0) + (filters.furnished ? 1 : 0)

  // Search starts collapsed to just the header icon — MapSearchBar (with its
  // full input + Go button) only mounts once opened, so focus it right after
  // that mount instead of the header icon's own onPress (ref isn't attached yet then).
  useEffect(() => {
    if (searchOpen) searchBarRef.current?.focus()
  }, [searchOpen])

  function goToDetail(propertyId) {
    navigation.navigate('PropertyDetail', { propertyId })
  }

  return (
    <View style={styles.container}>
      <View style={styles.mapFull}>
        <MapView />
      </View>

      <View style={styles.topBar} pointerEvents="box-none">
        <SafeAreaView edges={['top']} style={styles.header}>
          <Logo />
          <View style={styles.headerActions}>
            <Pressable style={styles.iconButton} onPress={() => setSearchOpen((v) => !v)}>
              <Icon name="search" size={16} color={colors.slate700} />
            </Pressable>
            <Pressable style={styles.filterButton} onPress={() => setFiltersOpen(true)}>
              <Icon name="filter" size={16} color={colors.slate700} />
              <Text style={styles.filterButtonText}>Filters</Text>
              {activeFilterCount > 0 && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                </View>
              )}
            </Pressable>
          </View>
        </SafeAreaView>
        {searchOpen && (
          <View style={styles.searchWrap} pointerEvents="box-none">
            <MapSearchBar ref={searchBarRef} />
          </View>
        )}
        <MapLayerPills />
      </View>

      {selectedPinId && (
        <PinPreviewCard propertyId={selectedPinId} onPress={() => goToDetail(selectedPinId)} />
      )}

      {selectedAreaSlug && (
        <AreaInsightCard slug={selectedAreaSlug} onClose={clearSelection} />
      )}

      <MapFiltersSheet visible={filtersOpen} onClose={() => setFiltersOpen(false)} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  mapFull: { flex: 1 },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconButton: {
    width: 32, height: 32, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.slate200,
    alignItems: 'center', justifyContent: 'center',
  },
  filterButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.full,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2,
  },
  filterButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.slate700 },
  filterBadge: {
    minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.danger,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  filterBadgeText: { fontFamily: fonts.bodySemiBold, fontSize: 10, color: colors.white },
  searchWrap: {
    marginHorizontal: spacing.md, marginTop: spacing.sm,
  },
})
