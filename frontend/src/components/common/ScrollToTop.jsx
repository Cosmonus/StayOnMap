import { useEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

// React Router keeps the window scroll position across navigations, so a page
// opened from a scrolled footer/menu link started half-way down. Reset to top
// on forward navigations only: POP (back/forward) keeps the browser's own
// position, and hash links are left for the anchor to handle.
export default function ScrollToTop() {
  const { pathname, hash } = useLocation()
  const navigationType = useNavigationType()

  useEffect(() => {
    if (hash || navigationType === 'POP') return
    window.scrollTo(0, 0)
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
