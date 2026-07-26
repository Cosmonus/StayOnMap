import { View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@features/auth/hooks/useAuth'
import { savedService } from '@services/saved.service'
import Icon from '@components/common/Icon'
import ErrorState from '@components/common/ErrorState'
import ScreenHeader from '@components/common/ScreenHeader'
import { formatCurrency, priceUnit, imgUrl } from '@utils/format'
import { formatTime } from '@utils/time'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// Saved homes. The one screen a renter comes BACK to, so every row has to say
// what CHANGED — otherwise it is a folder of links that looks identical every
// visit.
//
// Three signals, each shown only when it is true and measured:
//   Visit booked · Sat 11:00            their own accepted appointment
//   ₹2,000 cheaper than when you saved  against the price recorded at save time
//   No longer available                 the listing left the market
//
// A generic PropertyCard was used here before. It is right for a search result
// and wrong for this list: it repeats what the renter already decided on
// (photos, badges, amenities) and has nowhere to put the one thing they came
// back for.

const FURNISHED = { FULLY: 'Furnished', SEMI: 'Semi furnished', UNFURNISHED: 'Unfurnished' }

function metaLine(p) {
  const size = p.bhk ? `${p.bhk} BHK` : p.sharing ? `${p.sharing}-sharing` : null
  return [size, FURNISHED[p.furnished]].filter(Boolean).join(' · ') || p.landmark || p.city
}

function visitLabel(visit) {
  const when = visit.scheduledAt ?? visit.requestedDate
  const day = new Date(when).toLocaleDateString('en-IN', { weekday: 'short' })
  return `Visit booked · ${day} ${formatTime(visit.requestedTime)}`.trim()
}

function Chip({ children, tone = 'brand' }) {
  return (
    <View style={[styles.chip, tone === 'muted' && styles.chipMuted]}>
      <Text style={[styles.chipText, tone === 'muted' && styles.chipTextMuted]}>{children}</Text>
    </View>
  )
}

function SavedRow({ item, onPress }) {
  const p = item.property
  const url = p.images?.[0]?.url

  return (
    <Pressable style={styles.row} onPress={onPress} accessibilityRole="button" accessibilityLabel={p.title}>
      <View style={styles.thumb}>
        {url
          ? <Image source={{ uri: imgUrl(url) }} style={styles.thumbImage} contentFit="cover" cachePolicy="memory-disk" transition={200} />
          : <Icon name="image" size={22} color={colors.slate500} />}
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.price}>
          {formatCurrency(Number(p.rent))}
          <Text style={styles.priceUnit}>{priceUnit(p)}</Text>
        </Text>
        <Text style={styles.title} numberOfLines={1}>{p.title}</Text>
        <Text style={styles.meta} numberOfLines={1}>{metaLine(p)}</Text>

        {/* At most one chip. Stacking "visit booked" over "price dropped" over
            "no longer available" turns a row into a noticeboard, so the most
            actionable one wins. */}
        {!item.isAvailable ? (
          <Chip tone="muted">No longer available</Chip>
        ) : item.visit ? (
          <Chip>{visitLabel(item.visit)}</Chip>
        ) : item.priceDrop > 0 ? (
          <Chip>{formatCurrency(item.priceDrop)} cheaper than when you saved</Chip>
        ) : null}
      </View>
    </Pressable>
  )
}

// "3 new 2 BHKs in Koramangala since you last looked." Rendered only when the
// backend actually counted some — there is no empty version of this card.
function NewMatchesCard({ matches, onPress }) {
  const what = matches.bhk ? `${matches.bhk} BHKs` : 'homes'
  return (
    <View style={styles.promo}>
      <Text style={styles.promoText}>
        <Text style={styles.promoStrong}>{matches.count} new {what}</Text>
        {' '}in {matches.area} since you last looked.
      </Text>
      <Pressable style={styles.promoButton} onPress={onPress} accessibilityRole="button">
        <Text style={styles.promoButtonText}>See what is new</Text>
      </Pressable>
    </View>
  )
}

