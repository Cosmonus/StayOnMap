import { View, Text, Image, Pressable, StyleSheet } from 'react-native'
import { imgUrl, formatPrice } from '@utils/format'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// Compact property context card pinned at the visual top of a conversation —
// mirrors web ChatPanel's ChatPropertyCard (image / title / rent / chips,
// links to the property detail page).
export default function ChatPropertyCard({ property, onPress }) {
  if (!property) return null

  const img = property.images?.[0]?.url
  const bhkLabel = property.bhk ? `${property.bhk} BHK` : null
  const typeLabel = property.type
    ? property.type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
    : null

  return (
    <Pressable
      style={styles.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`View property: ${property.title}`}
    >
      {img ? (
        <Image source={{ uri: imgUrl(img, 'card') }} style={styles.thumb} resizeMode="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbFallback]}>
          <Icon name="home" size={22} color={colors.slate400} />
        </View>
      )}

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{property.title}</Text>
        {(property.address || property.city) && (
          <Text style={styles.location} numberOfLines={1}>
            {property.address ? `${property.address}, ` : ''}{property.city ?? ''}
          </Text>
        )}
        <View style={styles.metaRow}>
          {property.rent != null && <Text style={styles.rent}>{formatPrice(property)}</Text>}
          {bhkLabel && <View style={styles.chip}><Text style={styles.chipText}>{bhkLabel}</Text></View>}
          {typeLabel && <View style={styles.chip}><Text style={styles.chipText}>{typeLabel}</Text></View>}
        </View>
      </View>

      <Icon name="chevronRight" size={16} color={colors.slate400} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.slate100,
    borderRadius: radius.lg, padding: spacing.sm, marginBottom: spacing.md,
  },
  thumb: { width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.slate100 },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate800 },
  location: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate400, marginTop: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 4 },
  rent: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.brand600 },
  chip: { backgroundColor: colors.slate100, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  chipText: { fontFamily: fonts.bodySemiBold, fontSize: 10, color: colors.slate500 },
})
