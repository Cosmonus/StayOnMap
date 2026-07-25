import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation, useNavigationState } from '@react-navigation/native'
import Icon from './Icon'
import Logo from './Logo'
import { colors } from '@theme/colors'
import { shadows } from '@theme/shadows'
import { fonts, fontSizes } from '@theme/typography'
import { spacing } from '@theme/spacing'

// The app's in-screen header, extracted because roughly a dozen screens had
// hand-rolled their own `styles.header` and drifted — HostProfileScreen ended
// up with none at all, so host mode had four titled tabs and one blank one.
//
// Why not React Navigation's native header: a handful of screens still use it
// (`title:` in AppTabs) and it renders in system typography with a system back
// arrow, which is visibly not the rest of the app. Values below are lifted from
// the existing MyListings/Notifications headers so adopting this changes
// nothing visually.
//
// EVERY header is the same white, shadowed bar — the one the renter home
// already had. It was slate50-on-slate50 (invisible) with an `elevated` opt-in
// for two screens; making white the single treatment removed both that prop and
// a `surface` override, since there is now nothing to vary.
//
// `logo` swaps the title for the wordmark (the two home screens). `back` shows
// whenever the screen's own stack has something underneath.
export default function ScreenHeader({ title, subtitle, right = null, back, icon, logo = false }) {
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()

  // The index of the NEAREST navigator — this screen's own stack. Anything
  // above 0 means there is a screen underneath to go back to.
  //
  // NOT navigation.canGoBack(): that walks up to parent navigators too, so once
  // the tab navigator had any history it returned true on EVERY screen and put
  // a back arrow on all five tab roots — where there is nothing to go back to.
  const stackIndex = useNavigationState((state) => state.index)
  const showBack = back ?? stackIndex > 0

  // The header absorbs the status-bar inset itself, so its background runs
  // behind the clock and battery as one bar. Letting the screen's SafeAreaView
  // take the top edge instead painted that strip in the PAGE colour and left a
  // visible two-tone split above a white header. Screens using this component
  // must therefore NOT include 'top' in their SafeAreaView edges.
  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.left}>
        {showBack && (
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Icon name="chevronLeft" size={20} color={colors.slate800} />
          </Pressable>
        )}
        {logo ? (
          <Logo />
        ) : (
          <>
            {/* Several screens paired their title with a glyph (calendar for
                appointments, document for leases). Decorative — the title says
                the same thing — so it's hidden from screen readers. */}
            {!!icon && <Icon name={icon} size={20} color={colors.slate800} accessibilityElementsHidden />}
            <View style={styles.titleWrap}>
              <Text style={styles.title} numberOfLines={1}>{title}</Text>
              {!!subtitle && <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text>}
            </View>
          </>
        )}
      </View>
      {right}
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm,
    gap: spacing.sm,
    // White + shadows.md is ExploreScreen's app bar, now the app-wide default.
    backgroundColor: colors.white,
    ...shadows.md,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1, minWidth: 0 },
  titleWrap: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.displayBold, fontSize: fontSizes.xl, color: colors.slate800 },
  subtitle: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate500, marginTop: 2 },
})
