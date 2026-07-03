// Client-side pin clustering using supercluster — ported from
// frontend/src/features/map/utils/clustering.js (pure JS, framework-agnostic).
import Supercluster from 'supercluster'

const sc = new Supercluster({
  radius: 60,
  maxZoom: 14,
  minPoints: 2,
})

/**
 * Returns a mixed array of cluster items and individual pin items.
 * Each item is a GeoJSON Feature:
 *   cluster item → { properties: { cluster: true, cluster_id, point_count }, geometry }
 *   pin item     → { properties: { cluster: false, id, rent, type },         geometry }
 */
export function computeClusters(pins, bounds, zoom) {
  if (!pins.length || !bounds) return []

  const points = pins.map((p) => ({
    type: 'Feature',
    properties: { id: p.id, rent: p.rent, type: p.type, bhk: p.bhk, sharing: p.sharing },
    geometry: { type: 'Point', coordinates: [+p.lng, +p.lat] },
  }))

  sc.load(points)

  const bbox = [bounds.swLng, bounds.swLat, bounds.neLng, bounds.neLat]
  return sc.getClusters(bbox, Math.round(zoom))
}

/** Zoom level at which a cluster expands into its children. */
export function getExpansionZoom(clusterId) {
  return sc.getClusterExpansionZoom(clusterId)
}
