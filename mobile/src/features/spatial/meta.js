import { BusFront, Footprints, Landmark, Wind, Wallet, Store, BedDouble, Hotel, Trees, MapPin, Mountain } from 'lucide-react-native'
import { colors } from '@theme/colors'

// Presentation metadata for each spatial module — the RN mirror of
// frontend/src/features/spatial/meta.js. Keys and copy match web exactly; only
// the icon package and the band colors (theme tokens, not Tailwind classes)
// differ. Change copy in BOTH places or the platforms drift.
//
// Icons come straight from lucide-react-native rather than the app's
// components/common/Icon.js registry: these are one-feature glyphs keyed to
// backend module/fact keys, and pushing ~40 of them into the app-wide semantic
// registry would pollute it for every other caller. Same choice as factIcons.js.
export const MODULE_META = {
  locality:       { title: 'Where this is',    prompt: 'Which ward and zone does this address fall in?',   Icon: MapPin },
  mobility:       { title: 'Getting around',   prompt: 'Transit, walking distance and rush-hour traffic',  Icon: BusFront },
  lifestyle:      { title: 'Daily life',       prompt: 'Could you live here without a car?',               Icon: Footprints },
  infrastructure: { title: 'Infrastructure',   prompt: 'Banks, fuel and charging — what’s actually nearby?', Icon: Landmark },
  environment:    { title: 'Environment',      prompt: 'What are you breathing here?',                     Icon: Wind },
  // Drainage, not flood risk — the module deliberately does not claim the
  // latter. See backend terrain.module.js.
  terrain:        { title: 'Lie of the land',  prompt: 'Where does the water go when it rains?',           Icon: Mountain },
  costOfLiving:   { title: 'Cost of living',   prompt: 'What does this address cost beyond rent?',         Icon: Wallet },

  // Type-specific — the backend filters by property type, so a shop never
  // gets "Daily life" and a plot never gets walkability.
  commerce:       { title: 'Trade & footfall', prompt: 'Will customers walk past this door?',              Icon: Store },
  pgContext:      { title: 'PG essentials',    prompt: 'Can you eat, study and get home safely?',          Icon: BedDouble },
  stayContext:    { title: 'For guests',       prompt: 'How do visitors get here, and what is nearby?',    Icon: Hotel },
  landContext:    { title: 'Plot context',     prompt: 'What has been built around this land?',            Icon: Trees },
}

// Which POI categories each module's report offers as a browseable "nearby
// places" list, and the radius matching how that module frames its facts.
// Keys are the backend vocabulary (backend/src/features/spatial/
// poiCategories.js) — a mismatch fails silently as an empty list.
// Environment has no entry on purpose: PM2.5 isn't a place.
export const MODULE_POI_BROWSE = {
  mobility:       { radius: 2000, categories: ['bus_stop', 'railway_station', 'taxi'] },
  lifestyle:      { radius: 1600, categories: ['supermarket', 'pharmacy', 'hospital', 'clinic', 'school', 'restaurant', 'cafe', 'bank', 'park', 'gym'] },
  infrastructure: { radius: 2000, categories: ['bank', 'atm', 'fuel', 'government', 'ev_charging', 'police', 'fire_station'] },
  pgContext:      { radius: 1600, categories: ['food_cheap', 'restaurant', 'cafe', 'laundry', 'pharmacy', 'atm', 'college'] },
  stayContext:    { radius: 2000, categories: ['attraction', 'restaurant', 'cafe', 'hotel', 'railway_station'] },
  commerce:       { radius: 1500, categories: ['retail', 'restaurant', 'cafe', 'supermarket', 'bank', 'atm'] },
  landContext:    { radius: 5000, categories: ['school', 'hospital', 'supermarket', 'bank', 'fuel'] },
}

// Human labels for the category pills and for unnamed rows.
export const POI_CATEGORY_LABEL = {
  supermarket: 'Groceries', pharmacy: 'Pharmacies', hospital: 'Hospitals',
  clinic: 'Clinics', school: 'Schools', government: 'Government',
  police: 'Police', fire_station: 'Fire stations', restaurant: 'Restaurants',
  cafe: 'Cafés', park: 'Parks', gym: 'Gyms', bank: 'Banks', atm: 'ATMs',
  fuel: 'Fuel', ev_charging: 'EV charging', bus_stop: 'Bus stops',
  taxi: 'Taxi stands', airport: 'Airports', railway_station: 'Railway stations',
  attraction: 'Attractions', hotel: 'Hotels', college: 'Colleges',
  food_cheap: 'Quick eats', laundry: 'Laundry', retail: 'Shops',
}

// Shown on the summary card — the assessment must carry enough of the caveat
// to stand on its own, since the full meter lives in the report.
export const BAND_LABEL = {
  HIGH:     { text: 'High confidence', color: colors.brand700 },
  MODERATE: { text: 'Moderate',        color: colors.slate500 },
  LOW:      { text: 'Low confidence',  color: colors.warning },
  MINIMAL:  { text: 'Limited data',    color: colors.slate500 },
}
