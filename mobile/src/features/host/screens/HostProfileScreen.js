import { View, ScrollView, Alert, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@features/auth/hooks/useAuth'
import { userService } from '@services/user.service'
import { useUiStore } from '@store/uiStore'
import { AccountGroup, AccountRow, ModeCard } from '@features/profile/components/AccountRow'
import AccountIdentity from '@features/profile/components/AccountIdentity'
import ScreenHeader from '@components/common/ScreenHeader'
import { colors } from '@theme/colors'
import { spacing } from '@theme/spacing'

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
  const { user, signOut } = useAuth()
  const setHostMode = useUiStore((s) => s.setHostMode)

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
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Titled like every other screen. The identity card below is content —
          the first row of the list, sharing its card shape — not a second
          header competing with this one. */}
      <ScreenHeader title="Account" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.body}>
          <AccountIdentity
            account={account && { ...account, meta }}
            isLoading={isLoading}
            isError={isError}
            onRetry={() => refetch()}
            onPress={() => navigation.navigate('Settings')}
            fallbackName="StayOnMap host"
          />

          <ModeCard hostMode onSwitch={() => setHostMode(false)} />

          {/* Web's host nav has a Calendar TAB; mobile's bottom bar is full at
              five, so the calendar lives on the Dashboard. That made it the one
              host destination with no fixed home — a host who went looking for
              it in the menu found nothing. It is reachable from both places
              now; this row crosses tabs into the Dashboard stack. */}
          <AccountGroup>
            <AccountRow
              label="Calendar"
              onPress={() => navigation.getParent()?.navigate('Dashboard', { screen: 'Calendar' })}
            />
          </AccountGroup>

          <AccountGroup>
            <AccountRow label="Notifications" onPress={() => navigation.navigate('Notifications')} />
            <AccountRow label="Settings" onPress={() => navigation.navigate('Settings')} />
            <AccountRow label="Help" onPress={() => navigation.navigate('Support')} />
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
