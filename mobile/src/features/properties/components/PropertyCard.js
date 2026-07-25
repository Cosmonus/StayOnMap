import { useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@features/auth/hooks/useAuth'
import { savedService } from '@services/saved.service'
import { imgUrl, formatCompact, formatAge, isAvailableToday } from '@utils/format'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

const FURNISHED_LABEL = { FULLY: 'Furnished', SEMI: 'Semi', UNFURNISHED: 'Unfurnished' }
const FURNISHED_ICON = { FULLY: 'sofa', SEMI: 'sofa', UNFURNISHED: 'box' }
const TYPE_ICON = { APARTMENT: 'building', HOUSE: 'home', VILLA: 'home', PG: 'building', INDEPENDENT_HOUSE: 'home', COMMERCIAL: 'building' }

// Optimistic save/unsave toggle ported from the WORKING pattern in
// frontend/src/features/properties/components/PropertyCard.jsx — not the
// dead useSaved.js/SavedList.jsx stubs elsewhere in the web app.
export default function PropertyCard({ property, isSaved: initialSaved = false, onPress }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [saved, setSaved] = useState(initialSaved)

  const mutation = useMutation({
    mutationFn: (isSaving) =>
      isSaving ? savedService.save(property.id).then((r) => r.data) : savedService.unsave(property.id).then((r) => r.data),
    onMutate: (isSaving) => setSaved(isSaving),
    onError: (_err, isSaving) => setSaved(!isSaving),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved'] }),
  })

  function handleHeartPress() {
    if (!user) return
    mutation.mutate(!saved)
  }

  const cover = property.images?.[0] ? imgUrl(property.images[0]?.url ?? property.images[0], 'card') : null
  const availableNow = isAvailableToday(property.availableFrom)
  const postedAge = formatAge(property.createdAt)
  const bhkLabel = property.bhk === 0 ? 'Studio' : property.bhk ? `${property.bhk} BHK` : null

  return (
    <Pressable style={styles.card} onPress={onPress} accessibilityRole="button" accessibilityLabel={`View ${property.title}`}>
      <View style={styles.imageWrap}>
        {cover ? (
          <Image source={{ uri: cover }} style={styles.image} contentFit="cover" cachePolicy="memory-disk" transition={200} />
        ) : (
          <View style={[styles.image, styles.imageFallback]} />
        )}

        {availableNow && (
          <View style={styles.availableBadge}>
            <Text style={styles.availableBadgeText}>Available Now</Text>
          </View>
        )}

        <Pressable
          style={styles.heartButton}
          onPress={handleHeartPress}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Remove from saved' : 'Save property'}
          accessibilityState={{ selected: saved }}
        >
          <Icon name={saved ? 'heartFilled' : 'heart'} size={16} color={saved ? colors.danger : colors.white} />
        </Pressable>
      </View>

      <View style={styles.body}>
        <View style={styles.priceRow}>
          <Text style={styles.price}>
            {formatCompact(Number(property.rent))}
            <Text style={styles.priceUnit}>{property.pricingModel === 'LEASE' ? ' lease' : '/mo'}</Text>
          </Text>
          {property.deposit > 0 && <Text style={styles.deposit}>{formatCompact(Number(property.deposit))} dep.</Text>}
        </View>

        <View style={styles.chipRow}>
          {bhkLabel && (
            <View style={[styles.chip, styles.chipBrand]}>
              <Icon name="bed" size={11} color={colors.brand700} />
              <Text style={styles.chipTextBrand}>{bhkLabel}</Text>
            </View>
          )}
          {FURNISHED_LABEL[property.furnished] && (
            <View style={styles.chip}>
              <Icon name={FURNISHED_ICON[property.furnished]} size={11} color={colors.slate600} />
              <Text style={styles.chipText}>{FURNISHED_LABEL[property.furnished]}</Text>
            </View>
          )}
          {property.type && (
            <View style={styles.chip}>
              <Icon name={TYPE_ICON[property.type] ?? 'home'} size={11} color={colors.slate600} />
            </View>
          )}
        </View>

        <Text style={styles.title} numberOfLines={1}>{property.title}</Text>

        <View style={styles.footerRow}>
          <Text style={styles.city} numberOfLines={1}>{property.city}</Text>
          {postedAge && <Text style={styles.age}>{postedAge}</Text>}
        </View>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.slate200, overflow: 'hidden' },
  imageWrap: { aspectRatio: 4 / 3, backgroundColor: colors.slate100 },
  image: { width: '100%', height: '100%' },
  imageFallback: { backgroundColor: colors.slate100 },
  availableBadge: {
    position: 'absolute', top: spacing.sm, left: spacing.sm,
    backgroundColor: colors.success, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3,
  },
  availableBadgeText: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.white },
  heartButton: {
    position: 'absolute', top: spacing.sm, right: spacing.sm,
    width: 32, height: 32, borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center',
  },
  body: { padding: spacing.md },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: spacing.xs + 2 },
  price: { fontFamily: fonts.displayBold, fontSize: fontSizes.lg, color: colors.slate800 },
  priceUnit: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500 },
  deposit: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.xs + 2 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.slate100, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  chipBrand: { backgroundColor: colors.brand50 },
  chipText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.slate600 },
  chipTextBrand: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.brand700 },
  title: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate800, marginBottom: spacing.xs },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  city: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500, flexShrink: 1 },
  age: { fontFamily: fonts.body, fontSize: 11, color: colors.slate500 },
})
