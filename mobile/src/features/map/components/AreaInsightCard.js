import { useQuery } from '@tanstack/react-query'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { areasService } from '@services/areas.service'
import { formatCurrency } from '@utils/format'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// Mirrors frontend/src/features/map/components/AreaInsightCard.jsx's
// scoreLabel thresholds — flood/traffic have their own scales (higher is
// worse), everything else is a plain "higher is better" access scale.
function scoreLevel(value, type) {
  if (type === 'flood') {
    if (value <= 2) return { label: 'Very low', color: colors.success }
    if (value <= 4) return { label: 'Low', color: colors.success }
    if (value <= 6) return { label: 'Medium', color: colors.warning }
    if (value <= 8) return { label: 'High', color: colors.danger }
    return { label: 'Extreme', color: colors.danger }
  }
  if (type === 'traffic') {
    if (value <= 3) return { label: 'Light', color: colors.success }
    if (value <= 5) return { label: 'Moderate', color: colors.slate600 }
    if (value <= 7) return { label: 'Busy', color: colors.warning }
    return { label: 'Gridlock', color: colors.danger }
  }
  if (value >= 9) return { label: 'Excellent', color: colors.success }
  if (value >= 7) return { label: 'Good', color: colors.success }
  if (value >= 5) return { label: 'Moderate', color: colors.slate600 }
  if (value >= 3) return { label: 'Limited', color: colors.warning }
  return { label: 'Poor', color: colors.danger }
}

function MetricRow({ label, value, type }) {
  const { label: lvl, color } = scoreLevel(value, type)
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color }]}>{lvl}</Text>
    </View>
  )
}

export default function AreaInsightCard({ slug, onClose }) {
  const { data: area, isLoading } = useQuery({
    queryKey: ['area', slug],
    queryFn: () => areasService.get(slug).then((r) => r.data),
    enabled: !!slug,
    staleTime: Infinity,
  })

  return (
    <SafeAreaView edges={['bottom']} style={styles.wrap} pointerEvents="box-none">
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.name} numberOfLines={1}>{isLoading ? '…' : area?.name}</Text>
            {!!area?.fullName && area.fullName !== area.name && (
              <Text style={styles.fullName} numberOfLines={1}>{area.fullName}</Text>
            )}
          </View>
          <Pressable onPress={onClose} hitSlop={8}>
            <Icon name="close" size={18} color={colors.slate400} />
          </Pressable>
        </View>

        {!!area?.avgRent && (
          <Text style={styles.rent}>
            ~{formatCurrency(area.avgRent)}<Text style={styles.rentUnit}>/mo avg rent</Text>
          </Text>
        )}

        {!!area && (
          <View style={styles.metrics}>
            <MetricRow label="Flood risk" value={area.floodRisk} type="flood" />
            <MetricRow label="Traffic" value={area.trafficScore} type="traffic" />
            <MetricRow label="Metro access" value={area.metroScore} />
            <MetricRow label="IT proximity" value={area.itScore} />
            <MetricRow label="Water supply" value={area.waterScore} />
            <MetricRow label="Safety" value={area.safetyScore} />
          </View>
        )}

        {!!area?.summary && <Text style={styles.summary}>{area.summary}</Text>}

        {area?.bestFor?.length > 0 && (
          <View style={styles.tagRow}>
            {area.bestFor.map((b) => (
              <View key={b} style={styles.tag}>
                <Text style={styles.tagText}>{b}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  card: {
    backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.md,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  headerText: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.displayBold, fontSize: fontSizes.base, color: colors.slate800 },
  fullName: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate400 },
  rent: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.brand700, marginTop: 4 },
  rentUnit: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate400 },
  metrics: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.slate100, gap: 6 },
  metricRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metricLabel: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500 },
  metricValue: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs },
  summary: {
    fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500, lineHeight: 17,
    marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.slate100,
  },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
  tag: { backgroundColor: colors.brand50, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.brand700 },
})
