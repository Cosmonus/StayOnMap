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

/**
 * How a session STARTED, when it started somewhere other than the map.
 *
 * `seo_landing_view` is deliberately NOT a funnel step. The funnel's top is
 * `map_view` and every rate is quoted against it; inserting a step above that
 * would make every session arriving directly on the map look like a drop-off
 * from a page it never saw. This is a SEGMENT, not a stage — it answers "of the
 * people who landed from search, how many reached each step", which is the
 * question the funnel alone cannot answer.
 *
 * One event, not one per page type. `seo_landing_view` carries the page in its
 * props rather than splitting into `locality_landing_view`,
 * `city_landing_view`, and so on — the closed-set rule at the top of this file
 * exists because that kind of splitting is how a vocabulary rots.
 */
export const ENTRY = ['seo_landing_view']

/**
 * The WhatsApp listing funnel (features/whatsapp/). SERVER-ONLY, like
 * STANDALONE: every one of these is witnessed by the webhook handler, never by
 * a browser, so a client sending one is fabricating it. A SEPARATE funnel from
 * FUNNEL above rather than more steps on it — that one counts renters looking
 * for a home, this one counts owners offering one, and quoting an owner's
 * "publish confirmed" against a renter's "map view" is a rate that means
 * nothing. The session id is the conversation id, so "sessions" here are
 * conversations. Read out by features/whatsapp/admin.whatsapp.service.js.
 */
export const WHATSAPP_FUNNEL = [
  'wa_conversation_started',
  'wa_type_selected',
  'wa_questionnaire_started',
  'wa_location_submitted',
  'wa_photos_submitted',
  'wa_draft_completed',
  'wa_review_shown',
  'wa_publish_confirmed',
  'wa_verification_passed',
  'wa_listing_published',
]

/**
 * Where the WhatsApp flow broke, so the admin readout can say WHICH question
 * loses people. Not steps — a failure is not progress — and never client-sent.
 */
export const WHATSAPP_FAILURES = [
  'wa_extraction_failed',
  'wa_location_failed',
  'wa_photo_failed',
  'wa_verification_failed',
  'wa_publish_failed',
  'wa_conversation_cancelled',
]

export const EVENT_NAMES = [...FUNNEL, ...STANDALONE, ...ENTRY, ...WHATSAPP_FUNNEL, ...WHATSAPP_FAILURES]

/**
 * What a browser or app may send: the funnel plus the entry marker. All of them
 * are things only the client can witness — five user intents, and "this session
 * began on a search landing page". `STANDALONE` stays server-only, so a client
 * still cannot fabricate a publish, or the duration attached to it.
 */
export const CLIENT_EVENTS = [...FUNNEL, ...ENTRY]

// 90 days. Long enough to compare this month against last, short enough that
// we are not sitting on a year of behavioural data nobody has queried — the
// DPDP principle is to keep what you use, and the funnel only ever looks back
// weeks. Enforced by pruneOldEvents() in the service.
export const RETENTION_DAYS = 90
