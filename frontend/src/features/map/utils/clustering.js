// Client-side clustering helpers
// Note: prefer Mapbox's built-in GeoJSON clustering for performance
// These utils are for custom cluster rendering logic only

export function buildGeoJson(_pins) {
  // TODO: convert pins array to GeoJSON FeatureCollection
  return { type: 'FeatureCollection', features: [] }
}

export function clusterConfig() {
  return {
    cluster: true,
    clusterMaxZoom: 14,
    clusterRadius: 50,
  }
}
