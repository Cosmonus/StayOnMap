// Where the property IS — the one fact the map cannot be wrong about.
//
// Three ways in, one way out. A WhatsApp location pin, a Google Maps link, or
// a typed place name each become a CANDIDATE: coordinates plus what reverse
// geocoding says about them plus a precision claim. A candidate is never a
// location until the owner confirms it, and a candidate that is only
// area-precise ("Velachery") is never offered for confirmation at all — the
// owner is asked for a pin instead. Nothing here publishes a guess.
//
// Public vs private: the exact coordinates are what gets stored on the
// Property, exactly as the web wizard stores them. What a stranger sees is
// decided at READ time by properties.service.js's applyLocationPrivacy(),
// keyed on User.showExactLocation — the same control the settings page has.
// This module only needs to tell the owner that choice exists.
import { geocode, reverseGeocode } from '../places/places.service.js'
import { resolveCity } from '../../config/cityCenters.js'
import { isWithinIndia } from '../../utils/geo.js'
import { intelError } from '../../lib/intelLog.js'

// Google's viewport for a result: wider than this and the "place" is an
// area, not an address. 300m diagonal ≈ a block.
const PRECISE_VIEWPORT_M = 300
const ROOFTOP_TYPES = new Set(['ROOFTOP', 'RANGE_INTERPOLATED'])

const MAPS_HOSTS = /(maps\.google\.|google\.[a-z.]+\/maps|goo\.gl\/maps|maps\.app\.goo\.gl|g\.co\/kgs|google\.com\/maps)/i

/** Does this text contain something that looks like a maps link? */
export function looksLikeMapsLink(text) {
  return typeof text === 'string' && /https?:\/\/\S+/i.test(text) && MAPS_HOSTS.test(text)
}