export default function SavedScreen({ navigation }) {
  const { user } = useAuth()

  const { data: saved = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['saved'],
    queryFn: () => savedService.getMySaved().then((r) => r.data),
    enabled: !!user,
  })

  // Fetching this RECORDS the visit, which is what "since you last looked"
  // measures against — so it waits until there is a list to look at.
  const { data: summary } = useQuery({
    queryKey: ['saved-summary'],
    queryFn: () => savedService.summary().then((r) => r.data),
    enabled: !!user && saved.length > 0,
  })

  // "2 still available" is only worth saying when some are NOT.
  const subline = summary
    ? [
      `${summary.savedCount} saved`,
      summary.availableCount < summary.savedCount ? `${summary.availableCount} still available` : null,
    ].filter(Boolean).join(' · ')
    : null

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      {/* The title used to live in React Navigation's native header, so this
          screen's own inset started below it. It is a ScreenHeader inside the
          safe area now, like every other screen. */}
      <ScreenHeader title="Saved homes" subtitle={subline} />
      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand600} /></View>
      ) : isError ? (
        <ErrorState title="Couldn't load saved homes" onRetry={refetch} />
      ) : !saved.length ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Icon name="heart" size={26} color={colors.brand600} />
          </View>
          <Text style={styles.emptyTitle}>No saved homes yet</Text>
          <Text style={styles.emptyBody}>Tap the heart on any listing to save it here for later.</Text>
          <Pressable
            style={styles.exploreButton}
            onPress={() => navigation.getParent()?.navigate('Explore')}
            accessibilityRole="button"
            accessibilityLabel="Explore homes"
          >
            <Icon name="explore" size={16} color={colors.white} />
            <Text style={styles.exploreButtonText}>Explore homes</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={saved}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListFooterComponent={
            summary?.newMatches
              ? (
                <NewMatchesCard
                  matches={summary.newMatches}
                  onPress={() => navigation.getParent()?.navigate('Explore')}
                />
              )
              : null
          }
          renderItem={({ item }) => (
            <SavedRow
              item={item}
              onPress={() => navigation.navigate('PropertyDetail', { propertyId: item.property.id })}
            />
          )}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  emptyIcon: { width: 56, height: 56, borderRadius: radius.full, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  emptyTitle: { fontFamily: fonts.displayBold, fontSize: fontSizes.lg, color: colors.slate800, marginBottom: spacing.xs },
  emptyBody: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate600, textAlign: 'center', maxWidth: 260, marginBottom: spacing.lg },
  exploreButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 48, backgroundColor: colors.brand600, borderRadius: radius.md, paddingHorizontal: spacing.lg },
  exploreButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
  list: { padding: spacing.md, paddingBottom: spacing.xxl },
  row: {
    flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start',
    backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.sm,
  },
  thumb: { width: 88, height: 88, borderRadius: radius.md, backgroundColor: colors.slate100, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  thumbImage: { width: '100%', height: '100%' },
  price: { fontFamily: fonts.displayBold, fontSize: fontSizes.xl, color: colors.slate900 },
  priceUnit: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate500 },
  title: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.slate800, marginTop: 2 },
  meta: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate500, marginTop: 2 },
  chip: { alignSelf: 'flex-start', backgroundColor: colors.brand50, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 6, marginTop: spacing.sm },
  chipMuted: { backgroundColor: colors.slate100 },
  chipText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.brand700 },
  chipTextMuted: { color: colors.slate600 },
  promo: { backgroundColor: colors.slate900, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.sm },
  promoText: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.white, lineHeight: 24 },
  promoStrong: { fontFamily: fonts.bodySemiBold },
  promoButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, borderRadius: radius.md, marginTop: spacing.md },
  promoButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.slate900 },
})
