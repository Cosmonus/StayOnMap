import { useEffect, useRef, useState } from 'react'
import { View, Text, Pressable, StyleSheet, FlatList, AccessibilityInfo } from 'react-native'
import { Image } from 'expo-image'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import Icon from '@components/common/Icon'
import TrustBadge from '@components/common/TrustBadge'
import { propertyService } from '@services/property.service'
import { formatCompact, imgUrl } from '@utils/format'
import { previewHighlights } from '@features/spatial/previewHighlights'
import { specLabel } from '@utils/propertySpec'
import { colors } from '@theme/colors'
import { shadows } from '@theme/shadows'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

const TYPE_LABEL = {
  APARTMENT: 'Apartment', HOUSE: 'House', VILLA: 'Villa', PG: 'PG',
  INDEPENDENT_HOUSE: 'Independent house', COMMERCIAL: 'Commercial',
  LAND: 'Plot', SHORT_STAY: 'Stay',
}

const FURNISHED_LABEL = { FULLY: 'Furnished', SEMI: 'Semi furnished', UNFURNISHED: 'Unfurnished' }

const AUTO_ADVANCE_MS = 3500

// The photo strip on the preview card. Auto-advances when there is more than
// one image, because a static "1 / 5" badge tells you photos exist without
// showing you any of them.
//
// Auto-advancing content is a WCAG 2.2.2 concern (Pause, Stop, Hide), so it
// stops two ways: a manual swipe stops it permanently for that card — once
// somebody is browsing, yanking the photo out from under them is worse than
// not animating at all — and Reduce Motion suppresses it before it ever
// starts. Width comes from onLayout rather than Dimensions so the paging
// offset is right regardless of card margins or orientation.
function ImageCarousel({ images }) {
  const [width, setWidth] = useState(0)
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const listRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => { if (on && !cancelled) setPaused(true) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (paused || width === 0 || images.length < 2) return
    const timer = setInterval(() => {
      setIndex((current) => {
        const next = (current + 1) % images.length
        listRef.current?.scrollToOffset({ offset: next * width, animated: true })
        return next
      })
    }, AUTO_ADVANCE_MS)
    return () => clearInterval(timer)
  }, [paused, width, images.length])

  if (!images.length) return <View style={[styles.imageWrap, styles.imageFallback]} />

  // One photo needs no list, no timer and no paging maths.
  if (images.length === 1) {
    return (
      <View style={styles.imageWrap}>
        <Image
          source={{ uri: imgUrl(images[0].url, 'card') }}
          style={styles.image}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={200}
        />
      </View>
    )
  }

  return (
    <View
      style={styles.imageWrap}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityLabel={`${images.length} photos`}
    >
      {width > 0 && (
        <FlatList
          ref={listRef}
          data={images}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(img, i) => img.id ?? String(i)}
          onScrollBeginDrag={() => setPaused(true)}
          onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          renderItem={({ item }) => (
            <Image
              source={{ uri: imgUrl(item.url, 'card') }}
              style={{ width, height: '100%' }}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={200}
            />
          )}
        />
      )}
      <View style={styles.imageCount}>
        <Text style={styles.imageCountText}>{index + 1} / {images.length}</Text>
      </View>
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
          <View style={styles.skeleton} />
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
  const priceUnit = isStay ? '/night' : property.pricingModel === 'LEASE' ? ' lease' : '/mo'

  return (
    <SafeAreaView edges={['bottom']} style={styles.wrap} pointerEvents="box-none">
      <Pressable
        style={styles.card}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`View details for ${property.title}`}
      >
        {/* Keyed by property so switching pins resets the carousel to photo 1
            and restarts its timer, rather than resuming mid-strip. */}
        <ImageCarousel key={propertyId} images={images.filter((img) => img?.url)} />

        <View style={styles.body}>
          <View style={styles.priceRow}>
            <Text style={styles.price} numberOfLines={1}>
              {price}
              <Text style={styles.priceUnit}>{priceUnit}</Text>
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
  skeleton: { height: 248, width: '100%', backgroundColor: colors.slate100 },
  // 132 -> 180: the photo is the first thing that answers "do I want this
  // place", and at 132 it was a strip. Skeleton grew by the same 48 so the
  // card doesn't jump height when the query resolves.
  imageWrap: { height: 180, backgroundColor: colors.slate100 },
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
