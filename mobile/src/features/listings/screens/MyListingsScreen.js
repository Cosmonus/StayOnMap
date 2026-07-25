import { View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { propertyService } from '@services/property.service'
import { authService } from '@services/auth.service'
import { useAuth } from '@features/auth/hooks/useAuth'
import { formatPrice, imgUrl } from '@utils/format'
import { specLabel } from '@utils/propertySpec'
import { statusOf } from '../listingStatus'
import Icon from '@components/common/Icon'
import ScreenHeader from '@components/common/ScreenHeader'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// Mirrors MAX_LISTINGS_PER_OWNER in backend properties.service.js.
const MAX_ACTIVE = 3

function StatusPill({ status }) {
  const s = statusOf(status)
  return (
    <View style={[styles.statusPill, { backgroundColor: s.bg }]}>
      <Text style={[styles.statusPillText, { color: s.text }]}>{s.label}</Text>
    </View>
  )
}

// One row per listing, full width. This was a 2-column grid: on a phone that
// made each card ~165px wide with a 12px truncated title, and it crammed two
// action buttons in at ~22px tall — well under the 44dp minimum. Owners are
// capped at 3 active listings, so a dense browse grid was solving a problem
// nobody had, at the cost of legibility and reachable controls.
//
// The old per-card Verify / Offer Lease buttons are gone rather than resized:
// ManageListingScreen already offers both, plus Edit and Preview, at a proper
// size. The whole row is now one tap target to that screen.
function ListingRow({ item, onPress }) {
  const s = statusOf(item.status)
  const spec = specLabel(item)
  const requests = item._count?.appointments ?? 0
  const thumb = item.images?.[0]?.url

  return (
    <Pressable
      style={styles.row}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${s.label}. ${s.meaning}. Opens listing management.`}
    >
      {thumb ? (
        <Image source={{ uri: imgUrl(thumb, 'card') }} style={styles.thumb} contentFit="cover" cachePolicy="memory-disk" transition={200} />
      ) : (
        <View style={[styles.thumb, styles.thumbEmpty]}>
          <Icon name="image" size={18} color={colors.slate400} />
        </View>
      )}

      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
          <StatusPill status={item.status} />
        </View>

        <Text style={styles.rowPrice} numberOfLines={1}>
          {formatPrice(item)}{spec ? ` · ${spec}` : ''}
        </Text>
        <Text style={styles.rowCity} numberOfLines={1}>
          {item.city}{item.state ? `, ${item.state}` : ''}
        </Text>

        <View style={styles.rowMeta}>
          <Text style={styles.rowMeaning} numberOfLines={1}>{s.meaning}</Text>
          {requests > 0 && (
            <Text style={styles.rowRequests}>{requests} request{requests === 1 ? '' : 's'}</Text>
          )}
        </View>
      </View>

      <Icon name="chevronRight" size={18} color={colors.slate400} />
    </Pressable>
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

  const activeCount = listings.filter((l) => l.status === 'ACTIVE').length

  if (!isOwner) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <BecomeOwnerPrompt />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScreenHeader
        title="My listings"
        right={
          <Pressable
            style={styles.addLink}
            onPress={() => navigation.navigate('AddListing')}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Add a property"
          >
            <Text style={styles.addLinkText}>Add property</Text>
          </Pressable>
        }
      />

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
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            listings.length > 0 ? (
              // The 3-active cap is enforced server-side and used to be
              // invisible until creation failed with a 403. Saying it up front
              // costs one line.
              <Text style={styles.capNote}>
                {activeCount} of {MAX_ACTIVE} active
                {activeCount >= MAX_ACTIVE ? ' — pause one to add another' : ''}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <Pressable
              style={styles.emptyState}
              onPress={() => navigation.navigate('AddListing')}
              accessibilityRole="button"
              accessibilityLabel="Add your first property"
            >
              <View style={styles.emptyIcon}>
                <Icon name="plus" size={20} color={colors.brand600} />
              </View>
              <Text style={styles.emptyTitle}>No listings yet</Text>
              <Text style={styles.emptyBody}>Tap to add your first property</Text>
            </Pressable>
          }
          renderItem={({ item }) => (
            <ListingRow item={item} onPress={() => navigation.navigate('ManageListing', { propertyId: item.id })} />
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
  // A text link, not a filled button — the page's own cards are the primary
  // surface. Vertical padding + hitSlop keep the target past 44dp even though
  // the text is small.
  addLink: { paddingVertical: spacing.sm, paddingLeft: spacing.sm },
  // brand700, not brand600: brand600 is 4.36:1 on white, under the 4.5:1
  // minimum for text. It was fine as a button FILL behind white; as the text
  // colour itself it is not.
  addLinkText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.brand700 },
  list: { padding: spacing.lg, gap: spacing.sm },
  capNote: {
    fontFamily: fonts.bodyMedium, fontSize: fontSizes.xs, color: colors.slate600,
    marginBottom: spacing.sm,
  },
  // Full-width row. 96px thumb + flexible body + chevron; the whole thing is
  // one tap target, comfortably past 44dp tall.
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.white, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.slate100,
    padding: spacing.sm,
  },
  thumb: { width: 96, height: 96, borderRadius: radius.md, backgroundColor: colors.slate100 },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, minWidth: 0, gap: 2 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowTitle: { flex: 1, minWidth: 0, fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate800 },
  rowPrice: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.brand700 },
  rowCity: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  rowMeaning: { flex: 1, minWidth: 0, fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500 },
  rowRequests: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.brand700 },
  statusPill: { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  statusPillText: { fontFamily: fonts.bodySemiBold, fontSize: 11 },
  emptyState: { padding: spacing.xxl, borderWidth: 1, borderColor: colors.slate200, borderStyle: 'dashed', borderRadius: radius.lg, alignItems: 'center', width: '100%' },
  emptyIcon: { width: 44, height: 44, borderRadius: radius.full, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  emptyTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate600 },
  emptyBody: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500, marginTop: 2 },
  promptContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  promptIcon: { width: 56, height: 56, borderRadius: radius.full, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  promptTitle: { fontFamily: fonts.displayBold, fontSize: fontSizes.lg, color: colors.slate800, marginBottom: spacing.xs },
  promptBody: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate500, textAlign: 'center', marginBottom: spacing.lg, maxWidth: 260 },
  promptButton: { backgroundColor: colors.black, borderRadius: radius.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  disabled: { opacity: 0.6 },
  promptButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
})
