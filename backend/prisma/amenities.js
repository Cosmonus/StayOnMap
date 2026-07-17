// Canonical amenity names — the single source both the full seed
// (prisma/seed.js) and the standalone amenity backfill
// (scripts/seed-amenities.mjs) upsert from. Names must exactly match the
// host-onboarding feature chips in
// frontend/src/features/listings/config/onboarding.js — the wizard maps
// chip names to Amenity ids by name, and an unmatched name is silently
// dropped from the created listing.
//
// Every name here must ALSO have an entry in the AmenityIcon maps (web +
// mobile) or it renders a generic fallback icon, and should appear in at
// least one wizard chip list AND one filter option list — a name in only one
// of those is either an unsearchable tag or a filter that matches nothing.
// `node scripts/check-amenities.mjs` enforces all of this; run it after any
// edit here.
//
// Naming rule (learned the hard way — see "Gated Security" below): one
// concept, one name. Near-synonyms silently split the data in half, because
// owners tag one and searchers filter the other.
//   - "Geyser" covers electric water heating; "Solar Water Heater" is a
//     genuinely different thing. There is no separate "Hot Water".
//   - "Gas Pipeline" is the piped-gas connection. There is no "Piped Gas".
//   - "Gated Community" is the only gated concept. "Gated Security" was a
//     second name for it that no wizard chip ever offered, so it was
//     filterable but untaggable — removed 2026-07-17. Legacy rows may still
//     link to it in production until scripts/remap-gated-security.mjs runs.
export const AMENITIES = [
  // ── Connectivity & climate ───────────────────────────────────────
  'WiFi', 'AC', 'Air Cooler', 'TV', 'Workspace',

  // ── Power ────────────────────────────────────────────────────────
  'Power Backup', 'Solar Panel', 'EV Charging', '3-Phase Power',

  // ── Water ────────────────────────────────────────────────────────
  'Geyser', 'Solar Water Heater', 'Water Purifier', 'Water Supply',
  'Water Tank', 'Borewell', 'Rainwater Harvesting',

  // ── Safety & security ────────────────────────────────────────────
  'CCTV', 'Security Guard', 'Intercom', 'Video Door Phone',
  'Gated Community', 'Fire Safety', 'Boundary Wall',

  // ── Parking ──────────────────────────────────────────────────────
  'Parking', 'Covered Parking', 'Visitor Parking', 'Two-wheeler Parking',

  // ── Building & access ────────────────────────────────────────────
  'Lift', 'Wheelchair Accessible', 'Waste Management', 'Housekeeping',

  // ── Community & leisure ──────────────────────────────────────────
  'Gym', 'Swimming Pool', 'Club House', 'Play Area', 'Jogging Track',
  'Indoor Games', 'Badminton Court', 'Party Hall', 'Creche', 'Garden',

  // ── Inside the home ──────────────────────────────────────────────
  'Kitchen', 'Modular Kitchen', 'Gas Pipeline', 'Washing Machine',
  'Fridge', 'Microwave', 'Sofa', 'Bed', 'Wardrobe', 'Dining Table',
  'Balcony', 'Terrace', 'Servant Room', 'Attached Bath', 'Washroom',
  'Study Desk', 'Pet Friendly',

  // ── PG meals ─────────────────────────────────────────────────────
  'Breakfast', 'Lunch', 'Dinner', 'Laundry',

  // ── Land ─────────────────────────────────────────────────────────
  'Corner Plot', 'East Facing', 'Near Main Road', 'Ready to Build',

  // ── Commercial ───────────────────────────────────────────────────
  'Roll-down Shutter', 'Mezzanine', 'Signage Space',

  // ── Short stay ───────────────────────────────────────────────────
  'Beachfront',
]
