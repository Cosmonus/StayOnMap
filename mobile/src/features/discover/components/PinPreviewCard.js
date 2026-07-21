import { View, Text, Image, Pressable, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import Icon from '@components/common/Icon'
import TrustBadge from '@components/common/TrustBadge'
import { propertyService } from '@services/property.service'
import { formatCompact, imgUrl } from '@utils/format'
import { previewHighlights } from '@features/spatial/previewHighlights'
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

  return (
    <SafeAreaView edges={['bottom']} style={styles.wrap} pointerEvents="box-none">
      <Pressable
        style={styles.card}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`View details for ${property.title}`}
      >
        <View style={styles.imageWrap}>
          {images[0]?.url ? (
            <Image source={{ uri: imgUrl(images[0].url, 'card') }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={[styles.image, styles.imageFallback]} />
          )}
          {images.length > 1 && (
            <View style={styles.imageCount}>
              <Text style={styles.imageCountText}>1 / {images.length}</Text>
            </View>
          )}
        </View>

        <View style={styles.body}>
          <View style={styles.priceRow}>
            <Text style={styles.price} numberOfLines={1}>
              {price}
              <Text style={styles.priceUnit}>{isStay ? '/night' : '/mo'}</Text>
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
              <Icon name="mapPin" size={12} color={colors.slate400} />
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
  skeleton: { height: 200, width: '100%', backgroundColor: colors.slate100 },
  imageWrap: { height: 132, backgroundColor: colors.slate100 },
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
  priceUnit: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate400 },
  deposit: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500 },
  title: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.slate700 },
  meta: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate400 },
  highlightRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  highlightText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.xs, color: colors.slate600, flexShrink: 1 },
  cta: {
    marginTop: spacing.sm, minHeight: 48, borderRadius: radius.lg,
    backgroundColor: colors.brand600, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
  },
  ctaText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
})
