import { View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@features/auth/hooks/useAuth'
import { savedService } from '@services/saved.service'
import PropertyCard from '@features/properties/components/PropertyCard'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

export default function SavedScreen({ navigation }) {
  const { user } = useAuth()

  const { data: saved = [], isLoading } = useQuery({
    queryKey: ['saved'],
    queryFn: () => savedService.getMySaved().then((r) => r.data),
    enabled: !!user,
  })

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand600} />
        </View>
      ) : !saved.length ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Icon name="heart" size={26} color={colors.brand600} />
          </View>
          <Text style={styles.emptyTitle}>No saved homes yet</Text>
          <Text style={styles.emptyBody}>Tap the heart on any listing to save it here for later.</Text>
          <Pressable style={styles.exploreButton} onPress={() => navigation.getParent()?.navigate('Explore')}>
            <Icon name="explore" size={16} color={colors.white} />
            <Text style={styles.exploreButtonText}>Explore homes</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={saved}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={<Text style={styles.count}>{saved.length} saved home{saved.length !== 1 ? 's' : ''}</Text>}
          renderItem={({ item }) => (
            <View style={styles.cardWrap}>
              <PropertyCard
                property={item.property}
                isSaved
                onPress={() => navigation.navigate('PropertyDetail', { propertyId: item.property.id })}
              />
            </View>
          )}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  emptyIcon: { width: 56, height: 56, borderRadius: radius.full, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  emptyTitle: { fontFamily: fonts.displayBold, fontSize: fontSizes.lg, color: colors.slate800, marginBottom: spacing.xs },
  emptyBody: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate400, textAlign: 'center', maxWidth: 260, marginBottom: spacing.lg },
  exploreButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.brand600, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 4 },
  exploreButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
  list: { padding: spacing.md },
  count: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.slate400, marginBottom: spacing.sm, marginLeft: spacing.xs },
  cardWrap: { marginBottom: spacing.md },
})
