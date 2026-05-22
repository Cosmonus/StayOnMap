import { useEffect, useRef } from 'react'
import { createHtmlMarker } from '@lib/googleMaps'
import { useMapStore } from '@store/mapStore'

const TYPE_SHORT = {
  APARTMENT:        'Apt',
  HOUSE:            'House',
  VILLA:            'Villa',
  PG:               'PG',
  INDEPENDENT_HOUSE:'Indep.',
  COMMERCIAL:       'Comm.',
}

function makePinEl(pin, selected) {
  const rent = `₹${(Number(pin.rent) / 1000).toFixed(0)}K`
  const type = TYPE_SHORT[pin.type] ?? ''
  const label = type ? `${rent} · ${type}` : rent

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
    transition: transform 150ms ease, background 150ms ease, color 150ms ease;
    transform-origin: center bottom;
    will-change: transform;
    user-select: none;
    ${selected
      ? 'background:#111111;color:#fff;border:2px solid #111111;box-shadow:0 4px 16px rgba(13,138,95,0.40);'
      : 'background:#fff;color:#1c1a16;border:2px solid #d6d2c8;'}
  `
  el.textContent = label

  el.addEventListener('mouseenter', () => { el.style.transform = 'translateZ(0) scale(1.08)' })
  el.addEventListener('mouseleave', () => { el.style.transform = 'translateZ(0) scale(1)' })
  return el
}

function applySelected(el, selected) {
  if (selected) {
    el.style.background  = '#111111'
    el.style.color       = '#fff'
    el.style.borderColor = '#111111'
    el.style.boxShadow   = '0 4px 16px rgba(13,138,95,0.40)'
  } else {
    el.style.background  = '#fff'
    el.style.color       = '#1c1a16'
    el.style.borderColor = '#d6d2c8'
    el.style.boxShadow   = '0 2px 8px rgba(0,0,0,0.18)'
  }
}

export function useMapPins(mapRef) {
  const markersRef     = useRef(new Map())
  const pins           = useMapStore((s) => s.pins)
  const selectedId     = useMapStore((s) => s.selectedPinId)
  const selectPin      = useMapStore((s) => s.selectPin)
  const clearSelection = useMapStore((s) => s.clearSelection)
  const mapReady       = useMapStore((s) => s.flyTo !== null)

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const incoming = new Set(pins.map((p) => p.id))

    for (const [id, marker] of markersRef.current) {
      if (!incoming.has(id)) {
        marker.remove()
        markersRef.current.delete(id)
      }
    }

    for (const pin of pins) {
      if (markersRef.current.has(pin.id)) continue

      const el = makePinEl(pin, pin.id === selectedId)

      el.addEventListener('click', () => {
        const { selectedPinId } = useMapStore.getState()
        if (selectedPinId === pin.id) clearSelection()
        else selectPin(pin.id, el.getBoundingClientRect())
      })

      const marker = createHtmlMarker({ element: el, lat: parseFloat(pin.lat), lng: parseFloat(pin.lng), map })
      markersRef.current.set(pin.id, marker)
    }
  }, [pins, mapRef, selectedId, selectPin, clearSelection, mapReady])

  useEffect(() => {
    for (const [id, marker] of markersRef.current) {
      applySelected(marker.getElement(), id === selectedId)
    }
  }, [selectedId])

  useEffect(() => {
    const markers = markersRef.current
    return () => {
      for (const marker of markers.values()) marker.remove()
      markers.clear()
    }
  }, [])
}
