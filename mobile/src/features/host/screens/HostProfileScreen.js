import { View, ScrollView, Alert, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@features/auth/hooks/useAuth'
import { userService } from '@services/user.service'
import { useUiStore } from '@store/uiStore'
import { AccountGroup, AccountRow, ModeSwitch } from '@features/profile/components/AccountRow'
import AccountIdentity from '@features/profile/components/AccountIdentity'
import { useOtherHatWaiting } from '@features/profile/useOtherHatWaiting'
import ScreenHeader from '@components/common/ScreenHeader'
import { colors } from '@theme/colors'
import { useLayout, centered } from '@theme/breakpoints'
import { spacing } from '@theme/spacing'
import { useSupportWaiting } from '@features/support/useSupportWaiting'

// The host's account screen. Deliberately the SAME screen as the renter's
// (@features/profile/screens/ProfileScreen) down to the shared row primitives —
// mobile has to keep them as two files because the entire tab bar swaps with the
// mode, and two files is exactly how these two drifted into two different looks
// before.
//
// What differs is only what a host can act on from here: their visit requests
// and listings have their own tabs, so this screen carries identity, the mode,
// and the settings destinations — nothing invented, nothing that dead-ends.

export default function HostProfileScreen({ navigation }) {
  const { contentMaxWidth } = useLayout()
  const { user, signOut } = useAuth()
  const setHostMode = useUiStore((s) => s.setHostMode)
  const waiting = useOtherHatWaiting()
  const supportWaiting = useSupportWaiting()

  const { data: account, isLoading, isError, refetch } = useQuery({
    queryKey: ['account-summary'],
    queryFn: () => userService.accountSummary().then((r) => r.data),
    enabled: !!user,
  })

  const meta = account?.city ? `Hosting in ${account.city}` : null

  function confirmSignOut() {
    Alert.alert('Log out?', 'You can sign back in any time.', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: signOut },
    ])
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      {/* Titled like every other screen. The identity card below is content —
          the first row of the list, sharing its card shape — not a second
          header competing with this one. */}
      <ScreenHeader
        title="Account"
        below={<ModeSwitch hostMode onChange={setHostMode} waiting={waiting} />}
      />
      <ScrollView contentContainerStyle={[styles.scroll, centered(contentMaxWidth)]}>
        <View style={styles.body}>
          <AccountIdentity
            account={account && { ...account, meta }}
            isLoading={isLoading}
            isError={isError}
            onRetry={() => refetch()}
            onPress={() => navigation.navigate('Settings')}
            fallbackName="StayOnMap host"
          />


          {/* Web's host nav has a Calendar TAB; mobile's bottom bar is full at
              five, so the calendar lives on the Dashboard. That made it the one
              host destination with no fixed home — a host who went looking for
              it in the menu found nothing. It is reachable from both places
              now; this row crosses tabs into the Dashboard stack. */}
          <AccountGroup>
            <AccountRow
              label="Calendar"
              onPress={() => navigation.getParent()?.navigate('Dashboard', { screen: 'Calendar', initial: false })}
            />
          </AccountGroup>

          <AccountGroup>
            <AccountRow label="Notifications" onPress={() => navigation.navigate('Notifications')} />
            <AccountRow label="Settings" onPress={() => navigation.navigate('Settings')} />
            <AccountRow label="Help" count={supportWaiting} onPress={() => navigation.navigate('Support')} />
          </AccountGroup>

          {/* Its own group, deliberately: an irreversible action should not sit
              one row below "Help" where a mis-tap lands on it. */}
          <AccountGroup>
            <AccountRow label="Log out" danger onPress={confirmSignOut} />
          </AccountGroup>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.slate50 },
  scroll: { paddingBottom: spacing.xxl },
  body: { padding: spacing.md, gap: spacing.sm },
})
