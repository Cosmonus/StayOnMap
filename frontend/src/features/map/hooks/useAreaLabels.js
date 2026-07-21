import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useFilterStore } from '@store/filterStore'
import { useMapStore } from '@store/mapStore'
import { createHtmlMarker } from '@lib/googleMaps'
import { areasService } from '@services/areas.service'

const SHOW_ZOOM = 11   // labels appear at this zoom and above

function dominant(area) {
  if (area.floodRisk >= 7) return { dot: '#ef4444', title: 'Flood risk' }
  if (area.itScore   >= 8) return { dot: '#2563eb', title: 'IT hub'     }
  if (area.metroScore >= 8) return { dot: '#7c3aed', title: 'Metro connected' }
  if (area.safetyScore >= 9) return { dot: '#059669', title: 'Very safe' }
  return { dot: '#94a3b8', title: null }
}

function buildLabel(area) {
  const { dot } = dominant(area)
  const el = document.createElement('div')
  el.style.cssText = 'cursor:pointer;user-select:none;'
  el.innerHTML = `
    <div style="
      display:flex;align-items:center;gap:5px;
      background:white;border:1px solid #e2e8f0;
      border-radius:999px;padding:3px 10px 3px 7px;
      box-shadow:0 2px 8px rgba(0,0,0,0.12);
      font-family:'Plus Jakarta Sans',sans-serif;font-size:11px;font-weight:600;
      color:#1e293b;white-space:nowrap;
      transition:box-shadow 0.15s,transform 0.15s;
    ">
      <span style="width:7px;height:7px;border-radius:50%;background:${dot};flex-shrink:0;"></span>
      ${area.name}
    </div>
  `
  el.addEventListener('mouseenter', () => {
    el.querySelector('div').style.boxShadow = '0 4px 16px rgba(0,0,0,0.18)'
    el.querySelector('div').style.transform = 'scale(1.05)'
  })
  el.addEventListener('mouseleave', () => {
    el.querySelector('div').style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)'
    el.querySelector('div').style.transform = 'scale(1)'
  })
  return el
}

export function useAreaLabels(mapRef) {
  const city           = useFilterStore((s) => s.filters.city)
  const setSelectedArea = useMapStore((s) => s.setSelectedArea)
  const mapReady       = useMapStore((s) => s.flyTo !== null)

  const markersRef  = useRef([])
  const zoomListRef = useRef(null)
  const visibleRef  = useRef(false)

  const { data: areas } = useQuery({
    queryKey: ['areas', city],
    queryFn:  () => areasService.list(city).then((r) => r.data),
    enabled:  !!city,
    staleTime: Infinity,
  })

  // Show/hide based on current zoom
  function syncVisibility(map) {
    const zoom    = map.getZoom()
    const show    = zoom >= SHOW_ZOOM
    if (show === visibleRef.current) return
    visibleRef.current = show
    markersRef.current.forEach(({ marker }) => {
      marker.getElement().style.display = show ? 'block' : 'none'
    })
  }

  // Rebuild markers when areas or city change
  useEffect(() => {
    const map = mapRef.current
    if (!map || !areas?.length) return

    // Tear down old markers
    markersRef.current.forEach(({ marker }) => marker.remove())
    markersRef.current = []

    areas.forEach((area) => {
      const el     = buildLabel(area)
      const marker = createHtmlMarker({ element: el, lat: area.lat, lng: area.lng, map })
      el.addEventListener('click', () => setSelectedArea({ slug: area.slug }))
      marker.getElement().style.display = visibleRef.current ? 'block' : 'none'
      markersRef.current.push({ marker, area })
    })

    // Set initial visibility
    syncVisibility(map)

    return () => {
      markersRef.current.forEach(({ marker }) => marker.remove())
      markersRef.current = []
    }
  }, [areas, mapReady]) // eslint-disable-line react-hooks/exhaustive-deps

  // Zoom listener — attach once when map is ready
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    zoomListRef.current = window.google.maps.event.addListener(map, 'zoom_changed', () => {
      syncVisibility(map)
    })

    return () => {
      if (zoomListRef.current) {
        window.google.maps.event.removeListener(zoomListRef.current)
        zoomListRef.current = null
      }
    }
  }, [mapReady]) // eslint-disable-line react-hooks/exhaustive-deps
}
