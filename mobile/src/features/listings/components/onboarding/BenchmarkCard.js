import { View, Text, StyleSheet } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { propertyService } from '@services/property.service'
import { formatCurrency } from '@utils/format'
import { benchmarkLabel, DESCRIBE, deriveType, resolveMode } from '../../config/onboarding.js'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// Mirror of web's BenchmarkCard — what comparable live listings ask, beside the
// price field rather than after publishing.
//
// A band and a median, never a recommended price: we have no basis for telling
// anyone what their home is worth, and a single number reads as advice. Below
// three comparables it says so rather than inventing a market.

function compact(n) {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(1).replace(/\.0$/, '')}Cr`
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1).replace(/\.0$/, '')}L`
  if (n >= 1000) return `₹${Math.round(n / 1000)}K`
  return formatCurrency(n)
}

export default function BenchmarkCard({ categoryKey, draft }) {
  const describeValue = draft.fields[DESCRIBE[categoryKey].k]
  const city = draft.location.city
  const pricingModel = resolveMode(categoryKey, draft)
  const params = {
    city,
    type: deriveType(categoryKey, describeValue),
    pricingModel,
    ...(categoryKey === 'pg' ? { sharing: draft.fields.sharing } : {}),
    ...(draft.fields.bhk !== undefined && categoryKey !== 'pg' ? { bhk: Number(draft.fields.bhk) } : {}),
  }

  const { data } = useQuery({
    queryKey: ['price-benchmark', params],
    queryFn: () => propertyService.getBenchmark(params).then((r) => r.data),
    enabled: Boolean(city),
    staleTime: 10 * 60 * 1000,
  })

  const noun = benchmarkLabel(categoryKey, pricingModel)
  const where = (draft.location.landmark || city || '').trim()

  if (!city) {
    return (
      <View style={styles.muted}>
        <Text style={styles.mutedText}>
          Pick a city on the location step and we&apos;ll show what comparable listings ask.
        </Text>
      </View>
    )
  }

  if (!data) return <View style={styles.skeleton} />

  if (!data.available) {
    return (
      <View style={styles.muted}>
        <Text style={styles.kicker}>{where}</Text>
        <Text style={styles.mutedText}>
          Only {data.count} comparable {data.count === 1 ? 'listing is' : 'listings are'} live here — too few
          to say what the going {noun} is. Price it on what you know about the place.
        </Text>
      </View>
    )
  }

  const mine = Number(draft.pricing[categoryKey === 'stay' ? 'nightlyRate' : 'rent'] || 0)
  const span = Math.max(1, data.p75 - data.p25)
  const at = mine > 0 ? Math.min(1, Math.max(0, (mine - data.p25) / span)) : null
  const delta = mine > 0 ? Math.round(((mine - data.median) / data.median) * 100) : null

  return (
    <View style={styles.card}>
      <Text style={styles.kickerBrand}>{where}{describeValue ? ` · ${describeValue}` : ''}</Text>
      <Text style={styles.band}>{compact(data.p25)} – {compact(data.p75)}</Text>
      <Text style={styles.median}>
        Median {formatCurrency(data.median)} across {data.count} live {data.count === 1 ? 'listing' : 'listings'}
      </Text>
      <View style={styles.track}>
        {at !== null && <View style={[styles.dot, { left: `${at * 100}%` }]} />}
      </View>
      {delta !== null && (
        <Text style={styles.verdict}>
          {delta === 0
            ? `Yours is right on the median ${noun}.`
            : delta < 0
              ? `Yours is ${Math.abs(delta)}% below median — expect faster enquiries.`
              : `Yours is ${delta}% above median — expect fewer, slower enquiries.`}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.brand50, borderRadius: radius.lg, padding: spacing.md },
  muted: { backgroundColor: colors.slate50, borderRadius: radius.lg, padding: spacing.md },
  skeleton: { height: 120, backgroundColor: colors.slate100, borderRadius: radius.lg },
  kicker: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.slate500, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: spacing.xs },
  kickerBrand: { fontFamily: fonts.bodySemiBold, fontSize: 11, color: colors.brand700, textTransform: 'uppercase', letterSpacing: 0.6 },
  band: { fontFamily: fonts.displayBold, fontSize: fontSizes.xxl, color: colors.brand800, marginTop: spacing.xs },
  median: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.brand900, marginTop: 2 },
  mutedText: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate600, lineHeight: 18 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.brand100, marginTop: spacing.md },
  dot: { position: 'absolute', top: -3, marginLeft: -6, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.brand700, borderWidth: 2, borderColor: colors.white },
  verdict: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.brand700, marginTop: spacing.sm, lineHeight: 18 },
})
