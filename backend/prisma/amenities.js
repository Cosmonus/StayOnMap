// Canonical amenity names — the single source both the full seed
// (prisma/seed.js) and the standalone amenity backfill
// (scripts/seed-amenities.mjs) upsert from. Names must exactly match the
// host-onboarding feature chips in
// frontend/src/features/listings/config/onboarding.js — the wizard maps
// chip names to Amenity ids by name, and an unmatched name is silently
// dropped from the created listing.
export const AMENITIES = [
  'WiFi', 'Parking', 'CCTV', 'AC', 'Lift', 'Gym', 'Power Backup',
  'Kitchen', 'Washing Machine', 'Pet Friendly', 'Furnished', 'Security Guard',
  'Swimming Pool', 'Club House', 'Play Area', 'Garden', 'Intercom',
  'Solar Water Heater', 'Rainwater Harvesting', 'Gas Pipeline', 'Gated Security',
  // Added for the land/pg/shop/stay host-onboarding feature chips —
  // WiFi/AC/Lift/Power Backup/Gym/Security Guard/Gas Pipeline/Garden/
  // Solar Water Heater/Parking/Kitchen/Swimming Pool/Washing Machine/
  // Pet Friendly above are reused as-is for the equivalent chips.
  'Covered Parking', 'Modular Kitchen', 'Balcony', 'Terrace', 'Gated Community',
  'Borewell', 'Servant Room', 'Corner Plot', 'Boundary Wall', 'East Facing',
  'Near Main Road', 'Ready to Build', 'Breakfast', 'Lunch', 'Dinner', 'Laundry',
  'Housekeeping', 'Study Desk', 'Attached Bath', 'Washroom', '3-Phase Power',
  'Roll-down Shutter', 'Mezzanine', 'Signage Space', 'TV', 'Workspace', 'Beachfront',
]
