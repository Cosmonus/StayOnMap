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

  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityLabel={`Confidence: ${band?.text ?? confidence.band}, ${pct} percent — ${confidence.basis}`}
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
})
