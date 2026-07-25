import { useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { useNavigation } from '@react-navigation/native'
import { propertyService } from '@services/property.service'
import { useFilterStore } from '@store/filterStore'
import { useMapStore } from '@store/mapStore'
import { toQueryParams } from '@config/filters'
import MapHomeCard from './MapHomeCard'
import { colors } from '@theme/colors'
import { shadows } from '@theme/shadows'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// Short, non-scrolling "Homes in this area" rail shown over the map for
// logged-in users — mirrors web's MapPropertiesList.jsx (same query key,
// same limit of 3, same bounds+filters params). Rendered only when neither
// a pin nor an area is selected (ExploreScreen keeps these mutually
// exclusive so they don't fight for the same screen space).
export default function HomesInAreaList() {
  const navigation = useNavigation()
  const bounds = useMapStore((s) => s.bounds)
  const filters = useFilterStore((s) => s.filters)

  const params = useMemo(() => {
    if (!bounds) return null
    return {
      limit: 3,
      swLat: bounds.swLat,
      swLng: bounds.swLng,
      neLat: bounds.neLat,
      neLng: bounds.neLng,
      ...toQueryParams(filters),
    }
  }, [bounds, filters])

  const { data, isLoading } = useQuery({
    queryKey: ['properties-in-view', params],
    // The whole envelope, not just `.data` — `meta.proximity` says how many
    // homes a distance filter had to set aside for lack of map data.
    queryFn: () => propertyService.getList(params),
    enabled: !!params,
  })

  const properties = data?.data ?? []
  const unjudged = data?.meta?.proximity?.unknown ?? 0
  const proximityLabel = data?.meta?.proximity?.label

  // Hiding the panel entirely is right when there is simply nothing here, and
  // WRONG when a filter set homes aside because we could not judge them: the
  // list vanishes and the reason vanishes with it. Stay visible in that case
  // and say so — it is the one moment the user can act on the information, by
  // widening or clearing the filter.
  if (!bounds) return null
  if (!isLoading && properties.length === 0 && unjudged === 0) return null

  return (
    <SafeAreaView edges={['bottom']} style={styles.wrap} pointerEvents="box-none">
      <View style={styles.panel}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Homes in this area</Text>
          {properties.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{properties.length}</Text>
            </View>
          )}
        </View>

        {isLoading ? (
          <View style={styles.row}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.skeletonCard}>
                <View style={styles.skeletonImage} />
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.row}>
            {properties.map((property) => (
              <MapHomeCard
                key={property.id}
                property={property}
                isSaved={property.isSaved}
                onPress={() => navigation.navigate('PropertyDetail', { propertyId: property.id })}
              />
            ))}
          </View>
        )}

        {/*
          Homes this filter could not judge either way. Without this, one
          excluded for lack of map data looks identical to one we measured and
          rejected — and the owner whose listing vanished is never told why.
        */}
        {unjudged > 0 && (
          <Text style={styles.unjudged}>
            {unjudged} home{unjudged !== 1 ? 's' : ''} hidden — no map data for
            {unjudged !== 1 ? ' their areas' : ' its area'} yet, so we can’t tell
            {unjudged !== 1 ? ' if they’re' : ' if it’s'} within {proximityLabel}.
          </Text>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  panel: {
    backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.md,
    borderWidth: 1, borderColor: colors.slate100,
    ...shadows.float,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  title: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate800 },
  countBadge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.slate100, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  countText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.slate500 },
  row: { flexDirection: 'row', gap: spacing.sm },
  skeletonCard: { flex: 1 },
  skeletonImage: { aspectRatio: 4 / 3, borderRadius: radius.md, backgroundColor: colors.slate100 },
  // warning700, the same amber the spatial cards use for a caveat — this is a
  // limitation of our data, not an error and not a neutral aside.
  unjudged: { fontFamily: fonts.body, fontSize: 11, color: colors.warning700, marginTop: spacing.sm },
})
