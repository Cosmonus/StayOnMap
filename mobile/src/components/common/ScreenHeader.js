import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import Icon from './Icon'
import { colors } from '@theme/colors'
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
// `back` defaults to showing whenever the screen can actually go back, so a
// pushed screen gets an affordance without opting in and a tab root doesn't
// get a dead arrow.
export default function ScreenHeader({ title, subtitle, right = null, back }) {
  const navigation = useNavigation()
  const showBack = back ?? navigation.canGoBack()

  return (
    <View style={styles.header}>
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
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {!!subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
        </View>
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
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1, minWidth: 0 },
  titleWrap: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.displayBold, fontSize: fontSizes.xl, color: colors.slate800 },
  subtitle: { fontFamily: fonts.body, fontSize: fontSizes.sm, color: colors.slate500, marginTop: 2 },
})
