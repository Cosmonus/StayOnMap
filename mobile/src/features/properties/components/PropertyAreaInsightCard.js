import { useQuery } from '@tanstack/react-query'
import { View, Text, StyleSheet } from 'react-native'
import { areasService } from '@services/areas.service'
import { formatCurrency } from '@utils/format'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

function floodLabel(v) {
  if (v <= 2) return { label: 'Very low', color: colors.success }
  if (v <= 4) return { label: 'Low', color: colors.success }
  if (v <= 6) return { label: 'Medium', color: colors.warning }
  if (v <= 8) return { label: 'High', color: colors.danger }
  return { label: 'Extreme', color: colors.danger }
}

function trafficLabel(v) {
  if (v <= 3) return { label: 'Light', color: colors.success }
  if (v <= 5) return { label: 'Moderate', color: colors.slate600 }
  if (v <= 7) return { label: 'Busy', color: colors.warning }
  return { label: 'Gridlock', color: colors.danger }
}

function accessLabel(v) {
  if (v <= 2) return { label: 'None', color: colors.slate400 }
  if (v <= 4) return { label: 'Poor', color: colors.danger }
  if (v <= 6) return { label: 'Moderate', color: colors.warning }
  if (v <= 8) return { label: 'Good', color: colors.success }
  return { label: 'Excellent', color: colors.brand600 }
}

function MetricRow({ label, level }) {
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={[styles.metricBadge, { backgroundColor: level.color + '1A' }]}>
        <Text style={[styles.metricBadgeText, { color: level.color }]}>{level.label}</Text>
      </View>
    </View>
  )
}

export default function PropertyAreaInsightCard({ city, landmark }) {
  const { data: area } = useQuery({
    queryKey: ['area-match', city, landmark],
    queryFn: () => areasService.match(city, landmark).then((r) => r.data),
    enabled: !!city,
    staleTime: Infinity,
  })

  if (!area) return null

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Area profile</Text>
      <Text style={styles.sectionHint}>Curated snapshot of {area.name}</Text>

      <View style={styles.card}>
        <View style={styles.header}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.name} numberOfLines={1}>{area.name}</Text>
            {!!area.fullName && area.fullName !== area.name && (
              <Text style={styles.fullName} numberOfLines={1}>{area.fullName}</Text>
            )}
          </View>
          {!!area.avgRent && (
            <Text style={styles.rent}>
              ~{formatCurrency(area.avgRent)}<Text style={styles.rentUnit}>/mo</Text>
            </Text>
          )}
        </View>

        {!!area.summary && <Text style={styles.summary}>{area.summary}</Text>}

        <View style={styles.metrics}>
          <MetricRow label="Metro access" level={accessLabel(area.metroScore)} />
          <MetricRow label="Railway" level={accessLabel(area.railScore ?? 3)} />
          <MetricRow label="Bus" level={accessLabel(area.busScore ?? 5)} />
          <MetricRow label="Flood risk" level={floodLabel(area.floodRisk)} />
          <MetricRow label="Traffic" level={trafficLabel(area.trafficScore)} />
          <MetricRow label="IT proximity" level={accessLabel(area.itScore)} />
          <MetricRow label="Water supply" level={accessLabel(area.waterScore)} />
        </View>

        {area.bestFor?.length > 0 && (
          <View style={styles.tagRow}>
            {area.bestFor.map((b) => (
              <View key={b} style={styles.tag}>
                <Text style={styles.tagText}>{b}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.lg },
  sectionTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.slate800 },
  sectionHint: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate400, marginTop: 2, marginBottom: spacing.sm },
  card: { backgroundColor: colors.slate50, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.slate100, padding: spacing.md },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  name: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate800 },
  fullName: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate400 },
  rent: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.brand700 },
  rentUnit: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate400 },
  summary: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500, lineHeight: 17, marginTop: spacing.sm },
  metrics: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.slate100, gap: 6 },
  metricRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metricLabel: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500 },
  metricBadge: { borderRadius: radius.md, paddingHorizontal: 6, paddingVertical: 2 },
  metricBadgeText: { fontFamily: fonts.bodySemiBold, fontSize: 10 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
  tag: { backgroundColor: colors.brand50, borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.brand700 },
})
