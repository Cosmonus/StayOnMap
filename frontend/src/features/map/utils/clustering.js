// Client-side pin clustering using supercluster
// Groups nearby pins into a single bubble when zoomed out.
// On zoom-in they split back into individual markers.

import Supercluster from 'supercluster'

const sc = new Supercluster({
  radius:   60,   // px — how close pins must be to merge
  maxZoom:  14,   // stop clustering above zoom 14
  minPoints: 2,   // need at least 2 pins to form a cluster
})

/**
 * Returns a mixed array of cluster items and individual pin items.
 * Each item is a GeoJSON Feature:
 *   cluster item  → { properties: { cluster: true, cluster_id, point_count }, geometry }
 *   pin item      → { properties: { cluster: false, id, rent, type },         geometry }
 */
export function computeClusters(pins, bounds, zoom) {
  if (!pins.length || !bounds) return []

  const points = pins.map((p) => ({
    type: 'Feature',
    properties: { id: p.id, rent: p.rent, type: p.type },
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
