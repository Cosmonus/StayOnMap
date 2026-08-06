// The event vocabulary. A CLOSED set, deliberately.
//
// The failure mode of every analytics implementation is the same: `track()`
// takes any string, six months of drift produce `property_view`,
// `propertyView`, `view_property` and `property-view`, and no query can ever
// count them together again. Validation rejects anything not listed here, so
// adding an event is a one-line PR and a typo is a 400 rather than a silent
// second metric.
//
// Scope is one funnel plus one duration. `docs/world-class-plan-2026-07-30.md`
// item 2 says instrument exactly one funnel first, and it is right: a hundred
// events nobody looks at is the same as none, and each one is a decision about
// what we are willing to record about people.

/**
 * The funnel, in order. Every step must be a real user intent — "the map
 * moved" is not a step, which is why MAP_VIEW is emitted once per session
 * rather than per pan.
 */
export const FUNNEL = [
  'map_view',           // saw the map at all — the top of everything
  'pin_tap',            // opened a listing preview from the map
  'property_view',      // opened a full property page
  'contact_intent',     // pressed call / message / request-a-visit
  'appointment_created', // actually booked
]

/**
 * Outside the funnel. `listing_publish_completed` carries `msSinceDraftStart`
 * — the time-to-publish number item 4 (get to 100 listings in one city) lives
 * or dies on. If publishing takes forty minutes, no amount of marketing fixes
 * the supply problem.
 *
 * It is emitted SERVER-side and measured from `ListingDraft.createdAt`, not
 * from a client "wizard opened" event. The server already knows when the draft
 * began, its clock is the one that can be trusted, and a second event would be
 * a second thing to keep in sync for no extra truth.
 */
export const STANDALONE = ['listing_publish_completed']

export const EVENT_NAMES = [...FUNNEL, ...STANDALONE]

/**
 * What a browser or app may send. The funnel and nothing else: those five
 * steps are user intents only the client can witness. Everything server-side
 * is rejected here, so a client cannot fabricate a publish — or the duration
 * attached to it.
 */
export const CLIENT_EVENTS = [...FUNNEL]

// 90 days. Long enough to compare this month against last, short enough that
// we are not sitting on a year of behavioural data nobody has queried — the
// DPDP principle is to keep what you use, and the funnel only ever looks back
// weeks. Enforced by pruneOldEvents() in the service.
export const RETENTION_DAYS = 90
