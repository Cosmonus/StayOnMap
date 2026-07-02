// react-native-maps has no "zoom level" concept — regions are expressed as
// lat/lng deltas. These are the standard approximations used to bridge to
// the zoom-level numbers the rest of the app's config (CITY_ZOOM, AREA_ZOOM,
// supercluster's getExpansionZoom) is expressed in.
export function zoomToDelta(zoom) {
  const delta = 360 / Math.pow(2, zoom)
  return { latitudeDelta: delta, longitudeDelta: delta }
}

export function regionToZoom(region) {
  if (!region?.longitudeDelta) return 5
  return Math.log2(360 / region.longitudeDelta)
}

export function regionToBounds(region) {
  const { latitude, longitude, latitudeDelta, longitudeDelta } = region
  return {
    swLat: latitude - latitudeDelta / 2,
    swLng: longitude - longitudeDelta / 2,
    neLat: latitude + latitudeDelta / 2,
    neLng: longitude + longitudeDelta / 2,
  }
}
