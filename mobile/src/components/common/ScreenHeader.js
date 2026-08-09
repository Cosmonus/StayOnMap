import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
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
//  - The header OWNS the top safe-area inset and paints it white, so the bar
//    runs continuously from behind the status bar down to its hairline. This
//    is why screens no longer pass `edges={['top']}` — two things claiming the
//    same inset is a double gap, and a screen-coloured inset above a white bar
//    is the "header is a different colour" everyone notices first.
//  - White with a hairline, always. The app is white chrome (status bar area,
//    this header, the tab bar) around a slate50 canvas — the shell every
//    other phone app uses, so nobody has to learn ours.
//
// `below` renders inside the same white block, under the title row and ABOVE
// the hairline — filter chips, a segmented control, a search field. Anything
// that filters or switches the content is chrome, not the first row of the
// list: floated on the canvas it reads as a stray row, and as a list header it
// scrolls away exactly when you want to change it.
export default function ScreenHeader({ title, subtitle, onBack, right, below, backLabel = 'Go back' }) {
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.smd }]}>
      <View style={styles.row}>
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

      {below ? <View style={styles.below}>{below}</View> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    // 12, not 16, top and bottom. With insets.top (~47 on a notched phone), a
    // 44px title row and 16 either side, the chrome was ~123px before a single
    // card — the app read as top-heavy on every screen at once, because every
    // screen uses this component. The 44px row is untouched: that is the
    // accessible target size, not padding.
    paddingBottom: spacing.smd,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.slate200,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
  },
  below: { marginTop: spacing.sm },
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
