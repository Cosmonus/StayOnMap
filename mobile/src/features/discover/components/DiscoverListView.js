import { FlatList, View, Text, ActivityIndicator, StyleSheet } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { propertyService } from '@services/property.service'
import { useFilterStore } from '@store/filterStore'
import { useMapStore } from '@store/mapStore'
import PropertyCard from '@features/properties/components/PropertyCard'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing } from '@theme/spacing'

// 1b — split map + list feed. Shares the Explore screen's single map/bounds
// state rather than mounting a second native map instance.
export default function DiscoverListView({ onCardPress }) {
  const bounds = useMapStore((s) => s.bounds)
  const filters = useFilterStore((s) => s.filters)

  const { data: properties = [], isLoading } = useQuery({
    queryKey: ['discover-list', bounds, filters],
    queryFn: () =>
      propertyService
        .getList({
          limit: 20,
          ...bounds,
          bhk: filters.bhk?.length ? filters.bhk.join(',') : undefined,
          furnished: filters.furnished || undefined,
          city: filters.city || undefined,
        })
        .then((r) => r.data),
    enabled: !!bounds,
  })

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brand600} />
      </View>
    )
  }

  if (!properties.length) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No homes in this area yet</Text>
      </View>
    )
  }

  return (
    <FlatList
      data={properties}
      keyExtractor={(item) => item.id}
      numColumns={1}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <View style={styles.cardWrap}>
          <PropertyCard property={item} onPress={() => onCardPress?.(item.id)} />
        </View>
      )}
    />
  )
}

const styles = StyleSheet.create({
  list: { padding: spacing.md },
  cardWrap: { marginBottom: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  emptyText: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate400 },
})
