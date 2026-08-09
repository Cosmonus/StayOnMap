import { useEffect, useRef } from 'react'
import { useMapStore } from '@store/mapStore'
import { useFilterStore } from '@store/filterStore'
import itData from '@/data/layers/it-corridors.json'

// metro-lines.json is ~1.1MB of GeoJSON and the metro layer is OFF by default
// (MapControls toggle) — a static import put all of it in the MAIN bundle,
// paid by every visitor on first paint. Loaded on demand instead, cached
// module-level so toggling the layer off/on never re-fetches.
let metroDataCache = null
async function getMetroData() {
  if (!metroDataCache) {
    const mod = await import('@/data/layers/metro-lines.json')
    metroDataCache = mod.default
  }
  return metroDataCache
}

const METRO_LINE_COLORS = { 1: '#7c3aed', 2: '#059669', 3: '#ca8a04' }
const IT_CORRIDOR_COLORS = { major: '#2563eb', moderate: '#60a5fa' }

// Station dots appear at street zoom and not before. There are 741 of them
// nationwide (314 in Delhi alone) and they are unreadable clutter above a
// neighbourhood — mobile's MetroLines.js has drawn the same line at the same
// number since 2026-07-05. Below this they are not styled invisible, they are
// not on the map at all: see the two-layer split in the hook.
const STATION_ZOOM = 13

// Prefer per-feature color from GeoJSON; fall back to line-number palette
function metroColor(feature) {
  return feature.getProperty('color') ?? METRO_LINE_COLORS[feature.getProperty('line')] ?? '#7c3aed'
}

/**
 * Split the network into the two things that behave differently on a map.
 *
 * Lines are cheap, always relevant, and stay on whenever the layer is on.
 * Stations are 94% of the features and only mean anything close up. Two
 * `google.maps.Data` layers rather than one, so the expensive half can be
 * detached with `setMap(null)` — a guaranteed end to its render cost, where
 * `visible: false` only asks Google not to draw something it is still tracking,
 * and would re-run a style callback per feature on every zoom step.
 */
export function splitMetroFeatures(geojson) {
  const lines = [], stations = []
  for (const f of geojson.features) (f.geometry.type === 'Point' ? stations : lines).push(f)
  return {
    lines:    { ...geojson, features: lines },
    stations: { ...geojson, features: stations },
  }
}

/** Are station dots warranted at this zoom, given the layer is on at all? */
export const stationsVisibleAt = (zoom) => typeof zoom === 'number' && zoom >= STATION_ZOOM

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

// IT corridors render as real-radius circles (google.maps.Circle), not a
// Data layer — a Data layer's Point icon is a fixed pixel size that doesn't
// scale with zoom the way a real geographic radius (metres) should.
function itCorridorCircleOptions(properties, hovered = false) {
  const color = IT_CORRIDOR_COLORS[properties.level] ?? IT_CORRIDOR_COLORS.moderate
  return {
    strokeColor: color,
    strokeWeight: hovered ? 2.5 : 1.5,
    strokeOpacity: 0.8,
    fillColor: color,
    fillOpacity: hovered ? 0.18 : 0.08,
    clickable: true,
  }
}

