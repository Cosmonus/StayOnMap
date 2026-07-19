import { View, Text, StyleSheet } from 'react-native'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// The "what we don't know" block — always visible, never behind an expander.
// "We don't know X" is information, and hiding it is how a system starts
// implying certainty it lacks. The single UI rule most worth defending.
export default function MissingDataNote({ missing }) {
  if (!missing?.length) return null
  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>What we don&apos;t know</Text>
      {missing.map((note, i) => (
        <View key={i} style={styles.row}>
          <Text style={styles.bullet}>·</Text>
          <Text style={styles.note}>{note}</Text>
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: spacing.md, backgroundColor: colors.slate50,
    borderRadius: radius.lg, padding: spacing.md,
  },
  heading: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.xs, color: colors.slate600, marginBottom: 6 },
  row: { flexDirection: 'row', gap: 6, marginTop: 2 },
  bullet: { color: colors.slate300, fontSize: fontSizes.xs, lineHeight: 16 },
  note: { flex: 1, fontFamily: fonts.body, fontSize: 11, lineHeight: 16, color: colors.slate500 },
})
