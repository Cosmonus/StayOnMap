import { View, Text, StyleSheet } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { api } from '@lib/api'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'
import { shadows } from '@theme/shadows'

const ACTION_LABELS = {
  REVIEW_APPROVED: 'Review approved',
  REPORT_RESOLVED: 'Report confirmed by a moderator',
  INSIGHT_ADDED: 'Neighbourhood insight shared',
  LEASE_SIGNED: 'Lease signed on StayOnMap',
  EMAIL_VERIFIED: 'Email verified',
  PHONE_VERIFIED: 'Phone verified',
  PROFILE_COMPLETED: 'Profile completed',
}

/**
 * Private points summary (mirrors web's PointsCard) — a ledger, not a counter.
 * No leaderboard, no streaks, by design: docs/points-and-sharing.md.
 */
export default function PointsCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['points'],
    queryFn: () => api.get('/points').then((r) => r.data),
  })

  if (isLoading || !data) return null

  const progressPct = Math.round((data.progress ?? 0) * 100)

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.iconWrap}>
          <Icon name="star" size={16} color={colors.brand600} />
        </View>
        <View style={styles.headerLabels}>
          <Text style={styles.levelName}>{data.name ?? `Level ${data.level}`}</Text>
          <Text style={styles.hint}>Points for helping the next renter — visible only to you</Text>
        </View>
        <Text style={styles.points}>{data.points}</Text>
      </View>

      {data.nextLevel != null && (
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>
          <Text style={styles.progressHint}>{data.pointsToNext} points to level {data.nextLevel}</Text>
        </View>
      )}

      {data.history?.length ? (
        <View style={styles.historyWrap}>
          {data.history.slice(0, 5).map((row) => (
            <View key={row.id} style={styles.historyRow}>
              <Text style={styles.historyLabel} numberOfLines={1}>
                {ACTION_LABELS[row.action] ?? row.action}
              </Text>
              <Text style={styles.historyPoints}>+{row.points}</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.emptyHint}>
          Earn points when a review is approved, a report you filed is confirmed, or you sign a
          lease here. Anonymous reports earn nothing — that&apos;s the trade for anonymity.
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.md,
    borderWidth: 1, borderColor: colors.slate100, marginTop: spacing.md, ...shadows.card,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconWrap: {
    width: 34, height: 34, borderRadius: radius.md, backgroundColor: colors.brand50,
    alignItems: 'center', justifyContent: 'center',
  },
  headerLabels: { flex: 1, minWidth: 0 },
  levelName: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.slate800 },
  hint: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500, marginTop: 1 },
  points: { fontFamily: fonts.displayBold, fontSize: fontSizes.xl, color: colors.brand700 },
  progressWrap: { marginTop: spacing.sm },
  progressTrack: { height: 5, backgroundColor: colors.slate100, borderRadius: radius.full, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.brand500, borderRadius: radius.full },
  progressHint: { fontFamily: fonts.body, fontSize: 11, color: colors.slate500, marginTop: 3 },
  historyWrap: { marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.slate100, paddingTop: spacing.sm, gap: 6 },
  historyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  historyLabel: { flex: 1, fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate600 },
  historyPoints: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.slate800 },
  emptyHint: {
    marginTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.slate100, paddingTop: spacing.sm,
    fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate500, lineHeight: 16,
  },
})
