/**
 * A shared listing link opens in whichever mode the app is already in.
 *
 * `linking.config` named `Explore` unconditionally — a tab HOST_TABS does not
 * mount — so a host tapping `stayonmap://property/:id` landed on Dashboard and
 * the link silently died. That is the likeliest tap of all: the listing a host
 * shares is usually their own.
 *
 * The push-tap path (navigationRef.js's referenceDestination) had branched on
 * hostMode since it was written. Only the URL path had not, which is exactly
 * what AGENTS.md §5 says must not happen.
 *
 * Resolved per MODE rather than by flipping it, unlike a notification tap: a
 * notification is addressed to a hat, so opening it in the other one shows a
 * list that excludes it. A URL is addressed to nobody — someone sent a link —
 * so yanking a host into renter mode to read it would be a side effect they
 * never asked for.
 */
const { useUiStore } = require('@store/uiStore')

// The container is not rendered here; only the resolver is under test. That is
// deliberate — the bug was in path→state resolution, and mounting a navigator
// to observe it would test far more than the thing that broke.
const { linking } = require('./linking')

const stateFor = (path) => linking.getStateFromPath(path, linking.config)

/** The tab name a resolved state lands on. */
const tabOf = (state) => state?.routes?.[0]?.name

describe('property deep links', () => {
  afterEach(() => useUiStore.setState({ hostMode: false }))

  it('opens under Explore in renter mode', () => {
    useUiStore.setState({ hostMode: false })
    expect(tabOf(stateFor('/property/abc123'))).toBe('Explore')
  })

  it('opens under MyListing in host mode, not a tab that is not mounted', () => {
    useUiStore.setState({ hostMode: true })
    expect(tabOf(stateFor('/property/abc123'))).toBe('MyListing')
  })

  it('carries the property id in both modes', () => {
    for (const hostMode of [false, true]) {
      useUiStore.setState({ hostMode })
      expect(JSON.stringify(stateFor('/property/abc123'))).toContain('abc123')
    }
  })

  it('reads the mode at resolve time, so a mid-session switch is honoured', () => {
    // A config captured at module load would be wrong from the first switch on.
    useUiStore.setState({ hostMode: false })
    expect(tabOf(stateFor('/property/x'))).toBe('Explore')
    useUiStore.setState({ hostMode: true })
    expect(tabOf(stateFor('/property/x'))).toBe('MyListing')
  })

  it('still accepts both prefixes', () => {
    // The https one only fires once Android has verified assetlinks.json, but
    // it has to be listed or a verified link launches the app and then lands
    // on the default tab — which reads as a broken deep link.
    expect(linking.prefixes).toContain('stayonmap://')
    expect(linking.prefixes).toContain('https://www.stayonmap.com')
  })
})
