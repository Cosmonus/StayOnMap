// Matches a pin (lat/lng) to its nearest area-intelligence profile so the
// map's Metro/Traffic/IT-corridor filter toggles can act on properties,
// which have no area field of their own — only coordinates. Simple squared
// distance is fine at neighborhood scale (area profiles are km apart);
// no need for a full haversine calculation here.
export function nearestArea(lat, lng, areas) {
  if (!areas?.length) return null
  let best = null
  let bestDist = Infinity
  for (const area of areas) {
    const d = (area.lat - lat) ** 2 + (area.lng - lng) ** 2
    if (d < bestDist) { bestDist = d; best = area }
  }
  return best
}

const METRO_THRESHOLD = 6 // metroScore >= this counts as "good metro access"
const TRAFFIC_THRESHOLD = 5 // trafficScore <= this counts as "low traffic"
const IT_THRESHOLD = 7 // itScore >= this counts as "IT corridor"

// Pins with no resolvable area are excluded while a toggle is active —
// safer than silently including properties the filter can't actually verify.
export function passesAreaFilters(pin, areas, filters) {
  if (!filters.goodMetro && !filters.lowTraffic && !filters.itCorridor) return true
  const area = nearestArea(+pin.lat, +pin.lng, areas)
  if (!area) return false
  if (filters.goodMetro && area.metroScore < METRO_THRESHOLD) return false
  if (filters.lowTraffic && area.trafficScore > TRAFFIC_THRESHOLD) return false
  if (filters.itCorridor && area.itScore < IT_THRESHOLD) return false
  return true
}
