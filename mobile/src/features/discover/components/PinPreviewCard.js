import { useState } from 'react'
import { View, Text, Pressable, StyleSheet, FlatList, useWindowDimensions } from 'react-native'
import { Image } from 'expo-image'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import Icon from '@components/common/Icon'
import TrustBadge from '@components/common/TrustBadge'
import { propertyService } from '@services/property.service'
import { formatCompact, priceUnit, imgUrl } from '@utils/format'
import { previewHighlights } from '@features/spatial/previewHighlights'
import { TYPE_LABEL } from '@config/propertyTypes'
import { colors } from '@theme/colors'
import { shadows } from '@theme/shadows'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

const FURNISHED_LABEL = { FULLY: 'Furnished', SEMI: 'Semi furnished', UNFURNISHED: 'Unfurnished' }

// One definition, used by both the loaded image and the loading placeholder.
// Two literals is how they drifted to 132 and 200 and made the card jump.
const IMAGE_HEIGHT = 200

// Spec is per-type: BHK means nothing on a plot, sharing is the number that
// matters for a PG, guests for a short stay, carpet area for a shop.
function specLabel(property) {
  if (property.type === 'PG') return property.sharing ? `${property.sharing}-Sharing` : null
  if (property.type === 'LAND') return property.extent ? `${property.extent} ${(property.extentUnit ?? '').toLowerCase()}`.trim() : null
  if (property.type === 'SHORT_STAY') return property.maxGuests ? `Up to ${property.maxGuests} guests` : null
  if (property.type === 'COMMERCIAL') return property.carpetArea ? `${property.carpetArea} sq.ft carpet` : null
  if (property.bhk === 0) return 'Studio'
  if (property.bhk) return `${property.bhk} BHK`
  return null
}

// The photos, swipeable in place — one page per image, so a second photo is a
// swipe rather than a tap-through-and-back. The counter is the position
// indicator, so it tracks the page instead of forever reading "1 / N".
//
// Paging needs an exact page width, and the card's width is the screen minus
// the wrap's padding and the card border. That arithmetic is a starting value
// only; `onLayout` replaces it with what the card actually measured, so a
// wrong assumption about the chrome can't leave the pages half-snapped.
function Gallery({ images }) {
  const { width: windowWidth } = useWindowDimensions()
  const [width, setWidth] = useState(windowWidth - spacing.md * 2 - 2)
  const [index, setIndex] = useState(0)

  const onLayout = (e) => {
    const measured = Math.round(e.nativeEvent.layout.width)
    if (measured > 0 && measured !== width) setWidth(measured)
  }

  if (images.length === 0) {
    return (
      <View style={styles.imageWrap} onLayout={onLayout}>
        <View style={[styles.image, styles.imageFallback]} />
      </View>
    )
  }

  return (
    <View style={styles.imageWrap} onLayout={onLayout}>
      <FlatList
        data={images}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(img, i) => img.id ?? `${img.url}-${i}`}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => (
          <Image
            source={{ uri: imgUrl(item.url, 'card') }}
            style={{ width, height: IMAGE_HEIGHT }}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={200}
          />
        )}
      />
      {images.length > 1 && (
        <View style={styles.imageCount} pointerEvents="none">
          <Text style={styles.imageCountText}>{index + 1} / {images.length}</Text>
        </View>
      )}
    </View>
  )
}

// A loading bar that occupies exactly one line of the style it stands in for.
// The height comes from the real text style rather than a hand-picked number,
// which is the whole point: the skeleton and the loaded card are laid out by
// the same rules, so they cannot drift apart and make the card jump.
function SkeletonBar({ width, textStyle }) {
  return (
    <View style={[styles.skelBar, { width }]}>
      <Text style={[textStyle, styles.skelText]}> </Text>
    </View>
  )
}

