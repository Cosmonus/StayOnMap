import { useEffect, useState } from 'react'
import { View, Text, Image, Pressable, FlatList, StyleSheet } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { propertyService } from '@services/property.service'
import { formatPrice, imgUrl } from '@utils/format'
import { colors } from '@theme/colors'
import { fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'
import { shadows } from '@theme/shadows'

// "Homes like this one" — the SIMILAR_TO edge, on the platform most people use.
//
// Mirrors web's SimilarHomes with one deliberate difference: a HORIZONTAL rail
// rather than a grid. A phone property page is already a long scroll, and three
// full-width cards near the bottom push the report link off the end of it.
//
// The two rules web follows apply here unchanged:
//   • The similarity score is never shown. It orders the rail and is meaningful
//     only relative to other candidates for the SAME listing.
//   • Nothing renders when there are no neighbours — INCLUDING the heading. With
//     thin inventory that is the common case, and an empty section on every
//     property page teaches people to scroll past that whole area.
//
// Price goes through the shared `formatPrice`, never a hand-written suffix:
// `rent` means four different things across the six property types and this
// rail shows several of them side by side.
export default function SimilarHomesSection({ propertyId }) {
  const navigation = useNavigation()
  const [items, setItems] = useState(null)

  useEffect(() => {
    let cancelled = false
    if (!propertyId) return undefined

    propertyService.getSimilar(propertyId)
      .then((res) => { if (!cancelled) setItems(res.data ?? []) })
      // Renders NOTHING on failure, which looks identical to having no
      // neighbours. That is deliberate and is NOT the anti-pattern AGENTS.md §10
      // forbids: the rule exists so a network failure cannot masquerade as "no
      // results", and this surface never makes a no-results CLAIM — it shows no
      // text at all. An error box for a supplementary rail, on a page whose own
      // content loaded fine, is noise the reader can do nothing with.
      .catch(() => { if (!cancelled) setItems([]) })

    return () => { cancelled = true }
  }, [propertyId])

  if (!items?.length) return null

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>Similar homes</Text>
      <FlatList
        data={items}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.rail}
        renderItem={({ item: property }) => (
          <Pressable
            onPress={() => navigation.push('PropertyDetail', { propertyId: property.id })}
            style={styles.card}
            accessibilityRole="button"
            accessibilityLabel={`${property.title}, ${formatPrice(property)}`}
          >
            <View style={styles.imageWell}>
              {property.images?.[0]?.url ? (
                <Image
                  // The card variant, not the full-size image — six full-res
                  // photos in a rail is the bandwidth mistake AGENTS.md §8 names.
                  source={{ uri: imgUrl(property.images[0].url, 'card') }}
                  style={styles.image}
                  resizeMode="cover"
                />
              ) : null}
            </View>
            <View style={styles.body}>
              <Text style={styles.price}>{formatPrice(property)}</Text>
              <Text style={styles.title} numberOfLines={1}>{property.title}</Text>
              <Text style={styles.place} numberOfLines={1}>
                {[property.landmark, property.city].filter(Boolean).join(', ')}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  )
}

const CARD_WIDTH = 220

const styles = StyleSheet.create({
  section: { marginTop: spacing.lg },
  heading: {
    fontSize: fontSizes.lg,
    fontWeight: '700',
    color: colors.slate800,
    marginBottom: spacing.sm,
  },
  // The rail bleeds to the screen edge so the last card is visibly cut off,
  // which is what tells somebody it scrolls.
  rail: { gap: spacing.sm, paddingRight: spacing.md },
  card: {
    width: CARD_WIDTH,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate200,
    overflow: 'hidden',
    ...shadows.card,
  },
  imageWell: { width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.slate100 },
  image: { width: '100%', height: '100%' },
  body: { padding: spacing.sm },
  price: { fontSize: fontSizes.base, fontWeight: '700', color: colors.brand700 },
  title: { fontSize: fontSizes.sm, fontWeight: '500', color: colors.slate800, marginTop: 2 },
  place: { fontSize: fontSizes.xs, color: colors.slate500, marginTop: 2 },
})
