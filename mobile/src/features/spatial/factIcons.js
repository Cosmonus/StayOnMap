import {
  TrainFront, Footprints, Route, BusFront, Car, Gauge,
  ShoppingCart, Pill, Stethoscope, GraduationCap, UtensilsCrossed, Landmark,
  Trees, Dumbbell, Coffee,
  CreditCard, Fuel, Building2, Zap,
  Wind, CalendarRange, CloudFog,
  Store, ShoppingBag,
  MapPin, Construction,
  Plane, Camera, Hotel,
  Shield, Siren, Shirt,
  CircleDot,
} from 'lucide-react-native'

// An icon per measurement, keyed by the backend's stable `fact.key` — the RN
// mirror of frontend/src/features/spatial/factIcons.js. Keep the two keyed
// identically; a key with no entry falls back to a neutral dot rather than
// rendering nothing (the amenities silent-mismatch lesson).
//
// Imported from lucide-react-native directly, not components/common/Icon.js —
// see meta.js for why these stay out of the app-wide semantic registry.
const FACT_ICONS = {
  // ── mobility ──────────────────────────────────────────────────────────────
  nearest_metro:       TrainFront,
  walk_time_metro:     Footprints,
  metro_lines:         Route,
  bus_stops_800m:      BusFront,
  peak_drive_time:     Car,
  peak_congestion:     Gauge,

  // ── lifestyle ─────────────────────────────────────────────────────────────
  nearest_supermarket: ShoppingCart,
  nearest_pharmacy:    Pill,
  nearest_hospital:    Stethoscope,
  nearest_school:      GraduationCap,
  nearest_restaurant:  UtensilsCrossed,
  nearest_park:        Trees,
  nearest_gym:         Dumbbell,
  nearest_cafe:        Coffee,
  walkability:         Footprints,

  // ── infrastructure ────────────────────────────────────────────────────────
  nearest_bank:        Landmark,
  nearest_atm:         CreditCard,
  nearest_fuel:        Fuel,
  nearest_government:  Building2,
  nearest_ev_charging: Zap,
  nearest_police:      Shield,
  nearest_fire_station: Siren,

  // ── environment ───────────────────────────────────────────────────────────
  pm25_now:            Wind,
  pm25_typical:        CalendarRange,
  pm25_bad_days:       CloudFog,
  pm10_now:            Wind,

  // ── commerce ──────────────────────────────────────────────────────────────
  trade_density:       Store,
  similar_retail:      ShoppingBag,
  nearest_anchor:      Building2,
  fuel_nearby:         Fuel,

  // ── landContext ───────────────────────────────────────────────────────────
  distance_from_city:  MapPin,
  development_nearby:  Construction,

  // ── pgContext ─────────────────────────────────────────────────────────────
  food_walkable:       UtensilsCrossed,
  nearest_college:     GraduationCap,
  nearest_laundry:     Shirt,

  // ── stayContext ───────────────────────────────────────────────────────────
  airport_distance:    Plane,
  station_distance:    TrainFront,
  attractions_nearby:  Camera,
  dining_nearby:       UtensilsCrossed,
  other_stays:         Hotel,
}

export function factIcon(key) {
  return FACT_ICONS[key] ?? CircleDot
}
