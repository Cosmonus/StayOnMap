import { View, Text, StyleSheet } from 'react-native'
import { colors } from '@theme/colors'
import { fonts } from '@theme/typography'
import { radius } from '@theme/spacing'

// Measured / Calculated / Estimated — visually distinct so a user scanning a
// card can tell an observation from an inference without reading the method.
// That distinction IS the product; see docs/spatial-intelligence.md §6.
const CONFIG = {
  MEASURED:  { text: 'Measured',   bg: colors.brand50,   fg: colors.brand700 },
  DERIVED:   { text: 'Calculated', bg: colors.slate100,  fg: colors.slate600 },
  ESTIMATED: { text: 'Estimated',  bg: colors.warning50, fg: colors.warning },
}

export default function ProvenanceChip({ provenance }) {
  const cfg = CONFIG[provenance]
  if (!cfg) return null
  return (
    <View style={[styles.chip, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.text, { color: cfg.fg }]}>{cfg.text}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  chip: { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  text: { fontFamily: fonts.bodySemiBold, fontSize: 10 },
})
