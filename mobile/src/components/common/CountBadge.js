import { View, Text, StyleSheet } from 'react-native'
import { colors } from '@theme/colors'
import { fonts, CHROME_MAX_FONT_SCALE } from '@theme/typography'

// The little number in a circle — the bell, an unread thread, a filter count,
// a tab badge. Six places drew their own and four of them did it with a FIXED
// height, which is the shape that breaks first when someone turns the OS font
// size up: a 20dp digit in an 18dp circle is clipped, and at 200% it is gone.
//
// Two things fix that, and they are different fixes for different reasons:
//
//   `minHeight`, never `height` — the pill grows with its text rather than
//   cropping it. This is the general rule and it applies everywhere text lives
//   inside a box, not just here.
//
//   `maxFontSizeMultiplier` — capped, because a count is REDUNDANT. The "3" on
//   a bell is also the three rows you see the instant you tap it, so holding it
//   to 1.3x costs a reader nothing they cannot get one tap later. Content text
//   is never capped this way; see the note on CHROME_MAX_FONT_SCALE.
//
// `aspectRatio` keeps it a circle while empty-ish and lets it stretch into a
// lozenge once the number is wide — which is what "99+" needs and what a fixed
// width refused to give it.

const SIZES = {
  // Beside an icon: the bell, a tab.
  sm: { minSize: 16, fontSize: 10, paddingHorizontal: 4 },
  // In a row: an unread thread, a filter section.
  md: { minSize: 20, fontSize: 11, paddingHorizontal: 5 },
}

/**
 * @param {number} count      hidden entirely at 0 — a zero badge is noise
 * @param {'sm'|'md'} size
 * @param {number} max        beyond this it reads "N+"
 * @param {string} tone       background colour token
 */
export default function CountBadge({
  count,
  size = 'md',
  max = 99,
  tone = colors.brand500,
  textColor = colors.white,
  style,
}) {
  if (!count || count < 1) return null
  const s = SIZES[size] ?? SIZES.md
  const label = count > max ? `${max}+` : String(count)

  return (
    <View
      style={[
        styles.badge,
        {
          minWidth: s.minSize,
          minHeight: s.minSize,
          borderRadius: s.minSize,
          paddingHorizontal: s.paddingHorizontal,
          backgroundColor: tone,
        },
        style,
      ]}
      // One announcement, not two: without this a screen reader reads the
      // number as a standalone "3" adrift from whatever it counts.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text
        maxFontSizeMultiplier={CHROME_MAX_FONT_SCALE}
        style={[styles.text, { fontSize: s.fontSize, color: textColor }]}
      >
        {label}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center', justifyContent: 'center' },
  text: { fontFamily: fonts.bodySemiBold, textAlign: 'center' },
})
