import { useEffect, useRef, useState } from 'react'

// react-native-maps renders a custom-view <Marker> as the default red pin when
// it stops tracking view changes before Android has finished painting the
// child view. Keeping tracksViewChanges on forever fixes the visuals but drains
// battery, so we turn it off shortly after the child view actually reports its
// own layout (via the `onLayout` handler this hook returns — attach it to the
// custom view), rather than guessing a fixed delay: a fixed delay is too short
// during a burst mount (many pins/stations/labels appearing at once, e.g. on
// cold app load or a city with ~280 metro stations) and some markers get
// frozen on the red pin forever since nothing re-triggers a snapshot after
// tracksViewChanges goes false. A generous failsafe timeout still exists in
// case onLayout never fires for some reason. Pass a `key` that changes
// whenever the marker's visible content changes (selection, label, count) so
// a fresh snapshot is captured each time; a static marker can pass a constant.
export function useMarkerRedraw(key) {
  const [tracksViewChanges, setTracksViewChanges] = useState(true)
  const laidOutRef = useRef(false)

  useEffect(() => {
    laidOutRef.current = false
    // Genuinely synchronizing with an external system (a setTimeout failsafe)
    // rather than deriving state from a prop — not the "adjust state during
    // render" case the lint rule is steering toward.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTracksViewChanges(true)
    const failsafe = setTimeout(() => setTracksViewChanges(false), 1200)
    return () => clearTimeout(failsafe)
  }, [key])

  function onLayout() {
    if (laidOutRef.current) return
    laidOutRef.current = true
    // One more tick after layout so the native bridge has actually snapshotted
    // the view before we stop tracking it.
    setTimeout(() => setTracksViewChanges(false), 100)
  }

  return { tracksViewChanges, onLayout }
}
