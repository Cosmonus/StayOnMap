// Location resolution: three ways in, and the refusals that keep a guess off
// the map.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const geocode = vi.fn()
const reverseGeocode = vi.fn()
vi.mock('../src/features/places/places.service.js', () => ({
  geocode: (...a) => geocode(...a),
  reverseGeocode: (...a) => reverseGeocode(...a),
  autocomplete: vi.fn(),
}))

const { coordsFromMapsUrl, coordsFromText, looksLikeMapsLink, resolveLocationInput, placeTextFromMapsUrl } = await import('../src/features/whatsapp/location.service.js')

const BLR = { lat: 12.9352, lng: 77.6245 } // Koramangala
const geo = (over = {}) => ({ formattedAddress: '12, 5th Block, Koramangala, Bengaluru 560095', locality: 'Koramangala', city: 'Bengaluru', state: 'Karnataka', pincode: '560095', locationType: 'ROOFTOP', ...over })

beforeEach(() => {
  geocode.mockReset()
  reverseGeocode.mockReset().mockResolvedValue(geo())
})

describe('Google Maps links', () => {
  it('reads every URL shape Google emits', () => {
    expect(coordsFromMapsUrl('https://www.google.com/maps/place/Koramangala/@12.9352,77.6245,17z/data=!3m1')).toEqual(BLR)
    expect(coordsFromMapsUrl('https://maps.google.com/?q=12.9352,77.6245')).toEqual(BLR)
    expect(coordsFromMapsUrl('https://www.google.com/maps?ll=12.9352,77.6245&z=15')).toEqual(BLR)
    expect(coordsFromMapsUrl('https://www.google.com/maps/search/?api=1&query=12.9352%2C77.6245')).toEqual(BLR)
    expect(coordsFromMapsUrl('https://www.google.com/maps/place/x/data=!3d12.9352!4d77.6245')).toEqual(BLR)
    expect(coordsFromMapsUrl('https://www.google.com/maps/dir/?api=1&destination=12.9352,77.6245')).toEqual(BLR)
  })

  it('rejects coordinates outside India and non-map text', () => {
    expect(coordsFromMapsUrl('https://www.google.com/maps/@51.5,-0.12,15z')).toBeNull()
    expect(coordsFromMapsUrl('https://example.com/@12.9352,77.6245')).toEqual(BLR) // the parser reads any URL; the caller gates on looksLikeMapsLink
    expect(looksLikeMapsLink('https://example.com/@12.9352,77.6245')).toBe(false)
    expect(looksLikeMapsLink('here: https://maps.app.goo.gl/AbC123')).toBe(true)
    expect(coordsFromText('12.9352, 77.6245')).toEqual(BLR)
    expect(coordsFromText('Velachery')).toBeNull()
  })
})

describe('resolveLocationInput', () => {
  it('a WhatsApp pin becomes an exact candidate, described and city-resolved — never confirmed', async () => {
    const r = await resolveLocationInput({ kind: 'pin', lat: BLR.lat, lng: BLR.lng, name: 'Home' })
    expect(r.status).toBe('candidate')
    expect(r.candidate).toMatchObject({ lat: BLR.lat, lng: BLR.lng, city: 'Bengaluru', locality: 'Koramangala', pincode: '560095', precision: 'exact', source: 'pin', confirmed: false })
    expect(geocode).not.toHaveBeenCalled()
  })

  it('a maps link is parsed without any network call', async () => {
    const r = await resolveLocationInput({ kind: 'link', text: 'https://maps.google.com/?q=12.9352,77.6245' })
    expect(r.status).toBe('candidate')
    expect(r.candidate.source).toBe('link')
  })

  it('a pin outside India is refused', async () => {
    const r = await resolveLocationInput({ kind: 'pin', lat: 51.5, lng: -0.12 })
    expect(r.status).toBe('outside_india')
    expect(reverseGeocode).not.toHaveBeenCalled()
  })

  it('a pin in a city StayOnMap is not open in is refused by name', async () => {
    reverseGeocode.mockResolvedValue(geo({ locality: 'Lalbagh', city: 'Lucknow', pincode: '226001' }))
    const r = await resolveLocationInput({ kind: 'pin', lat: 26.8467, lng: 80.9462 })
    expect(r.status).toBe('unsupported_city')
    expect(r.place).toBe('Lalbagh')
  })

  it('a typed neighbourhood is IMPRECISE — the owner is asked for a pin, nothing is stored', async () => {
    geocode.mockResolvedValue({ lat: 12.98, lng: 80.22, viewport: { swLat: 12.96, swLng: 80.20, neLat: 13.00, neLng: 80.24 } })
    reverseGeocode.mockResolvedValue(geo({ locality: 'Velachery', city: 'Chennai' }))
    const r = await resolveLocationInput({ kind: 'text', text: 'Velachery' })
    expect(r.status).toBe('imprecise')
    expect(r.place).toBe('Velachery')
  })

  it('a typed building-level address is a candidate that still needs confirming', async () => {
    geocode.mockResolvedValue({ lat: 12.9352, lng: 77.6245, viewport: { swLat: 12.9345, swLng: 77.6238, neLat: 12.9359, neLng: 77.6252 } })
    const r = await resolveLocationInput({ kind: 'text', text: '12, 5th Block Koramangala' })
    expect(r.status).toBe('candidate')
    expect(r.candidate.precision).toBe('approximate')
    expect(r.candidate.confirmed).toBe(false)
    expect(r.candidate.typedName).toBe('12, 5th Block Koramangala')
  })

  it('a place Google cannot find is unresolved', async () => {
    geocode.mockResolvedValue(null)
    expect((await resolveLocationInput({ kind: 'text', text: 'xyzzy nowhere' })).status).toBe('unresolved')
  })

  it('reverse geocoding failing still yields a candidate — with the gaps null, not invented', async () => {
    reverseGeocode.mockRejectedValue(new Error('quota'))
    const r = await resolveLocationInput({ kind: 'pin', lat: BLR.lat, lng: BLR.lng })
    expect(r.status).toBe('candidate')
    expect(r.candidate.city).toBe('Bengaluru') // from our own city table
    expect(r.candidate.pincode).toBeNull()
    expect(r.candidate.address).toBeNull()
  })
})

