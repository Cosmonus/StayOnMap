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
import { spacing } from '@theme/spacing'

// The account screen. Name, where they are renting, and a row per thing they can
// act on — each carrying its COUNT, because a bare "Visits" row makes you open
// it to find out there is nothing there.
//
// Rows are cards rather than a divided list: on a phone a card is a tap target
// whose edges you can see, and the 48px divided rows with a coloured icon puck
// each read as a settings menu rather than as the renter's own home screen.
//
// The row and mode-card primitives live in components/AccountRow so the host's
// Profile tab (a separate screen — the whole tab bar swaps with the mode) is the
// same screen and not a lookalike.

export default function ProfileScreen({ navigation }) {
  const { user, signOut } = useAuth()
  const hostMode = useUiStore((s) => s.hostMode)
  const setHostMode = useUiStore((s) => s.setHostMode)
  const waiting = useOtherHatWaiting()

  const { data: account, isLoading, isError, refetch } = useQuery({
    queryKey: ['account-summary'],
    queryFn: () => userService.accountSummary().then((r) => r.data),
    enabled: !!user,
  })

  // "Renting in Bengaluru · 240 points" — each half dropped when we don't have
  // it, rather than shown as "· 0 points" on a brand-new account.
  const meta = [
    account?.city ? `${hostMode ? 'Hosting' : 'Renting'} in ${account.city}` : null,
    account?.points ? `${account.points} points` : null,
  ].filter(Boolean).join(' · ')

  function confirmSignOut() {
    Alert.alert('Log out?', 'You can sign back in any time.', [
      { text: 'Stay', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: signOut },
    ])
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <ScreenHeader
        title="Profile"
        below={<ModeSwitch hostMode={hostMode} onChange={setHostMode} waiting={waiting} />}
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.body}>
          <AccountIdentity
            account={account && { ...account, meta }}
            isLoading={isLoading}
            isError={isError}
            onRetry={() => refetch()}
            onPress={() => navigation.navigate('Settings')}
            fallbackName="StayOnMap user"
          />

          {/* What you have going on, then the app's own settings. Two groups
              rather than one list of eight: the first is about your tenancy,
              the second is about the app, and they are not the same errand. */}
          <AccountGroup>
            <AccountRow
              label="Visits"
              count={account?.confirmedVisits ? `${account.confirmedVisits} confirmed` : null}
              onPress={() => navigation.navigate('Appointments')}
            />
            <AccountRow
              label="Rented"
              count={account?.activeLeases ? `${account.activeLeases} active lease${account.activeLeases === 1 ? '' : 's'}` : null}
              onPress={() => navigation.navigate('Leases')}
            />
            {/* Only when there IS something to write. A "Reviews you can write · 0"
                row is an invitation to a dead end. */}
            {!!account?.reviewableHomes && (
              <AccountRow
                label="Reviews you can write"
                count={String(account.reviewableHomes)}
                onPress={() => navigation.navigate('Leases')}
              />
            )}
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