// Floating preview card over the map for the currently selected pin — same
// query key ('property', id) PropertyDetailScreen uses, so tapping through
// is served from cache instead of refetching. Renders nothing until a pin
// is selected (ExploreScreen only mounts this when selectedPinId is set).
//
// The payload is the FULL property object (trust score, spatial context,
// images) — the card's job is to surface the decision-driving slice of it,
// not to make the user tap through blind.
export default function PinPreviewCard({ propertyId, onPress }) {
  const { data: property, isLoading } = useQuery({
    queryKey: ['property', propertyId],
    queryFn: () => propertyService.getById(propertyId).then((r) => r.data),
    enabled: !!propertyId,
  })

  if (isLoading || !property) {
    return (
      <SafeAreaView edges={['bottom']} style={styles.wrap} pointerEvents="box-none">
        <View style={styles.card}>
          <View style={styles.imageWrap} />
          <View style={styles.body}>
            <View style={styles.priceRow}><SkeletonBar width="45%" textStyle={styles.price} /></View>
            <SkeletonBar width="75%" textStyle={styles.title} />
            <SkeletonBar width="55%" textStyle={styles.meta} />
            <View style={styles.highlightRow}><SkeletonBar width="65%" textStyle={styles.highlightText} /></View>
            <View style={styles.ctaSkeleton} />
          </View>
        </View>
      </SafeAreaView>
    )
  }

  const images = property.images ?? []
  const spec = specLabel(property)
  const metaParts = [TYPE_LABEL[property.type] ?? null, spec, FURNISHED_LABEL[property.furnished] ?? null].filter(Boolean)
  const highlights = previewHighlights(property.spatialContext)
  const deposit = Number(property.deposit)
  const isStay = property.type === 'SHORT_STAY'
  const price = formatCompact(Number(isStay ? (property.nightlyRate ?? property.rent) : property.rent))
  // Nightly for a short stay; on a LEASE listing `rent` is the lump sum, so
  // "/mo" would be exactly the misread pricingModel exists to prevent.
  const unit = priceUnit(property)

  return (
    <SafeAreaView edges={['bottom']} style={styles.wrap} pointerEvents="box-none">
      <Pressable
        style={styles.card}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`View details for ${property.title}`}
      >
        <Gallery images={images.filter((img) => img?.url)} />

        <View style={styles.body}>
          <View style={styles.priceRow}>
            <Text style={styles.price} numberOfLines={1}>
              {price}
              <Text style={styles.priceUnit}>{unit}</Text>
              {deposit > 0 && <Text style={styles.deposit}>  ·  {formatCompact(deposit)} deposit</Text>}
            </Text>
            <TrustBadge badge={property.trustScore?.badge} size="sm" />
          </View>

          <Text style={styles.title} numberOfLines={1}>{property.title}</Text>

          {metaParts.length > 0 && (
            <Text style={styles.meta} numberOfLines={1}>{metaParts.join(' · ')}</Text>
          )}

          {highlights.length > 0 && (
            <View style={styles.highlightRow}>
              <Icon name="mapPin" size={12} color={colors.slate500} />
              <Text style={styles.highlightText} numberOfLines={1}>
                {highlights.map((h) => `${h.label} ${h.distance}`).join('  ·  ')}
              </Text>
            </View>
          )}

          <Pressable
            style={styles.cta}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={`Open full details for ${property.title}`}
          >
            <Text style={styles.ctaText}>View details</Text>
            <Icon name="chevronRight" size={16} color={colors.white} />
          </Pressable>
        </View>
      </Pressable>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  card: {
    backgroundColor: colors.white, borderRadius: radius.xl, overflow: 'hidden',
    borderWidth: 1, borderColor: colors.slate100,
    ...shadows.float,
  },
  skelBar: { backgroundColor: colors.slate100, borderRadius: radius.sm },
  skelText: { opacity: 0 },
  ctaSkeleton: { marginTop: spacing.sm, minHeight: 48, borderRadius: radius.lg, backgroundColor: colors.slate100 },
  imageWrap: { height: IMAGE_HEIGHT, backgroundColor: colors.slate100 },
  image: { width: '100%', height: '100%' },
  imageFallback: { backgroundColor: colors.slate100 },
  imageCount: {
    position: 'absolute', bottom: spacing.xs, right: spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: radius.md,
    paddingHorizontal: spacing.sm, paddingVertical: 2,
  },
  imageCountText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.white },
  body: { padding: spacing.md, gap: 3 },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  price: { fontFamily: fonts.displayBold, fontSize: fontSizes.lg, color: colors.slate800, flexShrink: 1 },
  priceUnit: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500 },
  deposit: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500 },
  title: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.slate700 },
  meta: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500 },
  highlightRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  highlightText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.xs, color: colors.slate600, flexShrink: 1 },
  cta: {
    marginTop: spacing.sm, minHeight: 48, borderRadius: radius.lg,
    backgroundColor: colors.brand600, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
  },
  ctaText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
})
