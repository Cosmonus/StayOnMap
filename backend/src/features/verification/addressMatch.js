// Does the address on the ownership document match the listing?
//
// Compares the owner's DECLARED document address (typed at verification
// submission, exactly as printed on the document) against the listing's
// address. No OCR, no AI: documents carry Aadhaar/PAN, and reading them by
// machine is a privacy decision above this module's pay grade. The admin reads
// the document; this module makes sure they read it with the listing address,
// the declaration, and a deterministic comparison side by side.
//
// What text comparison can honestly claim, and what it cannot:
//
//   PINCODES are exact. Two different six-digit codes on the same property is a
//   hard, deterministic contradiction — the strongest signal this module emits.
//
//   ADDRESS TEXT is soft. "12/4 3rd Cross, Kormangala 6th Block" and
//   "No 12/4, Third Cross Road, Koramangala VI Block" are the same door and
//   share barely half their tokens. So token overlap grades the match but a
//   LOW overlap alone is never a 'mismatch' — only a pincode contradiction is.
//   A false "your document doesn't match" aimed at an owner mid-verification
//   is the same sin as a false pincode accusation, and the same rule applies.
import { pincodeInfo } from '../spatial/pincodeProvider.js'

// Words that describe a location without identifying it. Dropped before
// comparing — "near", "opposite" and city/state names appear in both addresses
// of the same property AND both addresses of different properties.
const STOPWORDS = new Set([
  'near', 'opp', 'opposite', 'behind', 'beside', 'next', 'to', 'the', 'at',
  'india', 'india.', 'road', 'rd', 'street', 'st', 'main', 'cross',
])

// Spelling variants that are the same word on an Indian address.
const CANON = {
  rd: 'road', st: 'street', no: 'number', 'no.': 'number', apt: 'apartment',
  flr: 'floor', blk: 'block', bldg: 'building', nagar: 'nagar',
  i: '1', ii: '2', iii: '3', iv: '4', v: '5', vi: '6', vii: '7', viii: '8',
  '1st': '1', '2nd': '2', '3rd': '3', '4th': '4', '5th': '5', '6th': '6',
  '7th': '7', '8th': '8', '9th': '9', first: '1', second: '2', third: '3',
  fourth: '4', fifth: '5', sixth: '6',
}

/** Indian pincodes are six digits and never start with 0. */
export function extractPincode(text) {
  const m = String(text ?? '').match(/\b[1-9]\d{5}\b/)
  return m ? m[0] : null
}

/** Normalise an address into comparable significant tokens. */
export function addressTokens(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[,./#()-]/g, ' ')
    .split(/\s+/)
    .map((t) => CANON[t] ?? t)
    .filter((t) => t.length > 1 || /^\d$/.test(t))
    .filter((t) => !STOPWORDS.has(t))
    .filter((t) => !/^[1-9]\d{5}$/.test(t)) // the pincode is compared separately
}

/**
 * Compare the declared document address against the listing.
 *
 * @param {{ address?: string, pincode?: string, city?: string }} listing
 * @param {string} declared  the address as printed on the document
 * @returns {Promise<null | {
 *   verdict: 'match'|'partial'|'mismatch'|'not_comparable',
 *   pincode: { listing: string|null, document: string|null, match: boolean|null },
 *   overlap: number,          // 0..1 share of listing tokens found in the declaration
 *   documentPincodeArea: { state: string, districts: string[] } | null,
 *   notes: string[],
 * }>} null when there is no declaration to compare
 */
export async function compareAddresses(listing, declared) {
  const text = String(declared ?? '').trim()
  if (!text) return null

  const listingPin = extractPincode(listing?.pincode) ?? extractPincode(listing?.address)
  const docPin = extractPincode(text)

  const lt = addressTokens(listing?.address)
  const dt = new Set(addressTokens(text))
  const shared = lt.filter((t) => dt.has(t))
  const overlap = lt.length ? Math.round((shared.length / lt.length) * 100) / 100 : 0

  const pinMatch = listingPin && docPin ? listingPin === docPin : null

  const notes = []
  let verdict
  if (pinMatch === false) {
    // The one hard call this module makes: two different pincodes cannot both
    // be printed on the same property's paperwork by accident of spelling.
    verdict = 'mismatch'
    notes.push(`The document shows pincode ${docPin}; the listing says ${listingPin}.`)
  } else if (lt.length < 3 || dt.size < 3) {
    // Two significant tokens ("Flat 2") is nothing to compare against — any
    // verdict either way would be noise wearing a label.
    verdict = 'not_comparable'
    notes.push('One of the addresses is too short to compare meaningfully.')
  } else if (pinMatch === true && overlap >= 0.5) {
    verdict = 'match'
  } else if (overlap >= 0.5) {
    verdict = 'match'
    if (!docPin) notes.push('The declared document address carries no pincode — matched on text alone.')
  } else {
    // Low overlap is graded, never accused: legitimate spellings of the same
    // door can share under half their tokens.
    verdict = 'partial'
    notes.push('The two addresses share little text. That can be legitimate — spellings of the ' +
      'same address vary — but it is worth reading the document with this in mind.')
  }

  // Where India Post says the DOCUMENT's pincode is — so a reviewing admin sees
  // "the document's pincode is in KARNATAKA / Bengaluru" next to a Chennai
  // listing without doing the lookup themselves.
  let documentPincodeArea = null
  if (docPin) {
    const info = await pincodeInfo(docPin).catch(() => ({ available: false }))
    if (info.available && info.found) {
      documentPincodeArea = { state: info.found.state, districts: info.found.districts }
    }
  }

  return {
    verdict,
    pincode: { listing: listingPin ?? null, document: docPin ?? null, match: pinMatch },
    overlap,
    documentPincodeArea,
    notes,
  }
}
