import { View, Text, StyleSheet } from 'react-native'
import TrustBadge from '@components/common/TrustBadge'
import Icon from '@components/common/Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { radius, spacing } from '@theme/spacing'

// Rounded to the nearest star — the web widget renders half-star SVG
// gradients, which isn't worth the complexity for a native star row.
function Stars({ score, size = 18 }) {
  const rounded = Math.round(Math.max(0, Math.min(5, score ?? 0)))
  return (
    <View style={styles.starRow}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Icon key={i} name={i < rounded ? 'star' : 'starOutline'} size={size} color={i < rounded ? '#F59E0B' : colors.slate200} />
      ))}
    </View>
  )
}

function ScoreRow({ label, value }) {
  return (
    <View style={styles.scoreRow}>
      <Text style={styles.scoreLabel}>{label}</Text>
      <View style={styles.scoreValueWrap}>
        <Text style={styles.scoreValue}>
          {value > 0 ? value.toFixed(1) : '—'}<Text style={styles.scoreValueMax}>/5</Text>
        </Text>
        <Stars score={value} size={12} />
      </View>
    </View>
  )
}

function InsightTile({ label, value }) {
  return (
    <View style={styles.insightTile}>
      <Text style={styles.insightValue}>
        {value > 0 ? value.toFixed(1) : '—'}<Text style={styles.insightMax}>/10</Text>
      </Text>
      <Text style={styles.insightLabel}>{label}</Text>
    </View>
  )
}

export default function TrustScoreWidget({ trustScore }) {
  if (!trustScore) {
    return (
      <View style={styles.emptyWrap}>
        <Icon name="star" size={20} color={colors.slate200} />
        <Text style={styles.emptyTitle}>No community data yet</Text>
        <Text style={styles.emptyBody}>Be the first to review this property.</Text>
      </View>
    )
  }

  const score        = Number(trustScore.overallScore ?? 0)
  const hasReviews   = (trustScore.totalReviews ?? 0) > 0
  const recommendPct = Number(trustScore.recommendPercent ?? 0)
  const hasAreaScores   = trustScore.areaScore > 0 || trustScore.waterScore > 0 || trustScore.floodSafeRating > 0
  const hasReviewScores = hasReviews && (trustScore.safetyScore > 0 || trustScore.cleanlinessScore > 0 || trustScore.neighborhoodScore > 0)

  return (
    <View style={{ gap: spacing.md }}>
      <View>
        <Text style={styles.headerScore}>
          {hasReviews && score > 0 ? score.toFixed(1) : '—'}<Text style={styles.headerScoreMax}>/5</Text>
        </Text>
        <Stars score={score} />
        <Text style={styles.headerSub}>
          {hasReviews ? `${recommendPct.toFixed(0)}% recommend · ${trustScore.totalReviews} review${trustScore.totalReviews !== 1 ? 's' : ''}` : 'No reviews yet'}
        </Text>
        {trustScore.badge && <View style={{ marginTop: spacing.xs }}><TrustBadge badge={trustScore.badge} size="sm" /></View>}
      </View>

      <View style={styles.divider} />

      {hasAreaScores && (
        <View>
          <Text style={styles.sectionLabel}>Area Insights</Text>
          <View style={styles.insightRow}>
            {trustScore.areaScore > 0 && <InsightTile label="Area" value={trustScore.areaScore} />}
            {trustScore.waterScore > 0 && <InsightTile label="Water" value={trustScore.waterScore} />}
            {trustScore.floodSafeRating > 0 && <InsightTile label="Flood safety" value={trustScore.floodSafeRating} />}
          </View>
        </View>
      )}

      {hasReviewScores ? (
        <View>
          <Text style={styles.sectionLabel}>From Reviews</Text>
          <View style={{ gap: spacing.sm }}>
            <ScoreRow label="Safety" value={Number(trustScore.safetyScore ?? 0)} />
            <ScoreRow label="Cleanliness" value={Number(trustScore.cleanlinessScore ?? 0)} />
            <ScoreRow label="Neighbourhood" value={Number(trustScore.neighborhoodScore ?? 0)} />
          </View>
        </View>
      ) : (
        <View style={styles.noReviewsBox}>
          <Text style={styles.noReviewsText}>Scores appear once tenants review this property.</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  starRow: { flexDirection: 'row', gap: 2 },
  headerScore: { fontFamily: fonts.displayBold, fontSize: fontSizes.xxl, color: colors.slate800, marginBottom: spacing.xs },
  headerScoreMax: { fontFamily: fonts.body, fontSize: fontSizes.base, color: colors.slate400 },
  headerSub: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate400, marginTop: spacing.xs },
  divider: { height: 1, backgroundColor: colors.slate100 },
  sectionLabel: { fontFamily: fonts.bodySemiBold, fontSize: 10, color: colors.slate400, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm },
  insightRow: { flexDirection: 'row', gap: spacing.sm },
  insightTile: { flex: 1, backgroundColor: colors.slate50, borderWidth: 1, borderColor: colors.slate100, borderRadius: radius.md, padding: spacing.sm, alignItems: 'center' },
  insightValue: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.slate800 },
  insightMax: { fontFamily: fonts.body, fontSize: 10, color: colors.slate400 },
  insightLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.slate400, marginTop: 2 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scoreLabel: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.xs, color: colors.slate600 },
  scoreValueWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  scoreValue: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.slate800 },
  scoreValueMax: { fontFamily: fonts.body, fontSize: 10, color: colors.slate400 },
  noReviewsBox: { backgroundColor: colors.slate50, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  noReviewsText: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate400 },
  emptyWrap: { alignItems: 'center', paddingVertical: spacing.lg, gap: 6 },
  emptyTitle: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.sm, color: colors.slate600 },
  emptyBody: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate400, marginTop: 2 },
})
