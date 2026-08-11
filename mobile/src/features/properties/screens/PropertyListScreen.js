import { useMemo, useState } from 'react'
import { View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { propertyService } from '@services/property.service'
import { useFilterStore } from '@store/filterStore'
import { useMapStore } from '@store/mapStore'
import { toQueryParams, countActiveFilters } from '@config/filters'
import MapFiltersSheet from '@features/map/components/MapFiltersSheet'
import PropertyCard from '../components/PropertyCard'
import ScreenHeader from '@components/common/ScreenHeader'
import ErrorState from '@components/common/ErrorState'
import Icon from '@components/common/Icon'
import { useCardGrid, GridItem } from '@components/common/CardGrid'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// Web's /properties, as a screen. It serves TWO entry points and the difference
// between them is the whole design:
//
//   SCOPED (default) — pushed from the map's "25 homes in this view" pill.
//     Carries the viewport as well as the filters, because panning to a
//     neighbourhood is a query too and dropping it would hand back every
//     matching home in the country. Has a back button to the map.
//
//   BROWSE (`scoped: false`) — the renter tab bar's Properties tab, added
//     2026-08-07. A tab is a starting point, not a continuation: someone who
//     opens the app and taps Properties has no viewport in mind, and silently
//     constraining them to wherever the map happened to be left — possibly a
//     region they never chose, possibly nothing on a cold start — would be a
//     filter they cannot see. So browse mode IGNORES bounds and offers the
//     filter sheet instead, which is the control a list-first browser needs.
//
// One screen rather than two, so the card, the empty state and the proximity
// disclosure cannot drift apart between the two ways in.
export default function PropertyListScreen({ navigation, route }) {
  const scoped = route?.params?.scoped !== false
  const filters = useFilterStore((s) => s.filters)
  const storeBounds = useMapStore((s) => s.bounds)
  const bounds = scoped ? storeBounds : null
  const [filtersOpen, setFiltersOpen] = useState(false)
  const activeFilterCount = countActiveFilters(filters)
  // One column on a phone (unchanged), two or three on a tablet.
  const { listProps, itemStyle } = useCardGrid(styles.list)

  const params = useMemo(
    () => ({ limit: 50, ...toQueryParams(filters), ...(bounds ?? {}) }),
    [filters, bounds]
  )

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['properties', params],
    // The whole envelope, not just `.data` — `meta.proximity` says how many
    // listings a distance filter had to set aside for lack of map data, and
    // dropping it here would silently hide them.
    queryFn: () => propertyService.getList(params),
  })

  const properties = data?.data ?? []
  const unjudged = data?.meta?.proximity?.unknown ?? 0
  const proximityLabel = data?.meta?.proximity?.label

  // Buy mode reaches this screen through the pricingModel filter, so the count
  // has to stop saying "home".
  const forSale = filters.pricingModel === 'SALE'
  const countLabel = isPending
    ? 'Loading listings…'
    : properties.length === 0
      ? 'Nothing matches these filters — try clearing one.'
      : forSale
        ? `${properties.length} place${properties.length !== 1 ? 's' : ''} for sale`
        : `${properties.length} home${properties.length !== 1 ? 's' : ''} available`

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <ScreenHeader
        title={forSale ? 'For sale' : 'Homes'}
        subtitle={countLabel}
        // A tab root has nowhere to go back to. Passing a no-op handler would
        // render a chevron that does nothing.
        onBack={scoped ? () => navigation.goBack() : undefined}
        right={scoped ? undefined : (
          <Pressable
            onPress={() => setFiltersOpen(true)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={activeFilterCount ? `Filters, ${activeFilterCount} active` : 'Filters'}
            style={styles.filterButton}
          >
            <Icon name="filter" size={20} color={colors.slate800} />
            {activeFilterCount > 0 && (
              <View style={styles.filterDot}>
                <Text style={styles.filterDotText}>{activeFilterCount}</Text>
              </View>
            )}
          </Pressable>
        )}
      />

      {isError ? (
        <ErrorState title="Couldn't load listings" onRetry={refetch} />
      ) : isPending ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand600} /></View>
      ) : (
        <FlatList
          data={properties}
          keyExtractor={(p) => p.id}
          ListHeaderComponent={
            <>
              {/* A viewport constrains the list invisibly — without this someone
                  clears every filter, still sees a short list, and has no way to
                  know why. Same rule as the proximity note: an exclusion you
                  cannot see is one we have to state. */}
              {!!bounds && (
                <View style={styles.notice}>
                  <Icon name="map" size={14} color={colors.slate600} />
                  <Text style={styles.noticeText}>Limited to the area the map is showing.</Text>
                </View>
              )}
              {unjudged > 0 && (
                <View style={styles.notice}>
                  <Icon name="info" size={14} color={colors.slate600} />
                  <Text style={styles.noticeText}>
                    {unjudged} listing{unjudged !== 1 ? 's' : ''} could not be checked against
                    {proximityLabel ? ` "${proximityLabel}"` : ' that distance filter'} — we have no
                    map data for {unjudged !== 1 ? 'those spots' : 'that spot'}.
                  </Text>
                </View>
              )}
            </>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Icon name="home" size={22} color={colors.brand600} />
              </View>
              <Text style={styles.emptyTitle}>Nothing here yet</Text>
              <Text style={styles.emptyBody}>
                {scoped
                  ? 'Zoom the map out or clear a filter to widen the search.'
                  : 'Clear a filter to widen the search.'}
              </Text>
              {/* The way out has to match the way in. Browse mode has no map
                  behind it, so "Back to the map" would be a lie about where
                  the button goes. */}
              <Pressable
                style={styles.emptyButton}
                onPress={() => (scoped ? navigation.goBack() : setFiltersOpen(true))}
                accessibilityRole="button"
                accessibilityLabel={scoped ? 'Back to the map' : 'Open filters'}
              >
                <Text style={styles.emptyButtonText}>
                  {scoped ? 'Back to the map' : 'Adjust filters'}
                </Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => (
            <GridItem style={itemStyle}>
              <PropertyCard
                property={item}
                onPress={() => navigation.navigate('PropertyDetail', { propertyId: item.id })}
              />
            </GridItem>
          )}
          {...listProps}
        />
      )}

      {/* Browse mode only. The same sheet the map uses, reading and writing the
          same filter store — so a filter set here is still set when you switch
          to the map, which is the behaviour someone flipping between a list and
          a map expects. It is an RN Modal with onRequestClose, so Android
          hardware back dismisses it (AGENTS.md §2). */}
      {!scoped && (
        <MapFiltersSheet visible={filtersOpen} onClose={() => setFiltersOpen(false)} />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  notice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.slate200,
    borderRadius: radius.md, padding: spacing.sm + 2, marginBottom: spacing.sm,
  },
  noticeText: { flex: 1, fontFamily: fonts.body, fontSize: fontSizes.xs, lineHeight: 18, color: colors.slate600 },
  // 48dp effective target via width/height, not hitSlop alone — AGENTS.md §6.
  filterButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  filterDot: {
    position: 'absolute', top: 6, right: 4, minWidth: 18, height: 18, paddingHorizontal: 4,
    borderRadius: radius.full, backgroundColor: colors.brand600,
    alignItems: 'center', justifyContent: 'center',
  },
  filterDotText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.white },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.xs },
  emptyIcon: {
    width: 48, height: 48, borderRadius: radius.full, backgroundColor: colors.brand50,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm,
  },
  emptyTitle: { fontFamily: fonts.displayBold, fontSize: fontSizes.lg, color: colors.slate800 },
  emptyBody: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate500, textAlign: 'center', maxWidth: 260 },
  emptyButton: {
    minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.lg,
    borderRadius: radius.md, backgroundColor: colors.slate800, marginTop: spacing.sm,
  },
  emptyButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
})
