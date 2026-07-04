import { useQuery } from '@tanstack/react-query'
import { View, Text, StyleSheet } from 'react-native'
import { placeIntelligenceService } from '@services/placeIntelligence.service'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// Higher score = better access (metro/rail/bus/IT corridor proximity)
function accessLabel(score) {
  if (score == null) return null
  if (score <= 2) return { label: 'Bad', color: colors.danger }
  if (score <= 5) return { label: 'Moderate', color: colors.warning }
  if (score <= 8) return { label: 'Good', color: colors.success }
  return { label: 'Very good', color: colors.brand600 }
}

// Inverted: a high traffic score means heavier congestion, so it maps to the
// worse label — unlike accessLabel, where a high score is a good thing.
function trafficLabel(score) {
  if (score == null) return null
  if (score <= 2) return { label: 'Very good', color: colors.brand600 }
  if (score <= 5) return { label: 'Good', color: colors.success }
  if (score <= 8) return { label: 'Moderate', color: colors.warning }
  return { label: 'Bad', color: colors.danger }
}

function formatDistance(m) {
  return m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`
}

function ScoreRow({ label, score, nearest, labelFn = accessLabel, isLast }) {
  const cfg = labelFn(score)
  if (!cfg) return null
  return (
    <View style={[styles.row, isLast && styles.rowLast]}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {!!nearest && (
          <Text style={styles.rowNearest} numberOfLines={1}>
            {nearest.name} · {formatDistance(nearest.distanceM)}
          </Text>
        )}
      </View>
      <View style={[styles.rowBadge, { backgroundColor: cfg.color + '1A' }]}>
        <Text style={[styles.rowBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
      </View>
    </View>
  )
}

const ESSENTIAL_LABELS = {
  hospital: 'Nearest hospital',
  police: 'Nearest police station',
  pharmacy: 'Nearest pharmacy',
  school: 'Nearest school',
  supermarket: 'Nearest supermarket',
  atm: 'Nearest ATM',
}

function EssentialRow({ label, nearest, isLast }) {
  if (!nearest) return null
  return (
    <View style={[styles.row, isLast && styles.rowLast]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.essentialDistance}>{formatDistance(nearest.distanceM)}</Text>
    </View>
  )
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
  const nearbyEssentials = Object.entries(essentials ?? {}).filter(([, v]) => v.nearest)

  // Omitted entirely (not shown as "unavailable") when Distance Matrix API
  // isn't enabled on the backend key — a row that only ever says
  // "unavailable" is chrome, not information.
  const rows = [
    { label: 'Metro access', score: transit.metroScore, nearest: transit.nearestMetro },
    { label: 'Rail access', score: transit.railScore, nearest: transit.nearestRail },
    { label: 'Bus access', score: transit.busScore, nearest: transit.nearestBus },
    { label: 'IT corridor', score: itCorridor.itScore, nearest: itCorridor.nearestItPark },
    ...(traffic ? [{ label: 'Traffic', score: traffic.score, labelFn: trafficLabel }] : []),
  ]

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Neighborhood intelligence</Text>
      <Text style={styles.sectionHint}>Live, computed from this property&apos;s exact location</Text>

      <View style={styles.card}>
        {rows.map((r, i) => (
          <ScoreRow key={r.label} {...r} isLast={i === rows.length - 1} />
        ))}
      </View>

      {nearbyEssentials.length > 0 && (
        <View style={[styles.card, styles.essentialsCard]}>
          {nearbyEssentials.map(([type, v], i) => (
            <EssentialRow
              key={type}
              label={ESSENTIAL_LABELS[type] ?? type}
              nearest={v.nearest}
              isLast={i === nearbyEssentials.length - 1}
            />
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
    backgroundColor: colors.slate50, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.slate100,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm,
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.slate100,
  },
  rowLast: { borderBottomWidth: 0 },
  rowText: { flex: 1, minWidth: 0 },
  rowLabel: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.xs, color: colors.slate600 },
  rowNearest: { fontFamily: fonts.body, fontSize: 10, color: colors.slate400, marginTop: 2 },
  rowBadge: { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  rowBadgeText: { fontFamily: fonts.bodySemiBold, fontSize: 11 },
  essentialsCard: { marginTop: spacing.sm },
  essentialDistance: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.slate500 },
})
