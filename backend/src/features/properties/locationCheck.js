// Does this listing's location add up? Claimed pincode vs claimed city vs the
// map pin, each checked against ground truth we actually hold.
//
// Every location fact on a listing is the OWNER'S claim. This module compares
// three of them against two independent sources:
//
//   claimed pincode  → India Post's directory (PincodeDirectory)
//   map pin (lat/lng)→ OSM admin boundaries   (features/spatial/boundaryLookup)
//
// The design constraint that shapes everything here: a false "your address is
// wrong" is WORSE than silence. It accuses an owner, in public, on our own
// error. So findings come in two strengths and only two:
//
//   'high' — contradictions that cannot be a spelling quirk: a pincode India
//            Post has never issued, or a pincode whose state disagrees with the
//            listing's city. These are typo-or-invention, and both are worth a
//            moderator's eyes.
//   'info' — the coordinate's OSM district differing from the pincode's postal
//            district. District names disagree LEGITIMATELY across the two
//            sources ("Bengaluru" vs "Bangalore North"), so this is evidence
//            for the AI scan and moderation context, never an accusation.
//
// Never throws; returns null when checking is impossible (directory unseeded,
// infra down). "We could not check" must not become a finding.
import { pincodeInfo } from '../spatial/pincodeProvider.js'
import { boundariesAt } from '../spatial/boundaryLookup.js'
import { STATE_OF_CITY } from '../../config/cities.js'
import { intelError } from '../../lib/intelLog.js'

// Names the two sources spell differently but mean identically. Small and
// explicit rather than fuzzy-matched: edit distance would happily equate
// "Bangalore Rural" with "Bangalore Urban", which are different places.
const DISTRICT_ALIASES = [
  ['bengaluru', 'bangalore'],
  ['mumbai', 'greater mumbai', 'mumbai suburban', 'mumbai city'],
  ['delhi', 'new delhi', 'central delhi', 'north delhi', 'south delhi', 'east delhi', 'west delhi'],
  ['kolkata', 'calcutta'],
  ['chennai', 'madras'],
  ['pune', 'poona'],
]

function sameDistrict(a, b) {
  const na = String(a ?? '').toLowerCase().trim()
  const nb = String(b ?? '').toLowerCase().trim()
  if (!na || !nb) return true // can't compare → not a mismatch
  if (na === nb || na.includes(nb) || nb.includes(na)) return true
  return DISTRICT_ALIASES.some((group) =>
    group.some((g) => na.includes(g)) && group.some((g) => nb.includes(g))
  )
}

/**
 * @param {{ pincode?: string, city?: string, lat?: number|string, lng?: number|string }} listing
 * @returns {Promise<null | {
 *   ok: boolean,
 *   findings: Array<{ code: string, level: 'high'|'info', message: string }>,
 *   groundTruth: { state: string, districts: string[], offices: number } | null,
 * }>}
 */
export async function checkListingLocation(listing) {
  try {
    const pincode = String(listing?.pincode ?? '').trim()
    if (!pincode) return null // nothing claimed, nothing to check

    const info = await pincodeInfo(pincode)
    if (!info.available) return null // directory unseeded — we cannot check

    const findings = []

    if (!info.found) {
      findings.push({
        code: 'unknown_pincode',
        level: 'high',
        message: `India Post has no pincode ${pincode} — likely a typo, possibly invented.`,
      })
      return { ok: false, findings, groundTruth: null }
    }

    const expectedState = STATE_OF_CITY[listing.city]
    if (expectedState && info.found.state.toUpperCase() !== expectedState) {
      findings.push({
        code: 'pincode_state_mismatch',
        level: 'high',
        message: `Pincode ${pincode} is in ${info.found.state} (${info.found.districts.join('/')}), ` +
          `but the listing claims ${listing.city} — a different state entirely.`,
      })
    }

    // The soft check: where the PIN sits vs where the PINCODE lives. Only when
    // we have boundary data for the coordinate, and only ever as 'info'.
    if (listing.lat != null && listing.lng != null) {
      const bounds = await boundariesAt(Number(listing.lat), Number(listing.lng)).catch(() => null)
      const osmDistrict = bounds?.find((b) => b.adminLevel === 6)?.name
      if (osmDistrict && !info.found.districts.some((d) => sameDistrict(d, osmDistrict))) {
        findings.push({
          code: 'district_looks_different',
          level: 'info',
          message: `The map pin sits in ${osmDistrict} (OSM), while pincode ${pincode} belongs to ` +
            `${info.found.districts.join('/')} (India Post). District naming differs between ` +
            'sources, so treat this as a prompt to look, not proof of anything.',
        })
      }
    }

    return {
      ok: !findings.some((f) => f.level === 'high'),
      findings,
      groundTruth: {
        state: info.found.state,
        districts: info.found.districts,
        offices: info.found.offices.length,
      },
    }
  } catch (err) {
    intelError('properties.location_check_failed', err, { pincode: listing?.pincode })
    return null
  }
}
