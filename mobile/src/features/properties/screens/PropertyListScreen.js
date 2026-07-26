import { useMemo } from 'react'
import { View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { propertyService } from '@services/property.service'
import { useFilterStore } from '@store/filterStore'
import { useMapStore } from '@store/mapStore'
import { toQueryParams } from '@config/filters'
import PropertyCard from '../components/PropertyCard'
import ScreenHeader from '@components/common/ScreenHeader'
import ErrorState from '@components/common/ErrorState'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// The map's list handoff — web's /properties, as a screen.
//
// The map counts what is in view ("25 homes in this view") and on web that
// count is a link into a grid of the same homes. Mobile had the count and no
// destination, so the only way to read a listing was to hit its pin: fine for
// three, useless for forty.
//
// It carries BOTH the active filters and the current viewport, for the same
// reason web does — panning to a neighbourhood is a query too, and dropping it
// would hand back every matching home in the country.
export default function PropertyListScreen({ navigation }) {
  const filters = useFilterStore((s) => s.filters)
  const bounds = useMapStore((s) => s.bounds)

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
        onBack={() => navigation.goBack()}
      />

      {isError ? (
        <ErrorState title="Couldn't load listings" onRetry={refetch} />
      ) : isPending ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand600} /></View>
      ) : (
        <FlatList
          data={properties}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.list}
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
                Zoom the map out or clear a filter to widen the search.
              </Text>
              <Pressable
                style={styles.emptyButton}
                onPress={() => navigation.goBack()}
                accessibilityRole="button"
                accessibilityLabel="Back to the map"
              >
                <Text style={styles.emptyButtonText}>Back to the map</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => (
            <PropertyCard
              property={item}
              onPress={() => navigation.navigate('PropertyDetail', { propertyId: item.id })}
            />
          )}
        />
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
