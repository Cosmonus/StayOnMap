// "No internet connection" — one banner for the whole app.
//
// WHY IT EXISTS. Every data surface in this app has an error branch with a
// retry (AGENTS.md §10), and each of those branches says the same unhelpful
// thing when the network is simply gone: something went wrong, try again.
// Twelve identical failures on twelve screens is not twelve problems, and the
// retry button they all offer cannot work. One banner naming the actual cause
// turns a wall of errors back into one fact the person can act on — and it is
// the one state where "try again" is the wrong advice.
//
// WHY IT LIVES IN App.js. Connectivity is not any screen's business, and a
// per-screen banner would stack on a pushed screen and appear twice. Rendered
// as the last sibling of the navigator like BrandSplash, so it floats over
// whatever is mounted without a Modal (a Modal would fight the hardware back
// handler for a thing that is not dismissible).
//
// WHAT IT DELIBERATELY DOES NOT DO: block anything, queue writes, or offer
// offline mode. The map needs the network — offline mode is explicitly out of
// scope (`.claude/roadmap.md`'s Never Build). This only names the cause.
import { useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Network from 'expo-network'
import Icon from './Icon'
import { colors } from '@theme/colors'
import { shadows } from '@theme/shadows'
import { fonts, fontSizes } from '@theme/typography'
import { spacing, radius } from '@theme/spacing'

// `isInternetReachable` is the honest question — Android reports a captive
// portal or a connected-but-dead Wi-Fi as CONNECTED, which is exactly the case
// where a user is most convinced the app is broken. It is nullable while the
// probe is still running, and `=== false` (not `!value`) is what keeps that
// "don't know yet" from flashing a banner on every cold start.
const isOffline = (state) => state?.isInternetReachable === false

export default function OfflineBanner() {
  const insets = useSafeAreaInsets()
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    let alive = true
    // The listener only fires on CHANGE, so an app opened with no network
    // would show nothing until the network came back — the one moment the
    // banner is most needed. Ask once, then subscribe.
    Network.getNetworkStateAsync()
      .then((state) => { if (alive) setOffline(isOffline(state)) })
      .catch(() => {})

    const sub = Network.addNetworkStateListener((state) => setOffline(isOffline(state)))
    return () => { alive = false; sub.remove() }
  }, [])

  if (!offline) return null

  return (
    <View
      style={[styles.wrap, { paddingTop: insets.top + spacing.sm }]}
      // Announced, not just drawn: someone using TalkBack gets no benefit from
      // a bar appearing silently over the screen they are reading.
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <View style={styles.pill}>
        <Icon name="wifiOff" size={16} color={colors.white} />
        <Text style={styles.text}>No internet connection</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  // Top, not bottom: the bottom belongs to the tab bar and to chat's input,
  // and covering either one hides a control while telling someone why their
  // tap did nothing.
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', paddingBottom: spacing.sm },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.slate800, borderRadius: radius.full,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    ...shadows.float,
  },
  text: { fontFamily: fonts.bodySemiBold, fontSize: fontSizes.sm, color: colors.white },
})
