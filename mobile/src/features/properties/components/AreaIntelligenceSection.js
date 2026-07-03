import { useQuery } from '@tanstack/react-query'
import { View, Text, StyleSheet } from 'react-native'
import { placeIntelligenceService } from '@services/placeIntelligence.service'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

function scoreColor(score) {
  if (score >= 7) return colors.success
  if (score >= 4) return colors.warning
  return colors.danger
}

function ScoreRow({ icon, label, score, nearest }) {
  return (
    <View style={styles.scoreRow}>
      <View style={styles.scoreHeader}>
        <Icon name={icon} size={15} color={colors.slate500} />
        <Text style={styles.scoreLabel}>{label}</Text>
        <View style={[styles.scorePill, { backgroundColor: scoreColor(score) + '1A' }]}>
          <Text style={[styles.scorePillText, { color: scoreColor(score) }]}>{score}/10</Text>
        </View>
      </View>
      {!!nearest && (
        <Text style={styles.nearestText} numberOfLines={1}>
          Nearest: {nearest.name} · {nearest.distanceM < 1000 ? `${nearest.distanceM}m` : `${(nearest.distanceM / 1000).toFixed(1)}km`}
        </Text>
      )}
    </View>
  )
}

const ESSENTIAL_LABELS = {
  hospital: ['Hospitals', 'checkCircle'],
  school: ['Schools', 'checkCircle'],
  supermarket: ['Supermarkets', 'checkCircle'],
  pharmacy: ['Pharmacies', 'checkCircle'],
  atm: ['ATMs', 'checkCircle'],
}

// Live, per-property intelligence computed from Google Places/Distance
// Matrix for this exact lat/lng — not the hand-authored named-neighborhood
// estimates (see docs/google-maps-api-setup.md + areaIntelligence.service.js
// for why flood risk isn't included here: no live API for it in India).
export default function AreaIntelligenceSection({ lat, lng }) {
  const { data, isLoading } = useQuery({
    queryKey: ['area-intelligence', lat, lng],
    queryFn: () => placeIntelligenceService.get(lat, lng).then((r) => r.data),
    enabled: lat != null && lng != null,
    staleTime: 10 * 60 * 1000,
  })

  if (lat == null || lng == null) return null

  if (isLoading || !data) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Neighborhood intelligence</Text>
        <View style={styles.skeleton} />
      </View>
    )
  }

  const { transit, essentials, itCorridor, traffic } = data
  const essentialEntries = Object.entries(essentials ?? {}).filter(([, count]) => count > 0)

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Neighborhood intelligence</Text>
      <Text style={styles.sectionHint}>Live, computed from this property&apos;s exact location</Text>

      <View style={styles.card}>
        <ScoreRow icon="mapPin" label="Metro access" score={transit.metroScore} nearest={transit.nearestMetro} />
        <ScoreRow icon="mapPin" label="Rail access" score={transit.railScore} nearest={transit.nearestRail} />
        <ScoreRow icon="mapPin" label="Bus access" score={transit.busScore} nearest={transit.nearestBus} />
        <ScoreRow icon="building" label="IT corridor" score={itCorridor.itScore} nearest={itCorridor.nearestItPark} />
        {/* Omitted entirely (not shown as "unavailable") when Distance Matrix
            API isn't enabled on the backend key — a row that only ever says
            "unavailable" is chrome, not information. */}
        {!!traffic && <ScoreRow icon="clock" label="Traffic (local probe)" score={traffic.score} />}
      </View>

      {essentialEntries.length > 0 && (
        <View style={styles.essentialsRow}>
          {essentialEntries.map(([type, count]) => (
            <View key={type} style={styles.essentialChip}>
              <Text style={styles.essentialCount}>{count}</Text>
              <Text style={styles.essentialLabel}>{ESSENTIAL_LABELS[type]?.[0] ?? type}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.lg },
  sectionTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.slate800 },
  sectionHint: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate400, marginTop: 2, marginBottom: spacing.sm },
  skeleton: { height: 140, backgroundColor: colors.slate100, borderRadius: radius.lg },
  card: {
    backgroundColor: colors.slate50, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm,
    borderWidth: 1, borderColor: colors.slate100,
  },
  scoreRow: { gap: 2 },
  scoreHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  scoreLabel: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.slate700 },
  scorePill: { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  scorePillText: { fontFamily: fonts.bodySemiBold, fontSize: 11 },
  nearestText: { fontFamily: fonts.body, fontSize: 11, color: colors.slate400, marginLeft: 23 },
  essentialsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  essentialChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.brand50, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: 4,
  },
  essentialCount: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.brand700 },
  essentialLabel: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.brand700 },
})
