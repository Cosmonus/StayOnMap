import { View, Text, StyleSheet } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { tenancyService } from '@services/tenancy.service'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// What people who actually LIVED under this owner say — RN mirror of web's
// PastTenantReviews. Every entry traces to a confirmed tenancy and survived
// the double-blind window. Renders nothing when there are none: an empty
// "past tenants" box under every listing would read as a warning.
export default function PastTenantReviews({ propertyId }) {
  const { data: reviews = [] } = useQuery({
    queryKey: ['owner-reviews', propertyId],
    queryFn: () => tenancyService.ownerReviews(propertyId).then((r) => r.data),
  })

  if (!reviews.length) return null

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>From past tenants</Text>
      <Text style={styles.sub}>
        Written by people with a confirmed tenancy under this owner — not necessarily in this home.
      </Text>
      {reviews.map((r, i) => (
        <View key={i} style={styles.card}>
          <View style={styles.top}>
            <Text style={styles.name}>{r.reviewerFirstName} · {r.city}</Text>
            <View style={styles.starRow} accessible accessibilityRole="image" accessibilityLabel={`Rated ${r.rating} out of 5`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Icon key={n} name={n <= r.rating ? 'star' : 'starOutline'} size={12} color={n <= r.rating ? colors.warning : colors.slate200} />
              ))}
            </View>
          </View>
          <Text style={styles.body}>{r.content}</Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm, marginTop: spacing.lg },
  heading: { fontFamily: fonts.displayBold, fontSize: fontSizes.lg, color: colors.slate800 },
  sub: { fontFamily: fonts.body, fontSize: fontSizes.xs, lineHeight: 18, color: colors.slate500 },
  card: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.slate200,
    borderRadius: radius.lg, padding: spacing.md, gap: spacing.xs,
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  name: { flex: 1, fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate800 },
  starRow: { flexDirection: 'row', gap: 1 },
  body: { fontFamily: fonts.body, fontSize: fontSizes.sm, lineHeight: 20, color: colors.slate700 },
})
