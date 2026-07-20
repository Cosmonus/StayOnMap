import { View, Text, StyleSheet } from 'react-native'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'
import { BAND_LABEL } from '../meta'

// Band first, number second — "Moderate confidence, 4 of 6 inputs available"
// is the claim; the raw percentage is detail. A bare "61%" implies a
// precision the method does not have.
export default function ConfidenceMeter({ confidence }) {
  if (!confidence) return null
  const band = BAND_LABEL[confidence.band]
  const pct = Math.round((confidence.value ?? 0) * 100)

  // Array-guarded: `confidence` comes out of a raw JSON column, so a row
  // written before factors existed has no such key — and .filter on undefined
  // throws mid-render, blanking the card it was meant to annotate.
  const reductions = Array.isArray(confidence.factors)
    ? confidence.factors.filter((f) => f?.applied && f.reason)
    : []

  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityLabel={
        `Confidence: ${band?.text ?? confidence.band}, ${pct} percent — ${confidence.basis}` +
        // Folded into the one label rather than left as separate nodes: TalkBack
        // reading the meter and then three orphaned sentences loses which
        // score they belong to.
        (reductions.length ? `. Reduced because: ${reductions.map((f) => f.reason).join(' ')}` : '')
      }
    >
      <View style={styles.labelRow}>
        <Text style={[styles.band, { color: band?.color ?? colors.slate500 }]}>
          {band?.text ?? confidence.band}
        </Text>
        <Text style={styles.pct}>{pct}%</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.basis}>{confidence.basis}</Text>

      {/*
        Why the score is lower than the inputs alone would give. Only the
        factors that actually bit — the backend reports the inert ones too,
        which is useful in an API response and noise on a card.

        `importantForAccessibility="no"` because the parent already reads these
        in its own label; without it TalkBack says each reason twice.
      */}
      {reductions.map((f) => (
        <View key={f.key} style={styles.factorRow} importantForAccessibility="no">
          <Text style={styles.factorArrow}>↓</Text>
          <Text style={styles.factorText}>{f.reason}</Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.md },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  band: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs },
  pct: { fontFamily: fonts.body, fontSize: fontSizes.xs, color: colors.slate400 },
  track: { height: 4, borderRadius: radius.full, backgroundColor: colors.slate100, marginTop: 6, overflow: 'hidden' },
  fill: { height: 4, borderRadius: radius.full, backgroundColor: colors.brand500 },
  basis: { fontFamily: fonts.body, fontSize: 11, color: colors.slate400, marginTop: 4 },
  factorRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  // Amber, matching ESTIMATED provenance and web's treatment: this is a caveat
  // on the number above it, not a neutral aside.
  factorArrow: { fontFamily: fonts.body, fontSize: 11, color: colors.warning700 },
  factorText: { flex: 1, fontFamily: fonts.body, fontSize: 11, color: colors.warning700 },
})