// The 2026-09-01 share-link format: maps.app.goo.gl redirects to a /maps/place/
// URL that carries NO coordinates in any form — the place is TEXT in the path
// (a plus code + address). Found live: an owner's real link resolved to nothing.
describe('coordinate-less share links', () => {
  const PLACE_URL = 'https://www.google.com/maps/place/43FR%2B7JW+SRI+VARI+APPARTMENTS,+Periyar+Street,+Avadi,+Tamil+Nadu+600054/data=!4m2!3m1!1s0x3a52:0x1e58?utm_source=mstt_1'

  it('reads the place text out of the path — %2B stays a plus, + becomes a space', () => {
    expect(placeTextFromMapsUrl(PLACE_URL)).toBe('43FR+7JW SRI VARI APPARTMENTS, Periyar Street, Avadi, Tamil Nadu 600054')
    expect(placeTextFromMapsUrl('https://maps.app.goo.gl/AbC123')).toBeNull()
    expect(placeTextFromMapsUrl('https://www.google.com/maps/place/12.93,77.62/@12.93,77.62,17z')).toBeNull()
  })

  it('a short link expanding to a place-text URL geocodes the text and becomes a candidate', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ headers: new Headers({ location: PLACE_URL }), url: '' }))
    geocode.mockResolvedValue({ lat: 13.115, lng: 80.099, viewport: { swLat: 13.1145, swLng: 80.0985, neLat: 13.1155, neLng: 80.0995 } })
    reverseGeocode.mockResolvedValue(geo({ locality: 'Avadi', city: 'Chennai', pincode: '600054' }))
    const r = await resolveLocationInput({ kind: 'link', text: 'https://maps.app.goo.gl/fmC2toJ2qxB4K2tj6?g_st=ac' })
    vi.unstubAllGlobals()
    expect(geocode).toHaveBeenCalledWith(expect.stringContaining('SRI VARI APPARTMENTS'))
    expect(r.status).toBe('candidate')
    expect(r.candidate.precision).toBe('approximate')
    expect(r.candidate.typedName).toContain('SRI VARI')
  })

  it('a short link whose place text geocodes to an AREA is refused, not published', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ headers: new Headers({ location: 'https://www.google.com/maps/place/Velachery,+Chennai' }), url: '' }))
    geocode.mockResolvedValue({ lat: 12.98, lng: 80.22, viewport: { swLat: 12.96, swLng: 80.20, neLat: 13.00, neLng: 80.24 } })
    reverseGeocode.mockResolvedValue(geo({ locality: 'Velachery', city: 'Chennai' }))
    const r = await resolveLocationInput({ kind: 'link', text: 'https://maps.app.goo.gl/short' })
    vi.unstubAllGlobals()
    expect(r.status).toBe('imprecise')
  })
})
