// Renders property pins and cluster bubbles on the Google Map.
// Zoomed out → nearby pins merge into "N homes" bubbles.
// Zoomed in  → bubbles split back into individual price pills.

import { useEffect, useRef } from 'react'
import { createHtmlMarker } from '@lib/googleMaps'
import { useMapStore } from '@store/mapStore'
import { computeClusters, getExpansionZoom } from '../utils/clustering'
import { formatCompact, priceUnit } from '@utils/format'

// BHK is the more useful at-a-glance signal for renters scanning the map —
// shown instead of the property type (Apt/House/Villa etc.)
function bhkShort(pin) {
  if (pin.type === 'PG') return pin.sharing ? `${pin.sharing}-Sharing` : 'PG'
  if (pin.bhk === 0) return 'Studio'
  if (pin.bhk) return `${pin.bhk} BHK`
  return ''
}

// One color per wizard category (HOUSE/VILLA/INDEPENDENT_HOUSE share the
// "house" color since they're one category in the listing wizard, see
// config/onboarding.js's CATEGORIES) — the pin border/selected-fill is the
// only place on the map itself that shows which of the 6 types a pin is.
const TYPE_COLORS = {
  APARTMENT: '#0284C7',
  HOUSE: '#16A34A',
  VILLA: '#16A34A',
  INDEPENDENT_HOUSE: '#16A34A',
  LAND: '#B45309',
  PG: '#7C3AED',
  COMMERCIAL: '#EA580C',
  SHORT_STAY: '#DB2777',
}
const DEFAULT_TYPE_COLOR = '#475569'

function typeColor(pin) {
  return TYPE_COLORS[pin.type] ?? DEFAULT_TYPE_COLOR
}

