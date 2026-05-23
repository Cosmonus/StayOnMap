import { useEffect, useRef } from 'react'
import { useMapStore } from '@store/mapStore'
import { useFilterStore } from '@store/filterStore'
import metroData from '@/data/layers/metro-lines.json'
import itData    from '@/data/layers/it-corridors.json'

const METRO_LINE_COLORS = { 1: '#7c3aed', 2: '#059669', 3: '#ca8a04' }

// Prefer per-feature color from GeoJSON; fall back to line-number palette
function metroColor(feature) {
  return feature.getProperty('color') ?? METRO_LINE_COLORS[feature.getProperty('line')] ?? '#7c3aed'
}

// Catmull-Rom spline — interpolating: curve passes through every original point
function catmullRomPoint(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t
  return [
    0.5 * (2*p1[0] + (-p0[0]+p2[0])*t + (2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2 + (-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3),
    0.5 * (2*p1[1] + (-p0[1]+p2[1])*t + (2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2 + (-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3),
  ]
}

function catmullRom(coords, segments = 8) {
  if (coords.length < 2) return coords
  const pts = [coords[0], ...coords, coords[coords.length - 1]]
  const result = []
  for (let i = 1; i < pts.length - 2; i++) {
    result.push(pts[i])
    for (let t = 1; t < segments; t++) {
      result.push(catmullRomPoint(pts[i-1], pts[i], pts[i+1], pts[i+2], t / segments))
    }
  }
  result.push(pts[pts.length - 2])
  return result
}

function smoothLineStrings(geojson) {
  return {
    ...geojson,
    features: geojson.features.map((f) => {
      if (f.geometry.type !== 'LineString') return f
      return { ...f, geometry: { ...f.geometry, coordinates: catmullRom(f.geometry.coordinates) } }
    }),
  }
}

function styleMetroFeature(feature) {
  const type  = feature.getGeometry().getType()
  const color = metroColor(feature)
  if (type === 'Point') {
    const isInterchange = feature.getProperty('type') === 'interchange'
    return {
      icon: {
        path: window.google.maps.SymbolPath.CIRCLE,
        scale: isInterchange ? 7 : 5,
        fillColor: '#ffffff',
        fillOpacity: 1,
        strokeColor: color,
        strokeWeight: isInterchange ? 2.5 : 2,
      },
    }
  }
  return {
    strokeColor: color,
    strokeWeight: 3.5,
    strokeOpacity: 0.9,
  }
}

function styleItFeature(feature, hovered = false) {
  return {
    strokeColor: '#2563eb',
    strokeWeight: hovered ? 2.5 : 1.5,
    strokeOpacity: 0.8,
    fillColor: '#3b82f6',
    fillOpacity: hovered ? 0.18 : 0.08,
    cursor: 'pointer',
  }
}

// ─── Tooltip DOM helper ───────────────────────────────────────────
function createTooltip() {
  const el = document.createElement('div')
  el.style.cssText = [
    'position:fixed',
    'pointer-events:none',
    'z-index:9999',
    'display:none',
    'max-width:220px',
    'background:white',
    'border:1px solid #e2e8f0',
    'border-radius:10px',
    'padding:8px 12px',
    'box-shadow:0 4px 16px rgba(0,0,0,0.14)',
    'font-family:Inter,sans-serif',
    'font-size:12px',
    'line-height:1.5',
    'color:#1e293b',
  ].join(';')
  document.body.appendChild(el)
  return el
}

function showTooltip(el, x, y, html) {
  el.innerHTML  = html
  el.style.display = 'block'
  positionTooltip(el, x, y)
}

function positionTooltip(el, x, y) {
  const { innerWidth, innerHeight } = window
  const tw = el.offsetWidth  || 220
  const th = el.offsetHeight || 60
  const left = x + 14 + tw > innerWidth  ? x - tw - 14 : x + 14
  const top  = y - 10 + th > innerHeight ? y - th - 10 : y - 10
  el.style.left = `${left}px`
  el.style.top  = `${top}px`
}

function tooltipHtml(feature) {
  const name  = feature.getProperty('name')
  const level = feature.getProperty('level') === 'major' ? 'Major IT zone' : 'IT zone'
  return `
    <div style="font-weight:700;margin-bottom:2px">${name}</div>
    <div style="display:flex;align-items:center;gap:5px">
      <span style="width:7px;height:7px;border-radius:50%;background:#2563eb;flex-shrink:0"></span>
      <span style="color:#2563eb;font-weight:600">${level}</span>
    </div>
    <div style="color:#94a3b8;font-size:10px;margin-top:4px">Click for full area profile</div>
  `
}

function filterByCity(geojson, city) {
  if (!city) return geojson
  return {
    ...geojson,
    features: geojson.features.filter((f) => f.properties.city === city),
  }
}

function reloadMetro(dataLayer, city) {
  dataLayer.forEach((f) => dataLayer.remove(f))
  dataLayer.addGeoJson(smoothLineStrings(filterByCity(metroData, city)))
  dataLayer.setStyle(styleMetroFeature)
}

// ─── Hook ────────────────────────────────────────────────────────
export function useMapLayers(mapRef) {
  const activeLayers    = useMapStore((s) => s.activeLayers)
  const setSelectedArea = useMapStore((s) => s.setSelectedArea)
  const mapReady        = useMapStore((s) => s.flyTo !== null)
  const city            = useFilterStore((s) => s.filters.city)

  const layers     = useRef({ metro: null, itCorridors: null, traffic: null })
  const tooltipEl  = useRef(null)
  const mouseMoveRef = useRef(null)

  // Create tooltip DOM element once
  useEffect(() => {
    tooltipEl.current = createTooltip()
    return () => {
      tooltipEl.current?.remove()
      tooltipEl.current = null
    }
  }, [])

  // Init Data layers once map is ready
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    layers.current.metro       = new window.google.maps.Data()
    layers.current.itCorridors = new window.google.maps.Data()
    layers.current.traffic     = new window.google.maps.TrafficLayer()

    const initCity = useFilterStore.getState().filters.city
    layers.current.metro.addGeoJson(smoothLineStrings(filterByCity(metroData, initCity)))
    layers.current.itCorridors.addGeoJson(filterByCity(itData, initCity))

    layers.current.metro.setStyle(styleMetroFeature)
    layers.current.itCorridors.setStyle((f) => styleItFeature(f))

    // ── Click → open area insight card ──
    const handleClick = (event) => {
      const slug = event.feature.getProperty('areaSlug')
      if (slug) setSelectedArea({ slug })
    }
    layers.current.itCorridors.addListener('click', handleClick)

    // ── Hover → tooltip + fill brightening ──
    const mapDiv = map.getDiv()

    function onItMouseOver(event) {
      const tt = tooltipEl.current
      if (!tt) return
      const feature = event.feature
      layers.current.itCorridors.overrideStyle(feature, styleItFeature(feature, true))
      const move = (e) => positionTooltip(tt, e.clientX, e.clientY)
      mapDiv.addEventListener('mousemove', move)
      mouseMoveRef.current = move
      const domEvent = event.domEvent
      showTooltip(tt, domEvent.clientX, domEvent.clientY, tooltipHtml(feature))
    }

    function onItMouseOut(event) {
      if (tooltipEl.current) tooltipEl.current.style.display = 'none'
      if (mouseMoveRef.current) {
        mapDiv.removeEventListener('mousemove', mouseMoveRef.current)
        mouseMoveRef.current = null
      }
      layers.current.itCorridors.revertStyle(event.feature)
    }

    layers.current.itCorridors.addListener('mouseover', onItMouseOver)
    layers.current.itCorridors.addListener('mouseout',  onItMouseOut)

    const currentLayers = layers.current
    return () => {
      Object.values(currentLayers).forEach((l) => {
        if (l && l.setMap) l.setMap(null)
      })
      if (mouseMoveRef.current) {
        mapDiv.removeEventListener('mousemove', mouseMoveRef.current)
        mouseMoveRef.current = null
      }
    }
  }, [mapReady]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reload all city-scoped layers when city changes
  useEffect(() => {
    const { metro, itCorridors, floodZones } = layers.current
    if (!metro) return

    reloadMetro(metro, city)

    if (itCorridors) {
      itCorridors.forEach((f) => itCorridors.remove(f))
      itCorridors.addGeoJson(filterByCity(itData, city))
    }
  }, [city]) // eslint-disable-line react-hooks/exhaustive-deps

  // Toggle each layer on/off
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const { metro, itCorridors, traffic } = layers.current
    if (metro)       metro.setMap(activeLayers.metro        ? map : null)
    if (itCorridors) itCorridors.setMap(activeLayers.itCorridors ? map : null)
    if (traffic)     traffic.setMap(activeLayers.traffic    ? map : null)
  }, [activeLayers, mapReady]) // eslint-disable-line react-hooks/exhaustive-deps
}
