// Public web URLs the app hands to OTHER apps — share sheets, mail, anything
// that leaves our process. Not for navigating inside the app: opening one of
// our own pages in a browser is banned (mobile/AGENTS.md §1).
//
// WWW ONLY, and this is load-bearing rather than tidiness: the apex
// stayonmap.com 301-redirects to www and DROPS THE PATH doing it, so an apex
// property link lands on the homepage. It is also the exact host Android has
// verified for App Links (app.config.js's intentFilters + the prefixes in
// navigation/RootNavigator.js) — a shared link on any other host opens a
// browser instead of the app, which is the whole reason to send a link at all.
// Change this and both of those must change with it.
export const WEB_ORIGIN = 'https://www.stayonmap.com'

// Mirrors RootNavigator's `PropertyDetail: 'property/:propertyId'` deep link, so
// a recipient with the app installed opens the listing rather than the website.
export const propertyUrl = (id) => `${WEB_ORIGIN}/property/${id}`