function tooltipHtml({ name, level }) {
  const label = level === 'major' ? 'Major IT zone' : 'IT zone'
  const color = IT_CORRIDOR_COLORS[level] ?? IT_CORRIDOR_COLORS.moderate
  return `
    <div style="font-weight:700;margin-bottom:2px">${name}</div>
    <div style="display:flex;align-items:center;gap:5px">
      <span style="width:7px;height:7px;border-radius:50%;background:${color};flex-shrink:0"></span>
      <span style="color:${color};font-weight:600">${label}</span>
    </div>
    <div style="color:#94a3b8;font-size:10px;margin-top:4px">Click for full area profile</div>
  `
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
    "font-family:'Plus Jakarta Sans',sans-serif",
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

function filterByCity(geojson, city) {
  if (!city) return geojson
  return {
    ...geojson,
    features: geojson.features.filter((f) => f.properties.city === city),
  }
}

// ─── Hook ────────────────────────────────────────────────────────
export function useMapLayers(mapRef) {
  const activeLayers    = useMapStore((s) => s.activeLayers)
  const setSelectedArea = useMapStore((s) => s.setSelectedArea)
  const mapReady        = useMapStore((s) => s.flyTo !== null)
  const city             = useFilterStore((s) => s.filters.city)

  const layers     = useRef({ metroLines: null, metroStations: null, itCorridorCircles: [], traffic: null })
  const tooltipEl  = useRef(null)
  const mouseMoveRef = useRef(null)
  // Tracks what the metro Data layers currently hold; `seq` guards against a
  // stale async load landing after a newer city/toggle change superseded it.
  const metroState = useRef({ loaded: false, city: undefined, seq: 0 })

  async function syncMetro(nextCity) {
    const { metroLines, metroStations } = layers.current
    if (!metroLines || !metroStations) return
    if (metroState.current.loaded && metroState.current.city === nextCity) return
    const seq = ++metroState.current.seq
    const data = await getMetroData()
    if (seq !== metroState.current.seq || !layers.current.metroLines) return

    // The geometry goes in AS FETCHED. It used to be resampled through a
    // Catmull-Rom spline at 8 segments per span, which turned 11,612 vertices
    // into ~92,896 and was re-projected by Google on every camera change —
    // felt as laggy zooming the moment the layer was switched on.
    //
    // Don't put it back. That smoothing predates the P13 metro engine, when
    // this file held hand-approximated geometry with few, widely-spaced points
    // and rounding its corners was visible. Real OSM geometry has a MEDIAN
    // vertex spacing of 48.7 m, which is 0.65 px at zoom 11 and 2.6 px at zoom
    // 13 — the spline was interpolating inside a sub-pixel span, under a 3.5 px
    // stroke. It cost 8x and could not be seen at any zoom the map has.
    const { lines, stations } = splitMetroFeatures(filterByCity(data, nextCity))

    metroLines.forEach((f) => metroLines.remove(f))
    metroStations.forEach((f) => metroStations.remove(f))
    metroLines.addGeoJson(lines)
    metroStations.addGeoJson(stations)
    metroLines.setStyle(styleMetroFeature)
    metroStations.setStyle(styleMetroFeature)

    metroState.current.loaded = true
    metroState.current.city = nextCity
  }

  /** Attach/detach each metro layer for the current toggle + zoom. */
  function applyMetroVisibility(map) {
    const { metroLines, metroStations } = layers.current
    if (!metroLines || !metroStations) return
    const on = useMapStore.getState().activeLayers.metro
    metroLines.setMap(on ? map : null)
    metroStations.setMap(on && stationsVisibleAt(map.getZoom()) ? map : null)
  }

  // Create tooltip DOM element once
  useEffect(() => {
    tooltipEl.current = createTooltip()
    return () => {
      tooltipEl.current?.remove()
      tooltipEl.current = null
    }
  }, [])

  function rebuildItCorridorCircles(map, cityFilter) {
    layers.current.itCorridorCircles.forEach((c) => c.setMap(null))

    const mapDiv = map.getDiv()
    layers.current.itCorridorCircles = filterByCity(itData, cityFilter).features.map((f) => {
      const [lng, lat] = f.geometry.coordinates
      const circle = new window.google.maps.Circle({
        center: { lat, lng },
        radius: f.properties.radiusMeters,
        map: activeLayers.itCorridors ? map : null,
        ...itCorridorCircleOptions(f.properties),
      })

      circle.addListener('click', () => {
        if (f.properties.areaSlug) setSelectedArea({ slug: f.properties.areaSlug })
      })

      circle.addListener('mouseover', (event) => {
        const tt = tooltipEl.current
        if (!tt) return
        circle.setOptions(itCorridorCircleOptions(f.properties, true))
        const move = (e) => positionTooltip(tt, e.clientX, e.clientY)
        mapDiv.addEventListener('mousemove', move)
        mouseMoveRef.current = move
        const domEvent = event.domEvent
        showTooltip(tt, domEvent.clientX, domEvent.clientY, tooltipHtml(f.properties))
      })

      circle.addListener('mouseout', () => {
        if (tooltipEl.current) tooltipEl.current.style.display = 'none'
        if (mouseMoveRef.current) {
          mapDiv.removeEventListener('mousemove', mouseMoveRef.current)
          mouseMoveRef.current = null
        }
        circle.setOptions(itCorridorCircleOptions(f.properties, false))
      })

      return circle
    })
  }

  // Init Data layers once map is ready
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    layers.current.metroLines    = new window.google.maps.Data()
    layers.current.metroStations = new window.google.maps.Data()
    layers.current.traffic       = new window.google.maps.TrafficLayer()

    const initCity = useFilterStore.getState().filters.city
    // Metro data loads only when the layer is actually on — most sessions
    // never toggle it and never pay the download.
    if (useMapStore.getState().activeLayers.metro) syncMetro(initCity)

    rebuildItCorridorCircles(map, initCity)

    // Station dots come and go with zoom. Listening to `zoom_changed` rather
    // than `idle` so they arrive with the gesture; the body only calls setMap,
    // which is a no-op when nothing crossed the threshold.
    const zoomListener = window.google.maps.event.addListener(map, 'zoom_changed', () => {
      applyMetroVisibility(map)
    })

    const currentLayers = layers.current
    const mapDiv = map.getDiv()
    return () => {
      window.google.maps.event.removeListener(zoomListener)
      if (currentLayers.metroLines?.setMap) currentLayers.metroLines.setMap(null)
      if (currentLayers.metroStations?.setMap) currentLayers.metroStations.setMap(null)
      if (currentLayers.traffic?.setMap) currentLayers.traffic.setMap(null)
      currentLayers.itCorridorCircles.forEach((c) => c.setMap(null))
      if (mouseMoveRef.current) {
        mapDiv.removeEventListener('mousemove', mouseMoveRef.current)
        mouseMoveRef.current = null
      }
    }
  }, [mapReady]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reload all city-scoped layers when city changes
  useEffect(() => {
    const map = mapRef.current
    const { metroLines } = layers.current
    if (!map || !metroLines) return

    // Refilter metro only if its data is already loaded or the layer is on —
    // otherwise the first toggle-on loads it fresh for the current city.
    if (metroState.current.loaded || useMapStore.getState().activeLayers.metro) {
      syncMetro(city)
    }
    rebuildItCorridorCircles(map, city)
  }, [city]) // eslint-disable-line react-hooks/exhaustive-deps

  // Toggle each layer on/off
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const { metroLines, itCorridorCircles, traffic } = layers.current
    if (metroLines) {
      if (activeLayers.metro) syncMetro(useFilterStore.getState().filters.city)
      applyMetroVisibility(map)
    }
    if (traffic) traffic.setMap(activeLayers.traffic ? map : null)
    itCorridorCircles.forEach((c) => c.setMap(activeLayers.itCorridors ? map : null))
  }, [activeLayers, mapReady]) // eslint-disable-line react-hooks/exhaustive-deps
}