// Darken a #rrggbb color — the selected pin keeps its type color but drops
// to a deeper shade so selection reads without losing type identity.
function darken(hex, factor = 0.72) {
  const n = parseInt(hex.slice(1), 16)
  const ch = (shift) => Math.round(((n >> shift) & 255) * factor)
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`
}

function tintShadow(hex, alpha) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

// Exact lucide geometry (Building2 / House / LandPlot / BedDouble / Store /
// Luggage), inlined as SVG strings because pins are plain DOM, not React.
// One icon per wizard category — HOUSE/VILLA/INDEPENDENT_HOUSE share House,
// mirroring how they share a color above.
const HOUSE_PATHS = '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'
const TYPE_ICON_PATHS = {
  APARTMENT: '<path d="M10 12h4"/><path d="M10 8h4"/><path d="M14 21v-3a2 2 0 0 0-4 0v3"/><path d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2"/><path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/>',
  HOUSE: HOUSE_PATHS,
  VILLA: HOUSE_PATHS,
  INDEPENDENT_HOUSE: HOUSE_PATHS,
  LAND: '<path d="m12 8 6-3-6-3v10"/><path d="m8 11.99-5.5 3.14a1 1 0 0 0 0 1.74l8.5 4.86a2 2 0 0 0 2 0l8.5-4.86a1 1 0 0 0 0-1.74L16 12"/><path d="m6.49 12.85 11.02 6.3"/><path d="M17.51 12.85 6.5 19.15"/>',
  PG: '<path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><path d="M12 4v6"/><path d="M2 18h20"/>',
  COMMERCIAL: '<path d="M15 21v-5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v5"/><path d="M17.774 10.31a1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.451 0 1.12 1.12 0 0 0-1.548 0 2.5 2.5 0 0 1-3.452 0 1.12 1.12 0 0 0-1.549 0 2.5 2.5 0 0 1-3.77-3.248l2.889-4.184A2 2 0 0 1 7 2h10a2 2 0 0 1 1.653.873l2.895 4.192a2.5 2.5 0 0 1-3.774 3.244"/><path d="M4 10.95V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8.05"/>',
  SHORT_STAY: '<path d="M6 20a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2"/><path d="M8 18V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v14"/><path d="M10 20h4"/><circle cx="16" cy="20" r="2"/><circle cx="8" cy="20" r="2"/>',
}

function typeIconHtml(pin) {
  const paths = TYPE_ICON_PATHS[pin.type]
  if (!paths) return ''
  return `<span data-type-icon style="display:inline-flex;margin-right:5px;color:#fff">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>
  </span>`
}

// ── Individual pin (color-filled pill, white label) ───────────────
// Borderless fill IS the type color; selection deepens the shade and adds
// a colored glow ring.
function pinStateStyles(color, selected) {
  return selected
    ? `background:${darken(color)};box-shadow:0 0 0 3px ${tintShadow(color, 0.35)}, 0 4px 14px ${tintShadow(color, 0.5)};`
    : `background:${color};box-shadow:0 2px 8px ${tintShadow(color, 0.45)};`
}

function makePinEl(pin, selected) {
  // Through formatCompact/priceUnit, not a hand-rolled ÷1000: a sale pin has to
  // read "₹4.5Cr", never "₹45000K/mo".
  const price = formatCompact(Number(pin.rent))
  const unit  = priceUnit(pin)
  const bhk   = bhkShort(pin)
  const label = bhk ? `${price} · ${bhk}` : price
  const color = typeColor(pin)

  const el = document.createElement('div')
  el.setAttribute('aria-label', `Property at ${price}${unit}`)
  el.style.cssText = `
    display: inline-flex;
    align-items: center;
    padding: 6px 12px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    font-family: 'Plus Jakarta Sans', sans-serif;
    white-space: nowrap;
    cursor: pointer;
    color: #fff;
    text-shadow: 0 1px 2px rgba(0,0,0,0.15);
    transition: transform 150ms ease, background 150ms ease, box-shadow 150ms ease;
    transform-origin: center bottom;
    will-change: transform;
    user-select: none;
    ${pinStateStyles(color, selected)}
  `
  const labelSpan = document.createElement('span')
  labelSpan.textContent = label
  el.innerHTML = typeIconHtml(pin)
  el.appendChild(labelSpan)
  el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.08)' })
  el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)' })
  return el
}

function applySelected(el, selected, pin) {
  el.style.cssText += pinStateStyles(typeColor(pin), selected)
}

// ── Cluster bubble (brand-blue pill with count) ───────────────────
function makeClusterEl(count) {
  // "homes", not "flats" — the map carries plots, PGs, shops and short stays
  // too, and calling a cluster of them flats is simply wrong.
  const label = `${count} home${count !== 1 ? 's' : ''}`
  const el = document.createElement('div')
  el.setAttribute('aria-label', `${count} properties`)
  el.style.cssText = `
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 5px 12px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 700;
    font-family: 'Plus Jakarta Sans', sans-serif;
    white-space: nowrap;
    cursor: pointer;
    background: #0d8a5f;
    color: #fff;
    border: 2px solid #fff;
    box-shadow: 0 2px 12px rgba(13,138,95,0.35);
    transition: transform 150ms ease;
    transform-origin: center bottom;
    will-change: transform;
    user-select: none;
  `
  el.textContent = label
  el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.1)' })
  el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)' })
  return el
}

// ─────────────────────────────────────────────────────────────────
export function useMapPins(mapRef) {
  const pinMarkersRef     = useRef(new Map())  // id → marker
  const clusterMarkersRef = useRef(new Map())  // cluster_id → marker

  const pins        = useMapStore((s) => s.pins)
  const zoom        = useMapStore((s) => s.zoom)
  const bounds      = useMapStore((s) => s.bounds)
  const selectedId  = useMapStore((s) => s.selectedPinId)
  const selectPin   = useMapStore((s) => s.selectPin)
  const clearSelection = useMapStore((s) => s.clearSelection)
  const mapReady    = useMapStore((s) => s.flyTo !== null)

  // Reconcile markers whenever pins, zoom, or bounds change.
  // Diff against what's already on the map — add new, remove stale, and leave
  // unchanged markers untouched. Never clear-and-redraw: rebuilding every
  // marker on each pan/zoom is what causes visible flicker and CPU churn.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    const { selectedPinId: currentSelectedId } = useMapStore.getState()
    const items = pins.length ? computeClusters(pins, bounds, zoom) : []

    // Keys we want on the map after this pass.
    const desiredPinIds     = new Set()
    const desiredClusterKeys = new Set()

    for (const item of items) {
      const [lng, lat] = item.geometry.coordinates

      if (item.properties.cluster) {
        // ── Cluster bubble ──
        // Supercluster reuses numeric cluster ids across viewports, so key on
        // id + count + rounded position: any change yields a new key, so a
        // moved/resized cluster is naturally replaced while a static one is reused.
        const count     = item.properties.point_count
        const clusterId = item.id
        const key       = `${clusterId}:${count}:${lat.toFixed(5)}:${lng.toFixed(5)}`
        desiredClusterKeys.add(key)

        if (!clusterMarkersRef.current.has(key)) {
          const el     = makeClusterEl(count)
          const marker = createHtmlMarker({ element: el, lat, lng, map })
          el.addEventListener('click', () => {
            const expZoom = Math.min(getExpansionZoom(clusterId), 16)
            useMapStore.getState().flyTo({ center: [lng, lat], zoom: expZoom })
          })
          clusterMarkersRef.current.set(key, marker)
        }
      } else {
        // ── Individual pin ── (position is stable, so key on id alone)
        const pinId = item.properties.id
        desiredPinIds.add(pinId)

        if (!pinMarkersRef.current.has(pinId)) {
          const pin = pins.find((p) => p.id === pinId)
          if (!pin) continue

          const selected = pinId === currentSelectedId
          const el       = makePinEl(pin, selected)
          const marker   = createHtmlMarker({
            element: el,
            lat: parseFloat(pin.lat),
            lng: parseFloat(pin.lng),
            map,
          })

          el.addEventListener('click', () => {
            const { selectedPinId } = useMapStore.getState()
            if (selectedPinId === pinId) clearSelection()
            else selectPin(pinId, el.getBoundingClientRect())
          })

          pinMarkersRef.current.set(pinId, marker)
        }
      }
    }

    // Remove markers no longer wanted.
    for (const [id, marker] of pinMarkersRef.current) {
      if (!desiredPinIds.has(id)) {
        marker.remove()
        pinMarkersRef.current.delete(id)
      }
    }
    for (const [key, marker] of clusterMarkersRef.current) {
      if (!desiredClusterKeys.has(key)) {
        marker.remove()
        clusterMarkersRef.current.delete(key)
      }
    }
  }, [pins, zoom, bounds, mapReady, mapRef, selectPin, clearSelection])

  // Update selected styling without re-creating markers
  useEffect(() => {
    for (const [id, marker] of pinMarkersRef.current) {
      const pin = pins.find((p) => p.id === id)
      if (pin) applySelected(marker.getElement(), id === selectedId, pin)
    }
  }, [selectedId, pins])

  // Cleanup on unmount
  useEffect(() => {
    const pins     = pinMarkersRef.current
    const clusters = clusterMarkersRef.current
    return () => {
      for (const m of pins.values())     m.remove()
      for (const m of clusters.values()) m.remove()
      pins.clear()
      clusters.clear()
    }
  }, [])
}
