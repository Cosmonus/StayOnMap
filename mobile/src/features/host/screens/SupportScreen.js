import { View, Text, Pressable, ScrollView, Linking, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useUiStore } from '@store/uiStore'
import Icon from '@components/common/Icon'
import ScreenHeader from '@components/common/ScreenHeader'
import { colors } from '@theme/colors'
import { useLayout, centered } from '@theme/breakpoints'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// Mirrors web's SupportSection (DashboardPage.jsx): routes to the place that
// actually solves the thing, plus a real address.
//
// It was an icon, a heading, one sentence and no way to reach anybody — on a
// platform that asks people to hand a deposit to a stranger. Everything here
// already existed elsewhere in the app; the only thing missing was a route to
// it from the item called Support.
const SUPPORT_EMAIL = 'hello@cosmonus.com'

// `to` resolves against the stack this screen is registered in. Rules and
// Settings exist in both account stacks; Appointments is renter-only, hence the
// mode gate rather than a row that would crash in host mode.
const ROUTES = [
  {
    key: 'listing',
    title: 'Something wrong with a listing',
    body: 'Wrong price, fake photos, a broker posing as an owner — report it from the listing page and our trust team reviews it. Reports are acted on, not queued.',
    action: 'Read the rules',
    to: 'Rules',
  },
  {
    key: 'visit',
    title: 'A visit or a message',
    body: 'Visit requests and every conversation with an owner live in your account. You can cancel a visit you no longer want from the same place you requested it.',
    action: 'Your appointments',
    to: 'Appointments',
    renterOnly: true,
  },
  {
    key: 'account',
    title: 'Your account, privacy or devices',
    body: 'Change what other people can see, review the devices you are signed in on, reset your password, or delete the account outright.',
    action: 'Account settings',
    to: 'Settings',
  },
]

export default function SupportScreen({ navigation }) {
  const { contentMaxWidth } = useLayout()
  const hostMode = useUiStore((s) => s.hostMode)
  const routes = ROUTES.filter((r) => !r.renterOnly || !hostMode)

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <ScreenHeader title="Support" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={[styles.scroll, centered(contentMaxWidth)]}>
        <Text style={styles.intro}>
          A real person reads {SUPPORT_EMAIL} — usually the same day. Start with whichever of
          these fits.
        </Text>

        {routes.map((r) => (
          <View key={r.key} style={styles.card}>
            <Text style={styles.cardTitle}>{r.title}</Text>
            <Text style={styles.cardBody}>{r.body}</Text>
            <Pressable
              style={styles.cardAction}
              onPress={() => navigation.navigate(r.to)}
              accessibilityRole="button"
              accessibilityLabel={r.action}
            >
              <Text style={styles.cardActionText}>{r.action}</Text>
              <Icon name="chevronRight" size={16} color={colors.brand700} />
            </Pressable>
          </View>
        ))}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Still stuck?</Text>
          <Text style={styles.cardBody}>
            Email us with the listing link or the name of the person you were dealing with — that
            is almost always what we need to sort it out in one reply.
          </Text>
          <Pressable
            style={styles.emailButton}
            onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
            accessibilityRole="button"
            accessibilityLabel={`Email ${SUPPORT_EMAIL}`}
          >
            <Icon name="mail" size={16} color={colors.white} />
            <Text style={styles.emailButtonText}>{SUPPORT_EMAIL}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  scroll: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.sm },
  intro: { fontFamily: fonts.body, fontSize: fontSizes.sm, lineHeight: 22, color: colors.slate600, marginBottom: spacing.xs },
  card: {
    backgroundColor: colors.white, borderWidth: 1, borderColor: colors.slate200,
    borderRadius: radius.lg, padding: spacing.md, gap: spacing.xs,
  },
  cardTitle: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.base, color: colors.slate900 },
  cardBody: { fontFamily: fonts.body, fontSize: fontSizes.sm, lineHeight: 21, color: colors.slate600 },
  cardAction: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 },
  cardActionText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.brand700 },
  emailButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
    minHeight: 48, borderRadius: radius.md, backgroundColor: colors.slate800, marginTop: spacing.xs,
  },
  emailButtonText: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
})
