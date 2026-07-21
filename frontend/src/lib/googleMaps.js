const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY

// Starts loading at module import time — shared across all consumers
export const googleMapsReady = (() => {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.google?.maps?.places) return Promise.resolve()
  if (document.getElementById('gmap-script')) {
    return new Promise((res) => {
      const t = setInterval(() => {
        if (window.google?.maps?.places) { clearInterval(t); res() }
      }, 80)
    })
  }
  return new Promise((res, rej) => {
    const s = document.createElement('script')
    s.id      = 'gmap-script'
    s.src     = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_KEY}&libraries=places`
    s.async   = true
    s.onload  = res
    s.onerror = rej
    document.head.appendChild(s)
  })
})()

// Lazy OverlayView class — instantiated only after google.maps is available
let _HtmlMarkerClass = null

function getHtmlMarkerClass() {
  if (_HtmlMarkerClass) return _HtmlMarkerClass
  _HtmlMarkerClass = class HtmlMarker extends window.google.maps.OverlayView {
    constructor({ element, lat, lng }) {
      super()
      this._el  = element
      this._lat = lat
      this._lng = lng
      Object.assign(this._el.style, { position: 'absolute' })
    }
    onAdd() {
      this.getPanes().overlayMouseTarget.appendChild(this._el)
    }
    draw() {
      const proj = this.getProjection()
      if (!proj) return
      const pt = proj.fromLatLngToDivPixel(
        new window.google.maps.LatLng(this._lat, this._lng)
      )
      if (!pt) return
      const w = this._el.offsetWidth  || 0
      const h = this._el.offsetHeight || 0
      this._el.style.left = `${pt.x - w / 2}px`
      this._el.style.top  = `${pt.y - h}px`
    }
    onRemove() {
      this._el.parentNode?.removeChild(this._el)
    }
    getElement() { return this._el }
    remove()     { this.setMap(null) }
  }
  return _HtmlMarkerClass
}

export function createHtmlMarker({ element, lat, lng, map }) {
  const HtmlMarker = getHtmlMarkerClass()
  const marker = new HtmlMarker({ element, lat, lng })
  if (map) marker.setMap(map)
  return marker
}

// Resolve free-typed text ("avadi") to { name, lat, lng }.
// Tries the Places API first (Autocomplete prediction → Place Details) —
// the same pipeline suggestion clicks use, so it works wherever they do.
// google.maps.Geocoder is only a fallback: Geocoding is a separately-enabled
// Google product, and relying on it alone made search silently do nothing
// when the browser key lacked it (same trap .claude/maps.md documents for
// mobile). Returns null when nothing matches.
export async function resolvePlace(query, city) {
  await googleMapsReady
  const g = window.google.maps
  const input = city ? `${query}, ${city}, India` : `${query}, India`

  const prediction = await new Promise((resolve) => {
    new g.places.AutocompleteService().getPlacePredictions(
      { input, componentRestrictions: { country: 'in' } },
      (preds, status) => resolve(status === 'OK' ? preds?.[0] ?? null : null)
    )
  })
  if (prediction?.place_id) {
    const geometry = await new Promise((resolve) => {
      new g.places.PlacesService(document.createElement('div')).getDetails(
        { placeId: prediction.place_id, fields: ['geometry'] },
        (place, status) => resolve(status === 'OK' ? place?.geometry ?? null : null)
      )
    })
    if (geometry?.location) {
      const name = prediction.structured_formatting?.main_text || query
      // viewport is the place's own extent — a city query carries the whole
      // city, a neighbourhood its few km. Callers filtering by place should
      // prefer it over inventing a radius around the point.
      return { name, lat: geometry.location.lat(), lng: geometry.location.lng(), viewport: viewportOf(geometry) }
    }
  }

  const result = await new Promise((resolve) => {
    new g.Geocoder().geocode({ address: input, region: 'in' }, (results, status) =>
      resolve(status === 'OK' ? results?.[0] ?? null : null)
    )
  })
  if (!result) return null
  const loc = result.geometry.location
  return {
    name: result.address_components?.[0]?.long_name || query,
    lat: loc.lat(),
    lng: loc.lng(),
    viewport: viewportOf(result.geometry),
  }
}

// LatLngBounds → the flat sw/ne shape the backend's bounds params use.
// Null when the geometry has no viewport (rare — a bare rooftop point).
export function viewportOf(geometry) {
  const vp = geometry?.viewport
  if (!vp) return null
  const sw = vp.getSouthWest()
  const ne = vp.getNorthEast()
  return { swLat: sw.lat(), swLng: sw.lng(), neLat: ne.lat(), neLng: ne.lng() }
}
