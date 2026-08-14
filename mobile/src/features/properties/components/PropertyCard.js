import { useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@features/auth/hooks/useAuth'
import { savedService } from '@services/saved.service'
import { formatCompact, priceUnit, formatAge, isAvailableToday } from '@utils/format'
import { propertySpec } from '@utils/propertySpec'
import Icon from '@components/common/Icon'
import ListingCard from '@components/common/ListingCard'
import { typeLabel } from '@config/propertyTypes'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

const FURNISHED_LABEL = { FULLY: 'Furnished', SEMI: 'Semi furnished', UNFURNISHED: 'Unfurnished' }

// A search result, on @components/common/ListingCard — the same card as Saved
// homes and My listings as of 2026-07-31. It used to be a third design: a
// slate200 hairline instead of slate100, and a 4/3 photo bleeding to the card
// edge instead of a 16/10 one inset inside the padding.
//
// The three facts this card had that the shared shape has no line for did not
// get dropped, they moved into its two slots:
//   heart + "Available now"  -> overlay, on the photo, where they already were
//   deposit                  -> the footer, beside the age
// Deposit especially has to survive the move: on an Indian rental it is
// routinely several months' rent, so a browse card that shows only the monthly
// figure is understating the money by an order of magnitude.
//
// The BHK/furnished/type CHIPS became the meta line. The type word stays in it
// — that was added deliberately (e2d7315) because a plot, a PG and a shop
// carry no BHK, so without the word the card said nothing about what it was.
//
// Optimistic save/unsave ported from the WORKING pattern in
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

  // images[0] is an object on the list payload but a bare string on some
  // callers' shapes — resolve both before handing one url to the card.
  const first = property.images?.[0]
  const photoUrl = typeof first === 'string' ? first : first?.url
  const availableNow = isAvailableToday(property.availableFrom)
  const postedAge = formatAge(property.createdAt)
  const deposit = Number(property.deposit)

  // propertySpec, not a local bhk branch — bhk-only meant a plot, a PG and a
  // shop each showed only their type word, with the number that actually
  // describes them (extent, sharing, carpet area) silently dropped.
  const meta = [propertySpec(property), FURNISHED_LABEL[property.furnished], typeLabel(property.type)]
    .filter(Boolean)
    .join(' · ')

  const footer = [deposit > 0 ? `${formatCompact(deposit)} dep.` : null, postedAge]
    .filter(Boolean)
    .join(' · ')

  return (
    <ListingCard
      photoUrl={photoUrl}
      price={formatCompact(Number(property.rent))}
      priceUnit={priceUnit(property)}
      title={property.title}
      meta={meta}
      onPress={onPress}
      accessibilityLabel={`View ${property.title}`}
      overlay={(
        <>
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
        </>
      )}
    >
      <View style={styles.footerRow}>
        <Text style={styles.city} numberOfLines={1}>{property.city}</Text>
        {!!footer && <Text style={styles.footerText}>{footer}</Text>}
      </View>
    </ListingCard>
  )
}

const styles = StyleSheet.create({
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
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  city: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500, flexShrink: 1 },
  footerText: { fontFamily: fonts.body, fontSize: 11, color: colors.slate500 },
})
