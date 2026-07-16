// Dual-thumb range slider — port of web's RangeSlider.jsx built on
// gesture-handler Pan + reanimated (no new deps). Thumb positions are driven
// on the UI thread; the draft is committed once, on release, so dragging
// never re-renders the whole filter sheet per tick (only this component's
// own labels live-update). A thumb parked at either end of the domain means
// "no constraint" (null), matching web and the min/max inputs' semantics.
import { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated'
import { colors } from '@theme/colors'
import { shadows } from '@theme/shadows'
import { fonts, fontSizes } from '@theme/typography'
import { spacing } from '@theme/spacing'

const THUMB = 28
const AREA_HEIGHT = 36
const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } // 28pt thumb → 44pt target

// Same ₹k/L/Cr label logic as web's RangeSlider.jsx
function fmt(n, unit) {
  if (unit === '₹') {
    if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(n % 10_000_000 ? 1 : 0)}Cr`
    if (n >= 100_000) return `₹${(n / 100_000).toFixed(n % 100_000 ? 1 : 0)}L`
    if (n >= 1000) return `₹${Math.round(n / 1000)}k`
    return `₹${n}`
  }
  return unit ? `${n.toLocaleString('en-IN')} ${unit}` : n.toLocaleString('en-IN')
}

export default function RangeSlider({ domain, unit, min, max, onChange }) {
  const { min: dMin, max: dMax, step } = domain
  const [trackWidth, setTrackWidth] = useState(0)

  const lo = Math.min(Math.max(min ?? dMin, dMin), dMax)
  const hi = Math.min(Math.max(max ?? dMax, dMin), dMax)

  // Label values during a drag — committing per tick would re-render the
  // entire sheet at gesture rate, so only these labels update live.
  const [live, setLive] = useState(null) // { lo, hi } while dragging

  const loX = useSharedValue(0)
  const hiX = useSharedValue(0)
  const grabX = useSharedValue(0)
  const lastTick = useSharedValue(-1)

  // Sync thumb pixels from committed values whenever not mid-drag
  useEffect(() => {
    if (live || trackWidth <= 0) return
    const span = dMax - dMin
    loX.value = ((lo - dMin) / span) * trackWidth
    hiX.value = ((hi - dMin) / span) * trackWidth
  }, [live, lo, hi, trackWidth, dMin, dMax, loX, hiX])

  // Gestures are memoized (not rebuilt on every live-label re-render), so
  // JS-side callbacks go through a stable ref to avoid stale closures — the
  // standard react-native-gesture-handler + reanimated idiom for this case.
  const jsRef = useRef({})
  // eslint-disable-next-line react-hooks/refs -- deliberate stable-ref pattern, see comment above
  jsRef.current = {
    begin: () => setLive({ lo, hi }),
    tick: (isLo, v) =>
      setLive((prev) => {
        const base = prev ?? { lo, hi }
        return isLo ? { lo: Math.min(v, base.hi), hi: base.hi } : { lo: base.lo, hi: Math.max(v, base.lo) }
      }),
    commit: (isLo, v) => {
      // Web semantics: clamp against the other thumb, edge = null
      if (isLo) {
        const next = Math.min(v, hi)
        onChange({ min: next <= dMin ? null : next, max })
      } else {
        const next = Math.max(v, lo)
        onChange({ min, max: next >= dMax ? null : next })
      }
    },
    end: () => setLive(null),
  }
  const invokeRef = useRef((name, a, b) => jsRef.current[name](a, b))
  const invoke = invokeRef.current

  // The `invoke` dependency reads through invokeRef/jsRef by design (see the
  // stable-ref comment above) so the compiler can't verify this memoization
  // or the ref access inside `make` — both are the same intentional pattern.
  /* eslint-disable react-hooks/refs, react-hooks/preserve-manual-memoization */
  const gestures = useMemo(() => {
    const make = (isLo) =>
      Gesture.Pan()
        .hitSlop(HIT_SLOP)
        // The sheet's ScrollView owns vertical drags: only claim the touch
        // once it moves horizontally; give it up on early vertical movement.
        .activeOffsetX([-6, 6])
        .failOffsetY([-12, 12])
        .onBegin(() => {
          grabX.value = isLo ? loX.value : hiX.value
          runOnJS(invoke)('begin')
        })
        .onUpdate((e) => {
          const lower = isLo ? 0 : loX.value
          const upper = isLo ? hiX.value : trackWidth
          const px = Math.min(Math.max(grabX.value + e.translationX, lower), upper)
          if (isLo) loX.value = px
          else hiX.value = px
          const raw = dMin + (trackWidth > 0 ? px / trackWidth : 0) * (dMax - dMin)
          const v = Math.min(Math.max(Math.round(raw / step) * step, dMin), dMax)
          if (v !== lastTick.value) {
            lastTick.value = v
            runOnJS(invoke)('tick', isLo, v)
          }
        })
        .onEnd(() => {
          const px = isLo ? loX.value : hiX.value
          const raw = dMin + (trackWidth > 0 ? px / trackWidth : 0) * (dMax - dMin)
          const v = Math.min(Math.max(Math.round(raw / step) * step, dMin), dMax)
          runOnJS(invoke)('commit', isLo, v)
        })
        .onFinalize(() => {
          runOnJS(invoke)('end')
        })
    return { lo: make(true), hi: make(false) }
  }, [trackWidth, dMin, dMax, step, invoke, loX, hiX, grabX, lastTick])
  /* eslint-enable react-hooks/refs, react-hooks/preserve-manual-memoization */

  const loStyle = useAnimatedStyle(() => ({ transform: [{ translateX: loX.value - THUMB / 2 }] }))
  const hiStyle = useAnimatedStyle(() => ({ transform: [{ translateX: hiX.value - THUMB / 2 }] }))
  const fillStyle = useAnimatedStyle(() => ({ left: loX.value, width: Math.max(hiX.value - loX.value, 0) }))

  // TalkBack adjustable step — coarse enough to traverse the domain in ~40
  // actions instead of hundreds of single steps.
  const a11yStep = Math.max(step, Math.ceil((dMax - dMin) / 40 / step) * step)
  const onA11yAction = (isLo) => (event) => {
    const dir = event.nativeEvent.actionName === 'increment' ? 1 : event.nativeEvent.actionName === 'decrement' ? -1 : 0
    if (!dir) return
    // Runs only inside a TalkBack action event handler, never during render —
    // the same stable-ref pattern as the gesture callbacks above.
    // eslint-disable-next-line react-hooks/refs
    jsRef.current.commit(isLo, (isLo ? lo : hi) + dir * a11yStep)
  }
  const a11yActions = [{ name: 'increment' }, { name: 'decrement' }]

  const dispLo = live?.lo ?? lo
  const dispHi = live?.hi ?? hi

  return (
    <View>
      <View style={styles.trackWrap} onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}>
        <View style={styles.track} />
        <Animated.View style={[styles.fill, fillStyle]} />
        <GestureDetector gesture={gestures.lo}>
          <Animated.View
            // When max is pinned at the domain edge the thumbs can stack —
            // raise the min thumb so it stays grabbable at the right edge.
            style={[styles.thumb, hi >= dMax && styles.thumbOnTop, loStyle]}
            hitSlop={HIT_SLOP}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel="Minimum"
            accessibilityValue={{ min: dMin, max: dMax, now: dispLo, text: fmt(dispLo, unit) }}
            accessibilityActions={a11yActions}
            onAccessibilityAction={onA11yAction(true)}
          />
        </GestureDetector>
        <GestureDetector gesture={gestures.hi}>
          <Animated.View
            style={[styles.thumb, hiStyle]}
            hitSlop={HIT_SLOP}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel="Maximum"
            accessibilityValue={{ min: dMin, max: dMax, now: dispHi, text: fmt(dispHi, unit) }}
            accessibilityActions={a11yActions}
            onAccessibilityAction={onA11yAction(false)}
          />
        </GestureDetector>
      </View>
      <View style={styles.labels}>
        <Text style={styles.labelText}>{fmt(dispLo, unit)}</Text>
        <Text style={styles.labelText}>{dispHi >= dMax ? `${fmt(dMax, unit)}+` : fmt(dispHi, unit)}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  trackWrap: { height: AREA_HEIGHT, marginHorizontal: THUMB / 2, justifyContent: 'center' },
  track: { position: 'absolute', left: 0, right: 0, height: 4, borderRadius: 2, backgroundColor: colors.slate200 },
  fill: { position: 'absolute', height: 4, borderRadius: 2, backgroundColor: colors.slate800 },
  thumb: {
    position: 'absolute', left: 0, top: (AREA_HEIGHT - THUMB) / 2,
    width: THUMB, height: THUMB, borderRadius: THUMB / 2,
    backgroundColor: colors.white, borderWidth: 2, borderColor: colors.slate800,
    ...shadows.card,
  },
  thumbOnTop: { zIndex: 2, elevation: 3 },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  labelText: { fontFamily: fonts.bodyMedium, fontSize: fontSizes.xs, color: colors.slate500 },
})
