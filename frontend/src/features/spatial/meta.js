import {
  BusFront, Footprints, Landmark, Wind, Wallet, Store, BedDouble, Hotel, Trees,
} from 'lucide-react'

// Presentation metadata for each spatial module: a title, an icon, and the
// question the module answers.
//
// Lives outside ModuleCard because the summary card and the detail modal both
// need it, and importing it from the card would make that pair circular.
//
// `prompt` is phrased as a question on purpose. A card that has to be clicked
// to reveal its detail must earn the click, and "What are you breathing here?"
// does that better than "Air quality" — while still plainly describing the
// contents rather than teasing them. The assessment shown underneath is the
// real answer, so the hook and the payoff are the same thing.
export const MODULE_META = {
  mobility:       { title: 'Getting around',   prompt: 'Transit, walking distance and rush-hour traffic',  Icon: BusFront },
  lifestyle:      { title: 'Daily life',       prompt: 'Could you live here without a car?',               Icon: Footprints },
  infrastructure: { title: 'Infrastructure',   prompt: 'Banks, fuel and charging — what’s actually nearby?', Icon: Landmark },
  environment:    { title: 'Environment',      prompt: 'What are you breathing here?',                     Icon: Wind },
  costOfLiving:   { title: 'Cost of living',   prompt: 'What does this address cost beyond rent?',         Icon: Wallet },

  // Type-specific. A listing only ever receives the modules relevant to it —
  // the backend filters by property type (features/spatial/propertyTypes.js),
  // so a shop never gets "Daily life" and a plot never gets walkability.
  commerce:       { title: 'Trade & footfall', prompt: 'Will customers walk past this door?',              Icon: Store },
  pgContext:      { title: 'PG essentials',    prompt: 'Can you eat, study and get home safely?',          Icon: BedDouble },
  stayContext:    { title: 'For guests',       prompt: 'How do visitors get here, and what is nearby?',    Icon: Hotel },
  landContext:    { title: 'Plot context',     prompt: 'What has been built around this land?',            Icon: Trees },
}

// Which POI categories each module's report offers as a browseable "nearby
// places" list, and the radius that matches how that module already frames
// its facts. Keys are the backend vocabulary
// (backend/src/features/spatial/poiCategories.js) — a mismatch fails
// silently as an empty list, the same trap the amenities system documents.
//
// Environment has no entry on purpose: its facts (PM2.5) aren't places.
export const MODULE_POI_BROWSE = {
  mobility:       { radius: 2000, categories: ['bus_stop', 'railway_station', 'taxi'] },
  lifestyle:      { radius: 1600, categories: ['supermarket', 'pharmacy', 'hospital', 'clinic', 'school', 'restaurant', 'cafe', 'bank', 'park', 'gym'] },
  infrastructure: { radius: 2000, categories: ['bank', 'atm', 'fuel', 'government', 'ev_charging', 'police', 'fire_station'] },
  pgContext:      { radius: 1600, categories: ['food_cheap', 'restaurant', 'cafe', 'laundry', 'pharmacy', 'atm', 'college'] },
  stayContext:    { radius: 2000, categories: ['attraction', 'restaurant', 'cafe', 'hotel', 'railway_station'] },
  commerce:       { radius: 1500, categories: ['retail', 'restaurant', 'cafe', 'supermarket', 'bank', 'atm'] },
  landContext:    { radius: 5000, categories: ['school', 'hospital', 'supermarket', 'bank', 'fuel'] },
}

// Human labels for the category pills and for unnamed rows ("Unnamed
// pharmacy"). One map so a pill and a fallback can never disagree.
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

// Shown on the summary card. An assessment with no indication of how
// well-supported it is would be the most confident-looking thing on the card
// and the least examined — the summary state has to carry enough of the caveat
// to stand on its own, since the full meter lives in the report.
export const BAND_LABEL = {
  HIGH:     { text: 'High confidence', cls: 'text-brand-700' },
  MODERATE: { text: 'Moderate',        cls: 'text-slate-500' },
  LOW:      { text: 'Low confidence',  cls: 'text-amber-700' },
  MINIMAL:  { text: 'Limited data',    cls: 'text-slate-400' },
}
