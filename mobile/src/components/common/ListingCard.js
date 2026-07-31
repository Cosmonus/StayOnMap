import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Image } from 'expo-image'
import Icon from './Icon'
import { imgUrl } from '@utils/format'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// The one card that stands for a property, wherever one is listed: saved
// homes, the owner's own listings, and the map's list handoff.
//
// It started as the saved-homes card and was copied twice. My listings took
// the chrome but not the type ladder (title first at 13px, price second in
// brand green); the browse card took neither (slate200 hairline, a 4/3 photo
// bleeding to the card edge). Three cards for one thing, drifting apart in
// three files — which is the exact rot SavedScreen's own comment warned about.
//
// The shape is deliberate and belongs to every surface that uses it:
//   photo   inset INSIDE the card padding with its own radius, not bled to
//           the edge — so the card reads as one object rather than a header
//           with a caption glued under it
//   price   first and largest, because it is the fact that decides whether
//           the rest of the card is worth reading
//   title   then meta, each one line, each quieter than the last
//
// Two slots keep the surfaces honest without forking the design:
//   overlay  sits on the photo (status pill, save heart, "Available now")
//   children sits under meta (a signal chip, a Manage button, a footer row)
// Anything that cannot be expressed through those belongs in the calling
// screen, not in a new variant of this file.
//
// Vertical rhythm is the LIST's job, not the card's — every caller sets
// `gap` on its contentContainerStyle. A margin baked in here silently doubled
// the spacing on the two lists that already had a gap.
export default function ListingCard({
  photoUrl,
  overlay,
  price,
  priceUnit,
  title,
  meta,
  children,
  onPress,
  accessibilityLabel,
}) {
  return (
    <Pressable
      style={styles.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
    >
      <View style={styles.imageWrap}>
        {photoUrl ? (
          <Image
            source={{ uri: imgUrl(photoUrl, 'card') }}
            style={styles.image}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={200}
          />
        ) : (
          <Icon name="image" size={26} color={colors.slate500} />
        )}
        {overlay}
      </View>

      <View style={styles.body}>
        {!!price && (
          <Text style={styles.price} numberOfLines={1}>
            {price}
            {!!priceUnit && <Text style={styles.priceUnit}>{priceUnit}</Text>}
          </Text>
        )}
        {!!title && <Text style={styles.title} numberOfLines={1}>{title}</Text>}
        {!!meta && <Text style={styles.meta} numberOfLines={1}>{meta}</Text>}
        {children}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.slate100, padding: spacing.md,
  },
  imageWrap: {
    aspectRatio: 16 / 10, borderRadius: radius.md, overflow: 'hidden',
    backgroundColor: colors.slate100, alignItems: 'center', justifyContent: 'center',
  },
  image: { width: '100%', height: '100%' },
  body: { paddingTop: spacing.sm },
  price: { fontFamily: fonts.displayBold, fontSize: fontSizes.xl, color: colors.slate900 },
  priceUnit: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate500 },
  title: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.slate800, marginTop: 2 },
  meta: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate500, marginTop: 2 },
})
