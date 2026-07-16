import { useState } from 'react'

// Resets local state exactly once when `visible` transitions false → true —
// the React-docs "adjust state during render" pattern instead of an effect
// (an effect-based reset commits once with stale state, then re-renders;
// this bails out and re-renders before the first paint, and avoids the
// react-hooks/set-state-in-effect lint rule).
export function useResetOnOpen(visible, resetFn) {
  const [prevVisible, setPrevVisible] = useState(visible)
  if (visible !== prevVisible) {
    setPrevVisible(visible)
    if (visible) resetFn()
  }
}
