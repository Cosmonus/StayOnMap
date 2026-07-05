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

  // Re-render all markers whenever pins, zoom, or bounds change
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    // Clear all existing markers
    for (const m of pinMarkersRef.current.values())     m.remove()
    for (const m of clusterMarkersRef.current.values()) m.remove()
    pinMarkersRef.current.clear()
    clusterMarkersRef.current.clear()

    if (!pins.length) return

    const { selectedPinId: currentSelectedId, hoveredPinId: currentHoveredId } = useMapStore.getState()
    const items = computeClusters(pins, bounds, zoom)

    for (const item of items) {
      const [lng, lat] = item.geometry.coordinates

      if (item.properties.cluster) {
        // ── Cluster bubble ──
        const count     = item.properties.point_count
        const clusterId = item.id
        const el        = makeClusterEl(count)
        const marker    = createHtmlMarker({ element: el, lat, lng, map })

        el.addEventListener('click', () => {
          const expZoom = Math.min(getExpansionZoom(clusterId), 16)
          useMapStore.getState().flyTo({ center: [lng, lat], zoom: expZoom })
        })

        clusterMarkersRef.current.set(clusterId, marker)
      } else {
        // ── Individual pin ──
        const pinId = item.properties.id
        const pin   = pins.find((p) => p.id === pinId)
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
