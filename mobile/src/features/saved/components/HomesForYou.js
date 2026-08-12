import { useEffect, useState } from 'react'
import { View, Text, Image, Pressable, StyleSheet } from 'react-native'
import { graphService } from '@services/graph.service'
import SaveHeart from '@components/common/SaveHeart'
import { formatPrice, imgUrl } from '@utils/format'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'
import { shadows } from '@theme/shadows'

// "Homes for you" — preferences, the SIMILAR_TO graph and ranking, on the
// platform most people use. Mirrors web's HomesForYou.
//
// Rendered as a FlatList FOOTER on the saved screen rather than as its own
// scroll view: two nested vertical scrollers is the classic RN layout bug, and
// this content belongs at the end of the saved list anyway — it is the next
// step after reviewing a shortlist.
//
// Each card says WHY it is there. `similar_to_saved` (a graph hop from something
// they kept) and `matches_your_search` (their areas and types, no graph
// involved) are different claims, and merging them is how a recommendation
// becomes an ad. The numeric score is never shown — it orders the list and means
// nothing on its own.
const WHY_LABEL = {
  similar_to_saved: 'Like one you saved',
  matches_your_search: 'In an area you browse',
}

export default function HomesForYou({ onOpen }) {
  const [items, setItems] = useState(null)

  useEffect(() => {
    let cancelled = false
    graphService.recommendations()
      .then((res) => { if (!cancelled) setItems(res.data?.items ?? []) })
      // Silent on failure. This is a supplementary block on a screen whose own
      // content loaded fine, and it makes no "no results" claim to be confused
      // with — see the same reasoning in SimilarHomesSection.
      .catch(() => { if (!cancelled) setItems([]) })
    return () => { cancelled = true }
  }, [])

  if (!items?.length) return null

  return (
    <View style={styles.section}>
      <Text style={styles.heading}>Homes for you</Text>
      <Text style={styles.subline}>
        Based on what you have saved and visited. Only you can see this.
      </Text>

      {items.map((property) => (
        <Pressable
          key={property.id}
          onPress={() => onOpen?.(property.id)}
          style={styles.card}
          accessibilityRole="button"
          accessibilityLabel={`${property.title}, ${formatPrice(property)}`}
        >
          <View style={styles.imageWell}>
            {property.images?.[0]?.url ? (
              <Image source={{ uri: imgUrl(property.images[0].url, 'card') }} style={styles.image} resizeMode="cover" />
            ) : null}
            <SaveHeart propertyId={property.id} style={styles.heart} />
          </View>
          <View style={styles.body}>
            <Text style={styles.price}>{formatPrice(property)}</Text>
            <Text style={styles.title} numberOfLines={1}>{property.title}</Text>
            <Text style={styles.place} numberOfLines={1}>
              {[property.landmark, property.city].filter(Boolean).join(', ')}
            </Text>
            {WHY_LABEL[property.why?.source] ? (
              <View style={styles.whyPill}>
                <Text style={styles.whyText}>{WHY_LABEL[property.why.source]}</Text>
              </View>
            ) : null}
          </View>
        </Pressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.lg },
  heading: { fontFamily: fonts.displayBold, fontSize: fontSizes.lg, color: colors.slate800 },
  subline: { fontSize: fontSizes.sm, color: colors.slate500, marginTop: 2, marginBottom: spacing.sm },
  card: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.slate200,
    overflow: 'hidden',
    marginBottom: spacing.sm,
    ...shadows.card,
  },
  imageWell: { width: 108, backgroundColor: colors.slate100 },
  image: { width: '100%', height: '100%' },
  heart: { position: 'absolute', top: spacing.xs, right: spacing.xs },
  body: { flex: 1, padding: spacing.sm },
  price: { fontSize: fontSizes.base, fontWeight: '700', color: colors.brand700 },
  title: { fontSize: fontSizes.sm, fontWeight: '500', color: colors.slate800, marginTop: 2 },
  place: { fontSize: fontSizes.xs, color: colors.slate500, marginTop: 2 },
  whyPill: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.brand50,
  },
  whyText: { fontSize: 11, fontWeight: '600', color: colors.brand700 },
})
