import { getStateFromPath } from '@react-navigation/native'
import { useUiStore } from '@store/uiStore'

// Both prefixes resolve to the same screens. The https one is only reachable
// once Android has VERIFIED the app against
// https://www.stayonmap.com/.well-known/assetlinks.json (app.config.js's
// intentFilters) — but it has to be listed here regardless, or a verified link
// launches the app and then lands on the default tab instead of the property,
// which looks like the deep link is broken when it is actually the router that
// never recognised the URL. WWW only: the apex redirect drops the path.
//
// THE TAB DEPENDS ON THE MODE, and until 2026-08-10 it did not. This named
// `Explore` unconditionally — a tab HOST_TABS does not mount — so a host
// tapping a shared listing link landed on Dashboard and the link silently
// died. That is the likeliest tap there is: the listing a host shares is
// usually their own. The push-tap path (navigationRef.js's
// referenceDestination) had branched on hostMode since it was written; only
// the URL path had not, which is exactly what AGENTS.md §5 forbids.
//
// Resolved per mode rather than by FLIPPING the mode, unlike a notification
// tap: a notification is addressed to a hat, so opening it in the other one
// shows a list that excludes it. A URL is addressed to nobody — someone sent a
// link — so yanking a host into renter mode to read it would be a side effect
// they never asked for. Both stacks carry PropertyDetail (BOOKING_SCREENS in
// AppTabs.js), so both can simply show it where the user already is.
//
// Its own module rather than a const inside RootNavigator so a test can reach
// the resolver without importing the entire navigator tree.
const PROPERTY_PATH = { PropertyDetail: 'property/:propertyId' }

const RENTER_LINKS = { screens: { Explore: { screens: PROPERTY_PATH } } }
const HOST_LINKS = { screens: { MyListing: { screens: PROPERTY_PATH } } }

export const linking = {
  prefixes: ['stayonmap://', 'https://www.stayonmap.com'],
  config: RENTER_LINKS,
  // Read at resolve time, not at module load: hostMode can flip while the app
  // is running, and a config captured once would be wrong from then on.
  getStateFromPath: (path, options) =>
    getStateFromPath(path, useUiStore.getState().hostMode ? HOST_LINKS : options),
}
