import { Text, StyleSheet } from 'react-native'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'

// Text-only wordmark — no icon, no badge, ever (.claude/ui-ux.md's mandatory
// logo rule). "Stay" in the default heading color, "OnMap" in brand color.
// `floating` adds a soft text shadow for legibility when placed directly
// over imagery (e.g. the map) instead of a solid background.
export default function Logo({ size = fontSizes.lg, floating = false }) {
  return (
    <Text style={[styles.text, floating && styles.floating, { fontSize: size }]}>
      Stay<Text style={styles.accent}>OnMap</Text>
    </Text>
  )
}

const styles = StyleSheet.create({
  text: { fontFamily: fonts.displayBold, color: colors.slate800 },
  accent: { color: colors.brand600 },
  floating: { textShadowColor: 'rgba(255,255,255,0.9)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },
})
