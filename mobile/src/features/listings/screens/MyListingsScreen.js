import { View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { propertyService } from '@services/property.service'
import { authService } from '@services/auth.service'
import { useAuth } from '@features/auth/hooks/useAuth'
import { formatPrice, imgUrl } from '@utils/format'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

const STATUS_COLORS = {
  DRAFT: { bg: colors.slate100, text: colors.slate600 },
  ACTIVE: { bg: colors.success50, text: '#15803D' },
  INACTIVE: { bg: colors.slate100, text: colors.slate500 },
  PENDING: { bg: colors.warning50, text: '#B45309' },
  OCCUPIED: { bg: '#EEF2FF', text: '#4338CA' },
  SUSPENDED: { bg: colors.danger50, text: '#DC2626' },
  REJECTED: { bg: colors.danger50, text: '#DC2626' },
}

function StatusPill({ status }) {
  const c = STATUS_COLORS[status] ?? STATUS_COLORS.DRAFT
  return (
    <View style={[styles.statusPill, { backgroundColor: c.bg }]}>
      <Text style={[styles.statusPillText, { color: c.text }]}>{status}</Text>
    </View>
  )
}

function BecomeOwnerPrompt() {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => authService.upgradeRole().then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  })

  return (
    <View style={styles.promptContainer}>
      <View style={styles.promptIcon}>
        <Icon name="home" size={24} color={colors.brand600} />
      </View>
      <Text style={styles.promptTitle}>List your property</Text>
      <Text style={styles.promptBody}>Become an owner to list rentals and manage appointments.</Text>
      <Pressable style={[styles.promptButton, mutation.isPending && styles.disabled]} onPress={() => mutation.mutate()} disabled={mutation.isPending}>
        {mutation.isPending ? <ActivityIndicator color={colors.white} size="small" /> : <Text style={styles.promptButtonText}>Start listing</Text>}
      </Pressable>
    </View>
  )
}

export default function MyListingsScreen({ navigation }) {
  const { user } = useAuth()

  const { data: profile } = useQuery({
    queryKey: ['me'],
    queryFn: () => authService.getMe().then((r) => r.data),
    enabled: !!user,
  })
  const isOwner = profile?.role === 'OWNER'

  const { data: listings = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['my-listings'],
    queryFn: () => propertyService.getMyListings().then((r) => r.data),
    enabled: isOwner,
  })

  if (!isOwner) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <BecomeOwnerPrompt />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My listings</Text>
        <Pressable style={styles.addButton} onPress={() => navigation.navigate('AddListing')}>
          <Icon name="plus" size={14} color={colors.white} />
          <Text style={styles.addButtonText}>Add Properties</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand600} /></View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Couldn&apos;t load your listings</Text>
          <Pressable style={styles.retryButton} onPress={() => refetch()} accessibilityRole="button" accessibilityLabel="Retry loading listings">
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: spacing.md }}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Pressable style={styles.emptyState} onPress={() => navigation.navigate('AddListing')}>
              <View style={styles.emptyIcon}>
                <Icon name="plus" size={20} color={colors.brand600} />
              </View>
              <Text style={styles.emptyTitle}>No listings yet</Text>
              <Text style={styles.emptyBody}>Tap to add your first property</Text>
            </Pressable>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Pressable
                onPress={() => navigation.navigate('ManageListing', { propertyId: item.id })}
                accessibilityRole="button"
                accessibilityLabel={`Manage listing ${item.title}`}
              >
                <View style={styles.cardImageWrap}>
                  {item.images?.[0] ? <Image source={{ uri: imgUrl(item.images[0].url, 'card') }} style={styles.cardImage} contentFit="cover" cachePolicy="memory-disk" transition={200} /> : <View style={styles.cardImage} />}
                  <View style={styles.statusPillWrap}><StatusPill status={item.status} /></View>
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.cardRent}>{formatPrice(item)}</Text>
                  <Text style={styles.cardCity} numberOfLines={1}>{item.city}{item.state ? `, ${item.state}` : ''}</Text>
                </View>
              </Pressable>
              <View style={styles.cardActions}>
                <Pressable
                  style={styles.cardActionButton}
                  onPress={() => navigation.navigate('Verification', { propertyId: item.id, propertyTitle: item.title })}
                >
                  <Icon name="shieldCheck" size={11} color={colors.slate600} />
                  <Text style={styles.cardActionText}>Verify</Text>
                </Pressable>
                {item.status === 'ACTIVE' && (
                  <Pressable
                    style={styles.cardActionButton}
                    onPress={() => navigation.navigate('CreateLease', { propertyId: item.id, propertyTitle: item.title })}
                  >
                    <Icon name="document" size={11} color={colors.slate600} />
                    <Text style={styles.cardActionText}>Offer Lease</Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  errorTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate600 },
  retryButton: { backgroundColor: colors.brand600, borderRadius: radius.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm, minHeight: 40, justifyContent: 'center' },
  retryText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  headerTitle: { fontFamily: fonts.displayBold, fontSize: fontSizes.xl, color: colors.slate800 },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.brand600, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  addButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
  list: { padding: spacing.lg, gap: spacing.md },
  card: { flex: 1, backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.slate100, overflow: 'hidden', marginBottom: spacing.md },
  cardImageWrap: { aspectRatio: 16 / 10, backgroundColor: colors.slate100 },
  cardImage: { width: '100%', height: '100%' },
  statusPillWrap: { position: 'absolute', top: 6, left: 6 },
  statusPill: { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  statusPillText: { fontFamily: fonts.bodySemiBold, fontSize: 9 },
  cardBody: { padding: spacing.sm },
  cardActions: { flexDirection: 'row', gap: 6, paddingHorizontal: spacing.sm, paddingBottom: spacing.sm },
  cardActionButton: { flex: 1, flexDirection: 'row', gap: 3, borderWidth: 1, borderColor: colors.slate200, borderRadius: radius.sm, paddingVertical: 5, alignItems: 'center', justifyContent: 'center' },
  cardActionText: { fontFamily: fonts.bodySemiBold, fontSize: 10, color: colors.slate600 },
  cardTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.slate800 },
  cardRent: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.brand600, marginTop: 2 },
  cardCity: { fontFamily: fonts.body, fontSize: 11, color: colors.slate400, marginTop: 2 },
  emptyState: { padding: spacing.xxl, borderWidth: 1, borderColor: colors.slate200, borderStyle: 'dashed', borderRadius: radius.lg, alignItems: 'center', width: '100%' },
  emptyIcon: { width: 44, height: 44, borderRadius: radius.full, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  emptyTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate600 },
  emptyBody: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate400, marginTop: 2 },
  promptContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  promptIcon: { width: 56, height: 56, borderRadius: radius.full, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  promptTitle: { fontFamily: fonts.displayBold, fontSize: fontSizes.lg, color: colors.slate800, marginBottom: spacing.xs },
  promptBody: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate400, textAlign: 'center', marginBottom: spacing.lg, maxWidth: 260 },
  promptButton: { backgroundColor: colors.black, borderRadius: radius.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  disabled: { opacity: 0.6 },
  promptButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
})
