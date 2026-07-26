import { View, Text, Pressable, StyleSheet } from 'react-native'
import Icon from './Icon'
import { colors } from '@theme/colors'
import { fonts, fontSizes } from '@theme/typography'
import { spacing } from '@theme/spacing'

// The one screen header. Every top-of-screen title in the app renders this.
//
// Before it, all 18 screens hand-rolled their own: back chevrons at 20 and 22,
// titles at `lg` and `xl`, top padding at md, lg and xl, six screens with a
// decorative icon beside the title and the rest without, four screens using
// React Navigation's NATIVE header instead (a different font, a different bar
// height, and — on the host tab labelled "Inbox" — the wrong word, "Chat").
// Switching modes made the app look like two apps.
//
// Rules this encodes:
//  - No icon beside a title. A screen title is a label, not a badge; the
//    icon was decoration on some screens and absent on others, which is worse
//    than either choice made consistently.
//  - Back is 44dp with hitSlop to 48, per mobile/AGENTS.md §6, and pulled left
//    by one step so the chevron optically aligns with the content below it.
//  - The header sits INSIDE the screen's SafeAreaView, never above it — the
//    top inset belongs to the screen, so a pushed screen can't double it.
export default function ScreenHeader({ title, subtitle, onBack, right, backLabel = 'Go back' }) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          hitSlop={8}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel={backLabel}
        >
          <Icon name="chevronLeft" size={22} color={colors.slate800} />
        </Pressable>
      ) : null}

      <View style={styles.titles}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {!!subtitle && <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text>}
      </View>

      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  back: {
    width: 44,
    height: 44,
    marginLeft: -spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titles: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.displayBold, fontSize: fontSizes.xl, color: colors.slate800 },
  subtitle: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate500, marginTop: 2 },
  right: { flexShrink: 0 },
})
