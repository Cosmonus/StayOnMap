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
  Thermometer, CloudRain, Umbrella,
  Mountain, MoveVertical, Waves, Map,
  CircleDot,
} from 'lucide-react'

// An icon per measurement, keyed by the backend's stable `fact.key`.
//
// Keys come from backend/src/features/spatial/modules/*.js — the `key:` passed
// to fact(). `nearest_<category>` is the systematic shape (the category
// vocabulary lives in features/spatial/poiCategories.js); the rest are
// module-specific.
//
// A key with no entry here falls back to a neutral dot rather than rendering
// nothing, so a newly-added backend fact degrades to "unstyled" instead of
// "invisible" — the same silent-mismatch trap the amenities list already fell
// into once (see scripts/check-amenities.mjs).
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
  // nearest_bank is emitted by both lifestyle and infrastructure — one entry
  // serves both, which is the point of keying on the fact key rather than the
  // module.
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
  annual_temp:         Thermometer,
  annual_rainfall:     CloudRain,
  rain_concentration:  Umbrella,

  // ── terrain ───────────────────────────────────────────────────────────────
  elevation:           Mountain,
  relative_height:     MoveVertical,
  local_relief:        Waves,

  // ── locality ──────────────────────────────────────────────────────────────
  // Keyed by OSM admin level, so the shape is admin_<n> rather than a name.
  admin_6:             Map,
  admin_8:             Building2,
  admin_9:             MapPin,
  admin_10:            MapPin,

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
