import { View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@features/auth/hooks/useAuth'
import { savedService } from '@services/saved.service'
import Icon from '@components/common/Icon'
import ErrorState from '@components/common/ErrorState'
import { useCardGrid, GridItem } from '@components/common/CardGrid'
import ScreenHeader from '@components/common/ScreenHeader'
import ListingCard from '@components/common/ListingCard'
import { formatCurrency, priceUnit } from '@utils/format'
import { propertySpec } from '@utils/propertySpec'
import { typeLabel } from '@config/propertyTypes'
import { formatTime } from '@utils/time'
import { colors } from '@theme/colors'
import { tapSlop } from '@theme/touchTargets'
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
// (badges, amenities) and has nowhere to put the one thing they came back for.
//
// The card is @components/common/ListingCard as of 2026-07-31 — the shape
// this screen defined, now literally shared with My listings and the browse
// list rather than copied into them. What stays local is the CONTENT: the
// signal chip still gets the last word, which is the whole reason this screen
// isn't a grid of search results. A saved home is one a renter has already
// looked at, so the photo is worth the space; what it must never do is crowd
// out the signal.

const FURNISHED = { FULLY: 'Furnished', SEMI: 'Semi furnished', UNFURNISHED: 'Unfurnished' }

// Same order as web's SpecLine: the type-specific number, furnishing, then the
// category word — "2 BHK · Semi furnished · Apartment" reads as a sentence.
// The old line here was `bhk || sharing` with no type word at all: a plot fell
// through to its landmark and nothing on the card said WHAT was saved
// (user-reported 2026-08-15) — the exact bug web's propertySpec was extracted
// to end.
function metaLine(p) {
  return (
    [propertySpec(p), FURNISHED[p.furnished], typeLabel(p.type)].filter(Boolean).join(' · ') ||
    p.landmark || p.city
  )
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
  const qc = useQueryClient()

  // The heart every other property card has — user-reported missing from the
  // one screen where everything IS saved, which left no way to unsave from
  // the wishlist itself. Filled by definition here; tapping it unsaves and
  // the row leaves the list. ListingCard's `overlay` slot exists for exactly
  // this — its own comment names "save heart" as an intended occupant.
  const unsave = useMutation({
    mutationFn: () => savedService.unsave(p.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saved'] })
      qc.invalidateQueries({ queryKey: ['saved-summary'] })
    },
  })

  return (
    <ListingCard
      photoUrl={p.images?.[0]?.url}
      overlay={(
        <Pressable
          style={[styles.heartButton, unsave.isPending && styles.heartBusy]}
          onPress={() => unsave.mutate()}
          disabled={unsave.isPending}
          hitSlop={tapSlop(32)}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${p.title} from saved`}
        >
          <Icon name="heartFilled" size={16} color={colors.danger} />
        </Pressable>
      )}
      price={formatCurrency(Number(p.rent))}
      priceUnit={priceUnit(p)}
      title={p.title}
      meta={metaLine(p)}
      onPress={onPress}
      accessibilityLabel={p.title}
    >
      {/* At most one chip. Stacking "visit booked" over "price dropped" over
          "no longer available" turns a card into a noticeboard, so the most
          actionable one wins. */}
      {!item.isAvailable ? (
        <Chip tone="muted">No longer available</Chip>
      ) : item.visit ? (
        <Chip>{visitLabel(item.visit)}</Chip>
      ) : item.priceDrop > 0 ? (
        <Chip>{formatCurrency(item.priceDrop)} cheaper than when you saved</Chip>
      ) : null}
    </ListingCard>
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
  const { listKey, listProps, itemStyle } = useCardGrid(styles.list)

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
  //
  // Gated on the LIST, not just the summary: unsaving the last home refetches
  // the summary while it is still enabled (the DB is already at zero, so it
  // caches "0 saved"), then the list empties and the summary query disables —
  // which would leave "0 saved" stuck in the header over the empty state.
  const subline = saved.length > 0 && summary
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
            accessibilityLabel="Explore homes on the map"
          >
            <Icon name="explore" size={16} color={colors.white} />
            <Text style={styles.exploreButtonText}>Explore homes</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={saved}
          keyExtractor={(item) => item.id}
          ListFooterComponent={
            summary?.newMatches ? (
              <NewMatchesCard
                matches={summary.newMatches}
                onPress={() => navigation.getParent()?.navigate('Explore')}
              />
            ) : null
          }
          renderItem={({ item }) => (
            <GridItem style={itemStyle}>
              <SavedRow
                item={item}
                onPress={() => navigation.navigate('PropertyDetail', { propertyId: item.property.id })}
              />
            </GridItem>
          )}
          key={listKey}
          {...listProps}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  // Same scrim-circle as PropertyCard/MapHomeCard — one heart, three surfaces.
  heartButton: {
    position: 'absolute', top: spacing.sm, right: spacing.sm,
    width: 32, height: 32, borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center',
  },
  heartBusy: { opacity: 0.6 },
  emptyIcon: { width: 56, height: 56, borderRadius: radius.full, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  emptyTitle: { fontFamily: fonts.displayBold, fontSize: fontSizes.lg, color: colors.slate800, marginBottom: spacing.xs },
  emptyBody: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate600, textAlign: 'center', maxWidth: 260, marginBottom: spacing.lg },
  exploreButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 48, backgroundColor: colors.brand600, borderRadius: radius.md, paddingHorizontal: spacing.lg },
  exploreButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
  // The card itself is @components/common/ListingCard — shared with My
  // listings and the browse list. The gap belongs here because the card
  // carries no margin of its own.
  list: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
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
