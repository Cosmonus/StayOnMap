// What changed since we last saw this place, and whether we believe it.
//
// PURE — no Prisma, no network, no clock it did not receive. Every decision in
// this file is either recorded or applied to production data, so the whole set
// of cases can be enumerated in a test rather than sampled. Same argument as
// features/support/visibility.js.
//
// The rule the brief calls "never blindly overwrite", stated as it actually
// applies here: `blindly` is the operative word, not `overwrite`. With ONE
// source, refusing OSM's newer coordinate does not get us a better one — it
// keeps an older observation from the same mapper community and calls that
// caution. So the default is APPLY AND RECORD: take the new value, keep the old
// one in a PoiConflict row, and let confidence and review use it.
//
// There is exactly one withhold case, and it is a spatial-validation failure
// rather than a disagreement: a jump so large that "the place moved" is a worse
// explanation than "this record is now wrong". A hospital does not relocate four
// kilometres, so applying that would put it in another suburb on every card that
// cites it. See poiPolicy.js's implausibleMoveM.
//
// When a second source lands, the withhold path generalises to genuine
// cross-source disagreement. It is deliberately NOT generalised now —
// proximityIndex.js states the rule this follows: build the machinery when the
// problem arrives, not in anticipation of it.
import { haversineMeters } from '../../lib/geohash.js'
import { isWithinIndia } from '../../utils/geo.js'
import { normalizeName } from './places.js'
import { moveThresholdM, implausibleMoveM } from './poiPolicy.js'

/** Attributes we compare. Kept as data so the rollup can group by them. */
export const CONFLICT_ATTRIBUTES = ['location', 'name', 'category']

/**
 * Is this coordinate usable at all?
 *
 * Three failures, and they are genuinely different things:
 *   - not a finite number      — a parse failure upstream
 *   - null island (0, 0)       — the classic "the field was empty" coordinate,
 *                                which is a valid point in the Gulf of Guinea
 *                                and therefore passes every range check
 *   - outside India            — real data, wrong hemisphere for this product
 *
 * Uses utils/geo.js's isWithinIndia rather than restating the box.
 * `tests/india-bounds-single-source.test.js` fails the build on a duplicate,
 * and it is right to.
 *
 * @returns {{valid: boolean, reason: string|null}}
 */
export function validateCoordinate(lat, lng) {
  const a = Number(lat)
  const b = Number(lng)
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return { valid: false, reason: 'coordinate is not a finite number' }
  }
  // Checked before the bounds test, which would reject it anyway but report the
  // wrong reason — and "null island" is the one that says the bug is upstream.
  if (a === 0 && b === 0) {
    return { valid: false, reason: 'coordinate is (0, 0) — an unset field, not a place' }
  }
  if (!isWithinIndia(a, b)) {
    return { valid: false, reason: 'coordinate is outside India' }
  }
  return { valid: true, reason: null }
}

/** Round-trip a Decimal|string|number coordinate to a plain number. */
const num = (v) => (v == null ? null : Number(v))

/** "12.9352, 77.6245" — how a coordinate reads in a conflict row. */
function coordText(lat, lng) {
  const a = num(lat)
  const b = num(lng)
  return a == null || b == null ? null : `${a.toFixed(6)}, ${b.toFixed(6)}`
}

/**
 * Compare a stored POI against an incoming observation of the same osmId.
 *
 * Returns the conflicts to record AND the row to actually write, because the
 * two are not independent: a withheld coordinate must not reach the database,
 * and deciding that in one place is what stops the write path and the audit
 * trail describing different outcomes.
 *
 * @param {object} stored    the PoiIndex row as it is now
 * @param {object} incoming  the row the fetch just built
 * @param {{source?: string}} [opts]
 * @returns {{
 *   conflicts: Array<{attribute, currentValue, incomingValue, source, distanceM, applied}>,
 *   resolved: object,   // what to write — `incoming`, minus anything withheld
 *   withheld: string[], // attributes we declined to take
 * }}
 */
export function detectConflicts(stored, incoming, { source = 'osm' } = {}) {
  const conflicts = []
  const withheld = []
  const resolved = { ...incoming }

  if (!stored) return { conflicts, resolved, withheld }

  // ── Location. The only attribute with a magnitude, and the only one that can
  // be withheld.
  const sLat = num(stored.lat)
  const sLng = num(stored.lng)
  const iLat = num(incoming.lat)
  const iLng = num(incoming.lng)

  if ([sLat, sLng, iLat, iLng].every((v) => v != null && Number.isFinite(v))) {
    const movedM = Math.round(haversineMeters(sLat, sLng, iLat, iLng))
    // The category we compare against is the STORED one. Using the incoming
    // category would let a mis-classification widen its own move threshold —
    // a shop mis-tagged as an airport would get a 1 km footprint and its
    // relocation would stop being a finding.
    const threshold = moveThresholdM(stored.category)

    if (movedM > threshold) {
      const implausible = movedM > implausibleMoveM(stored.category)
      if (implausible) {
        // Keep OUR coordinate. The one case where the stored value wins.
        resolved.lat = stored.lat
        resolved.lng = stored.lng
        withheld.push('location')
      }
      conflicts.push({
        attribute: 'location',
        currentValue: coordText(sLat, sLng),
        incomingValue: coordText(iLat, iLng),
        source,
        distanceM: movedM,
        applied: !implausible,
      })
    }
  }

  // ── Name. Compared NORMALISED, so punctuation and casing churn — which OSM
  // produces constantly and which changes nothing — does not fill the table
  // with noise that hides the real renames.
  const sName = normalizeName(stored.name)
  const iName = normalizeName(incoming.name)
  // A name ARRIVING where there was none is an improvement, not a disagreement.
  // A name DISAPPEARING is a real finding and is recorded.
  if (sName && sName !== iName) {
    conflicts.push({
      attribute: 'name',
      currentValue: stored.name ?? null,
      incomingValue: incoming.name ?? null,
      source,
      distanceM: null,
      applied: true,
    })
  }

  // ── Category. Always applied: our vocabulary has been re-cut twice
  // (school/college, restaurant/fast_food) and both times the re-seed's whole
  // purpose was to reclassify stored rows in place. Withholding would have made
  // those fixes impossible. The row records that it happened, which is what the
  // vocabulary changes previously lacked.
  if (stored.category && incoming.category && stored.category !== incoming.category) {
    conflicts.push({
      attribute: 'category',
      currentValue: stored.category,
      incomingValue: incoming.category,
      source,
      distanceM: null,
      applied: true,
    })
  }

  return { conflicts, resolved, withheld }
}
