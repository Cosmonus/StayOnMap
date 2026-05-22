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
