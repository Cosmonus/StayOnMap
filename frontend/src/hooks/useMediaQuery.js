import { useEffect, useState } from 'react'

/**
 * Subscribe to a CSS media query from JS.
 *
 * Exists so a component can be mounted in exactly ONE place across breakpoints
 * instead of twice with `hidden`/`lg:block`. CSS duplication is fine for purely
 * presentational markup, but anything holding state renders twice and keeps two
 * independent copies of it — which is how a commute result typed on desktop
 * used to vanish when the window narrowed.
 *
 * Prefer Tailwind's responsive classes for everything else; reach for this only
 * when a subtree must not exist twice.
 *
 * @param {string} query e.g. '(min-width: 1024px)' — Tailwind's `lg`
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(query).matches
  )

  useEffect(() => {
    const list = window.matchMedia(query)
    const onChange = (e) => setMatches(e.matches)

    // Re-read on mount: the query may have changed between the initial state
    // and this effect running.
    setMatches(list.matches)
    list.addEventListener('change', onChange)
    return () => list.removeEventListener('change', onChange)
  }, [query])

  return matches
}