/** Coordinates hiding in a Google Maps URL, in every format Google emits. */
export function coordsFromMapsUrl(url) {
  if (typeof url !== 'string') return null
  const decoded = safeDecode(url)
  const patterns = [
    /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/,                 // .../@12.98,77.59,17z
    /[?&]q=(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/,            // ?q=12.98,77.59
    /[?&]ll=(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/,           // ?ll=
    /[?&]query=(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/,        // /search/?api=1&query=
    /[?&]destination=(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/,  // /dir/?destination=
    /!3d(-?\d{1,2}\.\d+)!4d(-?\d{1,3}\.\d+)/,             // ...!3d12.98!4d77.59
    /\/place\/(-?\d{1,2}\.\d+),\s*(-?\d{1,3}\.\d+)/,      // /place/12.98,77.59
  ]
  for (const re of patterns) {
    const m = decoded.match(re)
    if (m) {
      const lat = parseFloat(m[1]); const lng = parseFloat(m[2])
      if (isWithinIndia(lat, lng)) return { lat, lng }
    }
  }
  return null
}

function safeDecode(s) { try { return decodeURIComponent(s) } catch { return s } }

/**
 * Newer share links (maps.app.goo.gl → /maps/place/…) carry NO coordinates in
 * any format — the place rides in the URL as text: a plus code and address,
 * "43FR+7JW SRI VARI APPARTMENTS, …, Avadi". That text geocodes. `+` in the
 * path is a space and %2B is a real plus (the plus code's own), so the spaces
 * are replaced BEFORE decoding or the two become indistinguishable.
 */
export function placeTextFromMapsUrl(url) {
  if (typeof url !== 'string') return null
  const m = url.match(/\/maps\/place\/([^/?#]+)/i)
  if (!m) return null
  const text = safeDecode(m[1].replace(/\+/g, ' ')).trim()
  // A coordinate pair in the place slot is handled by coordsFromMapsUrl;
  // anything shorter than a plausible place name is noise.
  return text.length >= 3 && !/^-?\d+\.\d+,/.test(text) ? text.slice(0, 300) : null
}

/** "12.9716, 77.5946" typed by hand. */
export function coordsFromText(text) {
  const m = String(text ?? '').match(/(-?\d{1,2}\.\d{3,}),\s*(-?\d{1,3}\.\d{3,})/)
  if (!m) return null
  const lat = parseFloat(m[1]); const lng = parseFloat(m[2])
  return isWithinIndia(lat, lng) ? { lat, lng } : null
}

/**
 * Short links (maps.app.goo.gl/…) carry no coordinates — follow the redirect
 * once and read the long URL. HEAD with redirect: 'manual' so we never fetch
 * the map page itself; the Location header is all we need.
 */
export async function expandShortLink(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(6_000) })
    const loc = res.headers.get('location')
    if (loc) return loc
    // Some short links answer 200 with the long URL only on GET.
    const res2 = await fetch(url, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(6_000) })
    return res2.headers.get('location') ?? res2.url ?? null
  } catch (err) {
    intelError('whatsapp.short_link_failed', err, {})
    return null
  }
}

/**
 * Describe a coordinate: reverse geocode + which supported city it falls in.
 * Never throws. `city` is null when the point is outside every city we serve,
 * which the engine reports to the owner rather than storing.
 */
export async function describeCoords(lat, lng) {
  const cityHit = resolveCity(lat, lng)
  let geo = null
  try { geo = await reverseGeocode(lat, lng) } catch (err) { intelError('whatsapp.reverse_geocode_failed', err, {}) }
  return {
    lat, lng,
    city: cityHit?.city ?? null,
    locality: geo?.locality ?? null,
    address: geo?.formattedAddress ?? null,
    state: geo?.state ?? null,
    pincode: geo?.pincode && /^\d{6}$/.test(geo.pincode) ? geo.pincode : null,
    googleCity: geo?.city ?? null,
  }
}

/**
 * One entry point for every kind of location input.
 *
 * @param {{ kind: 'pin'|'link'|'text', lat?, lng?, text?, name?, address? }} input
 * @returns {Promise<{ status: 'candidate'|'imprecise'|'unresolved'|'outside_india'|'unsupported_city', candidate?: object, place?: string }>}
 */
export async function resolveLocationInput(input) {
  let coords
  let precision = 'exact'
  let source = input.kind

  let linkPlaceName = null

  if (input.kind === 'pin') {
    coords = { lat: Number(input.lat), lng: Number(input.lng) }
  } else if (input.kind === 'link') {
    coords = coordsFromMapsUrl(input.text)
    let expanded = null
    if (!coords) {
      const urlMatch = String(input.text).match(/https?:\/\/\S+/i)
      expanded = urlMatch ? await expandShortLink(urlMatch[0]) : null
      coords = expanded ? coordsFromMapsUrl(expanded) : null
    }
    if (!coords) coords = coordsFromText(input.text)
    if (!coords) {
      // No coordinates anywhere in the URL — the newer share format. The
      // place text in the path is the location, so it goes through the same
      // geocode-and-judge-the-viewport path a typed place does.
      const placeText = placeTextFromMapsUrl(expanded ?? input.text)
      if (!placeText) return { status: 'unresolved' }
      let hit = null
      try { hit = await geocode(placeText) } catch (err) { intelError('whatsapp.geocode_failed', err, {}) }
      if (!hit) return { status: 'unresolved' }
      coords = { lat: hit.lat, lng: hit.lng }
      const diag = hit.viewport ? viewportDiagonalM(hit.viewport) : Infinity
      precision = diag <= PRECISE_VIEWPORT_M ? 'approximate' : 'area'
      linkPlaceName = placeText
    }
  } else {
    coords = coordsFromText(input.text)
    if (!coords) {
      let hit = null
      try { hit = await geocode(input.text) } catch (err) { intelError('whatsapp.geocode_failed', err, {}) }
      if (!hit) return { status: 'unresolved' }
      coords = { lat: hit.lat, lng: hit.lng }
      const diag = hit.viewport ? viewportDiagonalM(hit.viewport) : Infinity
      precision = diag <= PRECISE_VIEWPORT_M ? 'approximate' : 'area'
      source = 'text'
    }
  }

  if (!isWithinIndia(coords.lat, coords.lng)) return { status: 'outside_india' }

  const described = await describeCoords(coords.lat, coords.lng)
  if (!described.city) return { status: 'unsupported_city', place: described.locality ?? described.googleCity ?? null }

  if (precision === 'area') {
    // A neighbourhood-level hit: tell the owner what we found and ask for a
    // pin. Its centroid is not a home.
    return { status: 'imprecise', place: described.locality ?? described.googleCity ?? input.text }
  }

  return {
    status: 'candidate',
    candidate: {
      ...described,
      precision,
      source,
      // The place name the owner typed, kept so "near Phoenix Mall" survives as
      // the landmark even after the pin is confirmed. A link's place text
      // serves the same way — it names what the owner actually shared.
      typedName: input.kind === 'text' ? String(input.text).slice(0, 200) : input.name ?? (linkPlaceName ? linkPlaceName.slice(0, 200) : null),
      confirmed: false,
    },
  }
}

function viewportDiagonalM(vp) {
  const dLat = (vp.neLat - vp.swLat) * 111_000
  const dLng = (vp.neLng - vp.swLng) * 111_000 * Math.cos(((vp.neLat + vp.swLat) / 2) * Math.PI / 180)
  return Math.sqrt(dLat * dLat + dLng * dLng)
}

/** Does Google think this pin is a building? Used only to word the confirm prompt. */
export function isRooftop(locationType) {
  return ROOFTOP_TYPES.has(locationType)
}
