import { useEffect, useState } from 'react'
import { Animated, StyleSheet } from 'react-native'
import Logo from './Logo'
import { colors } from '@theme/colors'

// The wordmark cannot live in the NATIVE splash on Android 12+: the system
// masks windowSplashScreenAnimatedIcon into a ~192dp circle, so a one-line
// 5:1 wordmark either clips at the sides or shrinks past legibility (see the
// comment on app.config.js's expo-splash-screen block — it was tried). The
// native splash therefore keeps the square "S" mark, and this hands off to
// the full wordmark on the SAME brand50 background the native splash paints,
// so the swap reads as one screen rather than a flash.
//
// Rendered as an overlay, not a gate: the app tree mounts underneath while
// this is visible, so the hold is spent on auth rehydration and first queries
// instead of being dead time.
export default function BrandSplash({ onDone, holdMs = 600 }) {
  // Lazy useState, not useRef — reading `.current` during render is an error
  // under the react-hooks/refs rule that ships with React 19.
  const [opacity] = useState(() => new Animated.Value(1))

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(
        ({ finished }) => {
          if (finished) onDone()
        },
      )
    }, holdMs)
    return () => clearTimeout(timer)
  }, [holdMs, onDone, opacity])

  return (
    <Animated.View style={[styles.fill, { opacity }]}>
      <Logo size={38} />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.brand50,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
