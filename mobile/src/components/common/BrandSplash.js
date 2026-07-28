import { useEffect, useMemo, useState } from 'react'
import { Animated, Easing, StyleSheet, useWindowDimensions } from 'react-native'
import Logo from '@components/common/Logo'
import { useAuth } from '@features/auth/hooks/useAuth'
import { colors } from '@theme/colors'
import { fontSizes } from '@theme/typography'

// THE launch screen — wordmark only, no mark, per `.claude/ui-ux.md`'s
// "StayOnMap Logo — Mandatory Rule".
//
// The user sees one continuous green launch. Technically there are three
// surfaces and all of them are brand-600: expo-splash-screen paints it before
// JS exists (carrying the adaptive icon's white S — the wordmark can't go
// there, Android 12+ would circle-clip it, see app.config.js), this overlay
// paints it and animates the name in, and GetStartedScreen — the screen
// underneath — is brand-600 too. The order is mark → name → app: the mark
// greets you, the name arrives the instant JS is up. Nothing white ever
// appears, and the fade-out reads as the wordmark dissolving into the first
// real screen rather than as a screen change.
//
// The three colours MUST stay in sync: app.config.js's splash
// `backgroundColor`, `styles.root` below, and GetStartedScreen's container.
// Any drift shows up as a flash on every cold start — which is exactly how
// this screen shipped as a blank near-white void once before.
//
// Sizing is explicit (`useWindowDimensions`) rather than left to
// `absoluteFillObject` alone: under Fabric this overlay laid itself out in
// normal flow as a sibling of the navigator, so the wordmark rendered as a
// clipped strip BELOW the app instead of over it.
//
// It shows for as long as the app needs and not a moment more — no fixed
// hold. A splash that outlasts the work it covers is just a delay with a logo
// on it, and this one used to add 1220ms of that to every launch.
export default function BrandSplash({ onFinish }) {
  const { width, height } = useWindowDimensions()
  // Held open by real work, not a timer: this is the session rehydrating
  // (AuthContext's AsyncStorage read plus, for a signed-in user, /auth/me).
  const { loading } = useAuth()
  // useMemo, not `useRef(new Animated.Value(0)).current` — the house pattern
  // (PropertyDetailScreen.js). The ref form evaluates `new Animated.Value()`
  // on every render only to throw the result away, and reading `.current`
  // during render is a lint error.
  const wordmark = useMemo(() => new Animated.Value(0), [])
  const fade = useMemo(() => new Animated.Value(1), [])
  const [shown, setShown] = useState(false)
  // The name has arrived and the app behind it is ready — the fade is running.
  const leaving = shown && !loading

  useEffect(() => {
    const anim = Animated.timing(wordmark, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    })
    anim.start(({ finished }) => {
      if (finished) setShown(true)
    })
    // Unmounting mid-animation (fast refresh, process death) must not leave the
    // overlay stuck at opacity 0 over a live app.
    return () => anim.stop()
  }, [wordmark])

  // Leaves the moment BOTH are true: the name has finished arriving, and the
  // app behind it is ready. There is no fixed hold — the old one ran a flat
  // 1220ms whatever the app was doing, so a warm start stared at a finished
  // logo for half a second and a cold one handed over to a loading spinner.
  // `loading` always resolves: api.js sets a 10s axios timeout, so a dead
  // network ends this rather than stranding it.
  useEffect(() => {
    if (!leaving) return
    const anim = Animated.timing(fade, {
      toValue: 0,
      duration: 260,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    })
    anim.start(({ finished }) => {
      if (finished) onFinish?.()
    })
    return () => anim.stop()
  }, [leaving, fade, onFinish])

  return (
    <Animated.View
      style={[styles.root, { width, height, opacity: fade }]}
      // Blocks touches while it is opaque — a blind tap must not reach a
      // button nobody can see — and stops blocking the instant the fade
      // starts, because by then the real screen is visible underneath and
      // eating its taps for 260ms reads as the app being frozen on launch.
      pointerEvents={leaving ? 'none' : 'auto'}
      // `accessible` collapses the subtree into one node: without it TalkBack
      // focuses this container AND the Logo's own Text, announcing the
      // wordmark twice.
      accessible
      accessibilityRole="image"
      accessibilityLabel="StayOnMap"
    >
      <Animated.View
        style={{
          opacity: wordmark,
          transform: [
            { translateY: wordmark.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
          ],
        }}
      >
        <Logo size={fontSizes.displayLarge} onDark />
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    // Must match expo-splash-screen's backgroundColor in app.config.js AND
    // GetStartedScreen's background — see the note above.
    backgroundColor: colors.brand600,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    elevation: 100,
  },
})
