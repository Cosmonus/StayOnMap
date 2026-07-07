// Renders property pins and cluster bubbles on the Google Map.
// Zoomed out → nearby pins merge into "N flats" bubbles.
// Zoomed in  → bubbles split back into individual price pills.

import { useEffect, useRef } from 'react'
import { createHtmlMarker } from '@lib/googleMaps'
import { useMapStore } from '@store/mapStore'
import { computeClusters, getExpansionZoom } from '../utils/clustering'

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
const DEFAULT_TYPE_COLOR = '#d6d2c8'

function typeColor(pin) {
  return TYPE_COLORS[pin.type] ?? DEFAULT_TYPE_COLOR
}

// ── Individual pin (white pill with rent label) ───────────────────
function makePinEl(pin, selected) {
  const rent  = `₹${(Number(pin.rent) / 1000).toFixed(0)}K`
  const bhk   = bhkShort(pin)
  const label = bhk ? `${rent} · ${bhk}` : rent
  const color = typeColor(pin)

  const el = document.createElement('div')
  el.setAttribute('aria-label', `Property at ${rent}/mo`)
  el.style.cssText = `
    display: inline-flex;
    align-items: center;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    font-family: Inter, sans-serif;
    white-space: nowrap;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.18);
    transition: transform 150ms ease;
    transform-origin: center bottom;
    will-change: transform;
    user-select: none;
    ${selected
      ? `background:${color};color:#fff;border:2px solid ${color};`
      : `background:#fff;color:#1c1a16;border:2px solid ${color};`}
  `
  el.textContent = label
  el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.08)' })
  el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)' })
  return el
}

function applySelected(el, selected, pin) {
  const color = typeColor(pin)
  el.style.background  = selected ? color : '#fff'
  el.style.color       = selected ? '#fff' : '#1c1a16'
  el.style.borderColor = color
}

// ── Cluster bubble (brand-blue pill with count) ───────────────────
function makeClusterEl(count) {
  const label = `${count} flat${count !== 1 ? 's' : ''}`
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
    font-family: Inter, sans-serif;
    white-space: nowrap;
    cursor: pointer;
    background: #0284c7;
    color: #fff;
    border: 2px solid #fff;
    box-shadow: 0 2px 12px rgba(2,132,199,0.35);
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
  const hoveredId   = useMapStore((s) => s.hoveredPinId)
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

    const { selectedPinId: currentSelectedId, hoveredPinId: currentHoveredId } = useMapStore.getState()
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

          const selected = pinId === currentSelectedId || pinId === currentHoveredId
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

  // Update selected/hovered styling without re-creating markers
  useEffect(() => {
    for (const [id, marker] of pinMarkersRef.current) {
      const pin = pins.find((p) => p.id === id)
      if (pin) applySelected(marker.getElement(), id === selectedId || id === hoveredId, pin)
    }
  }, [selectedId, hoveredId, pins])

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
